import { joinPathFragments, type Tree, updateJson } from '@nx/devkit';
import {
  addTsConfigPath,
  getRelativePathToRootTsConfig,
  getRootTsConfigFileName,
} from '@nx/js';
import { getNeededCompilerOptionOverrides } from '@nx/js/src/utils/typescript/configuration';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { dirname } from 'node:path';
import { lt } from 'semver';
import type { System } from 'typescript';
import { updateProjectRootTsConfig } from '../../utils/update-project-root-tsconfig';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';
import type { NormalizedSchema } from './normalized-schema';

export function updateTsConfigFiles(
  tree: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  updateProjectIvyConfig(tree, options);

  const compilerOptions: Record<string, any> = {
    skipLibCheck: true,
    experimentalDecorators: true,
    importHelpers: true,
    target: 'es2022',
    ...(options.strict
      ? {
          strict: true,
          noImplicitOverride: true,
          noPropertyAccessFromIndexSignature: true,
          noImplicitReturns: true,
          noFallthroughCasesInSwitch: true,
        }
      : {}),
  };

  const { major: angularMajorVersion, version: angularVersion } =
    getInstalledAngularVersionInfo(tree);
  if (lt(angularVersion, '18.1.0')) {
    compilerOptions.useDefineForClassFields = false;
  }
  if (angularMajorVersion >= 20) {
    compilerOptions.module = 'preserve';
  } else {
    compilerOptions.moduleResolution = 'bundler';
    compilerOptions.module = 'es2022';
  }

  if (options.strict) {
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

    if (tree.exists(`${options.projectRoot}/tsconfig.spec.json`)) {
      updateJson(tree, `${options.projectRoot}/tsconfig.spec.json`, (json) => {
        json.extends = './tsconfig.json';
        delete json.compilerOptions?.module;
        delete json.compilerOptions?.moduleResolution;
        json.references ??= [];
        if (!json.references.some((x) => x.path === './tsconfig.lib.json')) {
          json.references.push({ path: './tsconfig.lib.json' });
        }
        return json;
      });
    }

    updateJson(tree, 'tsconfig.json', (json) => {
      const projectPath = './' + options.projectRoot;
      json.references ??= [];
      if (!json.references.some((x) => x.path === projectPath)) {
        json.references.push({ path: projectPath });
      }
      return json;
    });
  } else {
    updateProjectConfig(tree, options);
    addTsConfigPath(tree, options.importPath, [
      joinPathFragments(options.projectRoot, './src', 'index.ts'),
    ]);
  }

  updateJson(tree, `${options.projectRoot}/tsconfig.json`, (json) => {
    json.compilerOptions = {
      ...json.compilerOptions,
      ...compilerOptions,
    };
    json.compilerOptions = getNeededCompilerOptionOverrides(
      tree,
      json.compilerOptions,
      getRootTsConfigFileName(tree)
    );

    if (options.strict) {
      json.angularCompilerOptions = {
        ...json.angularCompilerOptions,
        strictInjectionParameters: true,
        strictInputAccessModifiers: true,
        typeCheckHostBindings: angularMajorVersion >= 20 ? true : undefined,
        strictTemplates: true,
      };
    }

    return json;
  });
}

function updateProjectConfig(
  host: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  updateJson(host, `${options.projectRoot}/tsconfig.lib.json`, (json) => {
    json.include = ['src/**/*.ts'];
    json.exclude = [
      ...new Set([
        ...(json.exclude || []),
        'jest.config.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
      ]),
    ];
    return json;
  });

  // tsconfig.json
  updateProjectRootTsConfig(
    host,
    options.projectRoot,
    getRelativePathToRootTsConfig(host, options.projectRoot)
  );
}

function updateProjectIvyConfig(
  host: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  if (options.buildable || options.publishable) {
    return updateJson(
      host,
      `${options.projectRoot}/tsconfig.lib.prod.json`,
      (json) => {
        json.angularCompilerOptions['compilationMode'] =
          options.compilationMode === 'full' ? undefined : 'partial';
        return json;
      }
    );
  }
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
