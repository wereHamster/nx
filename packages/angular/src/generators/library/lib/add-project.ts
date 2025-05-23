import type { Tree } from '@nx/devkit';
import {
  addProjectConfiguration,
  joinPathFragments,
  readJson,
  writeJson,
} from '@nx/devkit';
import { addBuildTargetDefaults } from '@nx/devkit/src/generators/target-defaults-utils';
import { getUpdatedPackageJsonContent } from '@nx/js';
import { join } from 'node:path';
import type { PackageJson } from 'nx/src/utils/package-json';
import { parse } from 'semver';
import type { AngularProjectConfiguration } from '../../../utils/types';
import { getInstalledAngularVersion } from '../../utils/version-utils';
import type { NormalizedSchema } from './normalized-schema';

export function addProject(
  tree: Tree,
  libraryOptions: NormalizedSchema['libraryOptions']
) {
  const project: AngularProjectConfiguration = {
    name: libraryOptions.name,
    root: libraryOptions.projectRoot,
    sourceRoot: joinPathFragments(libraryOptions.projectRoot, 'src'),
    prefix: libraryOptions.prefix,
    tags: libraryOptions.parsedTags,
    projectType: 'library',
    targets: {},
  };

  if (libraryOptions.buildable || libraryOptions.publishable) {
    const executor = libraryOptions.publishable
      ? '@nx/angular:package'
      : '@nx/angular:ng-packagr-lite';

    addBuildTargetDefaults(tree, executor);

    project.targets.build = {
      executor,
      outputs: ['{workspaceRoot}/dist/{projectRoot}'],
      options: {
        project: `${libraryOptions.projectRoot}/ng-package.json`,
      },
      configurations: {
        production: {
          tsConfig: `${libraryOptions.projectRoot}/tsconfig.lib.prod.json`,
        },
        development: {
          tsConfig: `${libraryOptions.projectRoot}/tsconfig.lib.json`,
        },
      },
      defaultConfiguration: 'production',
    };
  }

  if (
    libraryOptions.buildable ||
    libraryOptions.publishable ||
    !libraryOptions.useProjectJson ||
    libraryOptions.isTsSolutionSetup
  ) {
    const packageJsonPath = joinPathFragments(
      libraryOptions.projectRoot,
      'package.json'
    );
    let packageJson = {
      name: libraryOptions.importPath,
      version: '0.0.1',
      peerDependencies: getPeerDependencies(tree),
      ...determineEntryFields(libraryOptions),
      sideEffects: false,
    } as PackageJson;

    if (!libraryOptions.publishable) {
      packageJson.private = true;
    }

    if (libraryOptions.isTsSolutionSetup && libraryOptions.publishable) {
      // package.json and README.md are always included by default
      // https://docs.npmjs.com/cli/v10/configuring-npm/package-json#files
      packageJson.files = ['dist', '!**/*.tsbuildinfo'];
    }

    if (libraryOptions.isTsSolutionSetup) {
      const tsconfigBase = readJson(tree, 'tsconfig.base.json');

      packageJson = getUpdatedPackageJsonContent(packageJson, {
        main: join(libraryOptions.projectRoot, 'src/index.ts'),
        outputPath: joinPathFragments(libraryOptions.projectRoot, 'dist'),
        projectRoot: libraryOptions.projectRoot,
        rootDir: join(libraryOptions.projectRoot, 'src'),
        generateExportsField: true,
        packageJsonPath,
        format: ['esm'],
        skipDevelopmentExports:
          !tsconfigBase.compilerOptions?.customConditions?.includes(
            'development'
          ),
      });
    }

    if (!libraryOptions.useProjectJson) {
      if (libraryOptions.name !== libraryOptions.importPath) {
        packageJson.nx = {
          name: libraryOptions.name,
        };
      }
      if (project.prefix) {
        packageJson.nx ??= {};
        (packageJson.nx as AngularProjectConfiguration).prefix = project.prefix;
      }
      if (Object.keys(project.targets).length) {
        packageJson.nx ??= {};
        packageJson.nx.targets = project.targets;
      }
      if (project.tags?.length) {
        packageJson.nx ??= {};
        packageJson.nx.tags = project.tags;
      }
    }

    writeJson(tree, packageJsonPath, packageJson);
  }

  if (libraryOptions.useProjectJson) {
    addProjectConfiguration(tree, libraryOptions.name, project);
  }
}

function getPeerDependencies(tree: Tree) {
  const version = getInstalledAngularVersion(tree);
  const { major, minor, prerelease } = parse(version);
  const peerDependencyVersion = prerelease
    ? `^${version}`
    : `^${major}.${minor}.0`;

  return {
    '@angular/common': peerDependencyVersion,
    '@angular/core': peerDependencyVersion,
  };
}

function determineEntryFields(
  options: NormalizedSchema['libraryOptions']
): Pick<PackageJson, 'module' | 'types' | 'exports'> {
  if (!options.isTsSolutionSetup) {
    return undefined;
  }

  return {
    module: './src/index.ts',
    types: './src/index.ts',
    exports: {
      '.': {
        types: './src/index.ts',
        import: './src/index.ts',
        default: './src/index.ts',
      },
      './package.json': './package.json',
    },
  };
}
