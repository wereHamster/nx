import {
  addDependenciesToPackageJson,
  formatFiles,
  type GeneratorCallback,
  installPackagesTask,
  readNxJson,
  readProjectConfiguration,
  runTasksInSerial,
  type Tree,
} from '@nx/devkit';
import { logShowProjectCommand } from '@nx/devkit/src/utils/log-show-project-command';
import { initGenerator as jsInitGenerator } from '@nx/js';
import {
  addReleaseConfigForNonTsSolution,
  addReleaseConfigForTsSolution,
  releaseTasks,
} from '@nx/js/src/generators/library/utils/add-release-config';
import { sortPackageJsonFields } from '@nx/js/src/utils/package-json/sort-fields';
import { addProjectToTsSolutionWorkspace } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { shouldUseLegacyVersioning } from 'nx/src/command-line/release/config/use-legacy-versioning';
import { angularInitGenerator } from '../../generators/init/init';
import { UnitTestRunner } from '../../utils/test-runners';
import { addLintingGenerator } from '../add-linting/add-linting';
import { setupTailwindGenerator } from '../setup-tailwind/setup-tailwind';
import { addJest } from '../utils/add-jest';
import { addVitest } from '../utils/add-vitest';
import { addBuildableLibrariesPostCssDependencies } from '../utils/dependencies';
import { ensureAngularDependencies } from '../utils/ensure-angular-dependencies';
import { versions } from '../utils/version-utils';
import { addModule } from './lib/add-module';
import { addProject } from './lib/add-project';
import { addStandaloneComponent } from './lib/add-standalone-component';
import { createFiles } from './lib/create-files';
import { normalizeOptions } from './lib/normalize-options';
import type { NormalizedSchema } from './lib/normalized-schema';
import { setGeneratorDefaults } from './lib/set-generator-defaults';
import { updateTsConfigFiles } from './lib/update-tsconfig-files';
import type { Schema } from './schema';

export async function libraryGenerator(
  tree: Tree,
  schema: Schema
): Promise<GeneratorCallback> {
  // Do some validation checks
  if (!schema.routing && schema.lazy) {
    throw new Error(`To use "--lazy" option, "--routing" must also be set.`);
  }

  if (schema.addTailwind && !schema.buildable && !schema.publishable) {
    throw new Error(
      `To use "--addTailwind" option, you have to set either "--buildable" or "--publishable".`
    );
  }

  const options = await normalizeOptions(tree, schema);
  const { libraryOptions } = options;

  const pkgVersions = versions(tree);

  await jsInitGenerator(tree, {
    ...libraryOptions,
    js: false,
    skipFormat: true,
  });
  await angularInitGenerator(tree, { ...libraryOptions, skipFormat: true });

  if (!libraryOptions.skipPackageJson) {
    ensureAngularDependencies(tree);
  }

  addProject(tree, libraryOptions);

  // If we are using the new TS solution
  // We need to update the workspace file (package.json or pnpm-workspaces.yaml) to include the new project
  if (libraryOptions.isTsSolutionSetup) {
    await addProjectToTsSolutionWorkspace(tree, libraryOptions.projectRoot);
  }

  createFiles(tree, options);
  await addUnitTestRunner(tree, libraryOptions);
  updateTsConfigFiles(tree, libraryOptions);
  setGeneratorDefaults(tree, options);

  if (!libraryOptions.standalone) {
    addModule(tree, libraryOptions);
  } else {
    await addStandaloneComponent(tree, options);
  }

  await addLinting(tree, libraryOptions);

  const project = readProjectConfiguration(tree, libraryOptions.name);
  if (libraryOptions.addTailwind) {
    await setupTailwindGenerator(tree, {
      project: libraryOptions.name,
      skipFormat: true,
      skipPackageJson: libraryOptions.skipPackageJson,
    });
  }

  if (libraryOptions.publishable) {
    if (libraryOptions.isTsSolutionSetup) {
      await addReleaseConfigForTsSolution(tree, libraryOptions.name, project);
    } else {
      const nxJson = readNxJson(tree);
      await addReleaseConfigForNonTsSolution(
        shouldUseLegacyVersioning(nxJson.release),
        tree,
        libraryOptions.name,
        project
      );
    }
  }

  if (
    (libraryOptions.buildable || libraryOptions.publishable) &&
    !libraryOptions.skipPackageJson
  ) {
    addDependenciesToPackageJson(
      tree,
      {},
      {
        'ng-packagr': pkgVersions.ngPackagrVersion,
      },
      undefined,
      true
    );
    addBuildableLibrariesPostCssDependencies(tree);
  }

  sortPackageJsonFields(tree, libraryOptions.projectRoot);

  if (!libraryOptions.skipFormat) {
    await formatFiles(tree);
  }

  const tasks: GeneratorCallback[] = [
    () => installPackagesTask(tree, libraryOptions.isTsSolutionSetup),
  ];
  if (libraryOptions.publishable) {
    tasks.push(await releaseTasks(tree));
  }
  tasks.push(() => logShowProjectCommand(libraryOptions.name));

  return runTasksInSerial(...tasks);
}

async function addUnitTestRunner(
  host: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  switch (options.unitTestRunner) {
    case UnitTestRunner.Jest:
      await addJest(host, {
        name: options.name,
        projectRoot: options.projectRoot,
        skipPackageJson: options.skipPackageJson,
        strict: options.strict,
        runtimeTsconfigFileName: 'tsconfig.lib.json',
      });
      break;
    case UnitTestRunner.Vitest:
      await addVitest(host, {
        name: options.name,
        projectRoot: options.projectRoot,
        skipPackageJson: options.skipPackageJson,
        strict: options.strict,
      });
      break;
  }
}

async function addLinting(
  host: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  if (options.linter === 'none') {
    return;
  }
  await addLintingGenerator(host, {
    projectName: options.name,
    projectRoot: options.projectRoot,
    prefix: options.prefix,
    unitTestRunner: options.unitTestRunner,
    setParserOptionsProject: options.setParserOptionsProject,
    skipFormat: true,
    skipPackageJson: options.skipPackageJson,
  });
}

export default libraryGenerator;
