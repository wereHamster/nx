import {
  joinPathFragments,
  readJson,
  readProjectConfiguration,
  updateJson,
  type Tree,
} from '@nx/devkit';
import { getRootTsConfigFileName } from '@nx/js';
import { getNeededCompilerOptionOverrides } from '@nx/js/src/utils/typescript/configuration';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { dirname } from 'node:path';
import { gte, lt } from 'semver';
import type { System } from 'typescript';
import { updateAppEditorTsConfigExcludedFiles } from '../../utils/update-app-editor-tsconfig-excluded-files';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import { enableStrictTypeChecking } from './enable-strict-type-checking';
import type { NormalizedSchema } from './normalized-schema';

interface TsConfig {
  compilerOptions?: Record<string, any>;
  exclude?: string[];
  extends?: string | string[];
  references?: { path: string }[];
}

export function updateTsconfigFiles(tree: Tree, options: NormalizedSchema) {
  enableStrictTypeChecking(tree, options);

  const compilerOptions: Record<string, any> = {
    skipLibCheck: true,
    experimentalDecorators: true,
    importHelpers: true,
    target: 'es2022',
  };

  const { major: angularMajorVersion, version: angularVersion } =
    getInstalledAngularVersionInfo(tree);
  if (lt(angularVersion, '18.1.0')) {
    compilerOptions.useDefineForClassFields = false;
  }
  if (gte(angularVersion, '18.2.0')) {
    compilerOptions.isolatedModules = true;
  }
  if (angularMajorVersion >= 20) {
    compilerOptions.module = 'preserve';
  } else {
    compilerOptions.esModuleInterop = options.bundler === 'esbuild';
    compilerOptions.moduleResolution = 'bundler';
    compilerOptions.module = 'es2022';
  }

  if (options.isTsSolutionSetup) {
    const baseCompilerOptions = getTsConfigBaseCompilerOptions(tree);
    if (baseCompilerOptions.moduleResolution !== undefined) {
      compilerOptions.moduleResolution = 'bundler';
    }
    if (
      baseCompilerOptions.lib !== undefined &&
      !['es2022', 'dom'].every((lib) => baseCompilerOptions.lib.includes(lib))
    ) {
      compilerOptions.lib = ['es2022', 'dom'];
    }
    if (baseCompilerOptions.emitDeclarationOnly) {
      compilerOptions.emitDeclarationOnly = false;
    }

    if (tree.exists(`${options.appProjectRoot}/tsconfig.spec.json`)) {
      updateJson<TsConfig>(
        tree,
        `${options.appProjectRoot}/tsconfig.spec.json`,
        (json) => {
          json.extends = './tsconfig.json';
          delete json.compilerOptions?.module;
          delete json.compilerOptions?.moduleResolution;
          json.references ??= [];
          if (!json.references.some((x) => x.path === './tsconfig.app.json')) {
            json.references.push({ path: './tsconfig.app.json' });
          }
          return json;
        }
      );
    }

    updateJson<TsConfig>(tree, 'tsconfig.json', (json) => {
      const projectPath = './' + options.appProjectRoot;
      json.references ??= [];
      if (!json.references.some((x) => x.path === projectPath)) {
        json.references.push({ path: projectPath });
      }
      return json;
    });
  } else {
    updateEditorTsConfig(tree, options);
  }

  updateJson(tree, `${options.appProjectRoot}/tsconfig.json`, (json) => {
    json.compilerOptions = {
      ...json.compilerOptions,
      ...compilerOptions,
    };
    json.compilerOptions = getNeededCompilerOptionOverrides(
      tree,
      json.compilerOptions,
      getRootTsConfigFileName(tree)
    );
    return json;
  });
}

function updateEditorTsConfig(tree: Tree, options: NormalizedSchema) {
  const appTsConfig = readJson<TsConfig>(
    tree,
    joinPathFragments(options.appProjectRoot, 'tsconfig.app.json')
  );
  const types = appTsConfig?.compilerOptions?.types ?? [];

  if (types?.length) {
    updateJson(
      tree,
      joinPathFragments(options.appProjectRoot, 'tsconfig.editor.json'),
      (json) => {
        json.compilerOptions ??= {};
        json.compilerOptions.types = Array.from(new Set(types));
        return json;
      }
    );
  }

  const project = readProjectConfiguration(tree, options.name);
  updateAppEditorTsConfigExcludedFiles(tree, project);
}

function getTsConfigBaseCompilerOptions(tree: Tree) {
  const ts = ensureTypescript();

  const tsSysFromTree: System = {
    ...ts.sys,
    readFile: (path) => tree.read(path, 'utf-8'),
  };

  const parsed = ts.parseJsonConfigFileContent(
    ts.readConfigFile('tsconfig.base.json', tsSysFromTree.readFile).config,
    tsSysFromTree,
    dirname('tsconfig.base.json')
  );

  return parsed.options;
}
