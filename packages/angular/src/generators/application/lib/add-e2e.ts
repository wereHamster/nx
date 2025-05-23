import { Tree, writeJson } from '@nx/devkit';
import {
  addProjectConfiguration,
  ensurePackage,
  getPackageManagerCommand,
  joinPathFragments,
  readNxJson,
} from '@nx/devkit';
import { nxVersion } from '../../../utils/versions';
import type { NormalizedSchema } from './normalized-schema';
import { E2EWebServerDetails } from '@nx/devkit/src/generators/e2e-web-server-info-utils';
import type { PackageJson } from 'nx/src/utils/package-json';

export async function addE2e(tree: Tree, options: NormalizedSchema) {
  // since e2e are separate projects, default to adding plugins
  const nxJson = readNxJson(tree);
  const addPlugin =
    nxJson['useInferencePlugins'] !== false &&
    process.env.NX_ADD_PLUGINS !== 'false';

  const e2eWebServerInfo = getAngularE2EWebServerInfo(
    tree,
    options.name,
    options.port
  );

  const packageJson: PackageJson = {
    name: options.e2eProjectName,
    version: '0.0.1',
    private: true,
  };

  const useProjectJson =
    options.useProjectJson === true ||
    (options.useProjectJson === undefined && options.isTsSolutionSetup);

  if (options.e2eTestRunner === 'cypress') {
    const { configurationGenerator } = ensurePackage<
      typeof import('@nx/cypress')
    >('@nx/cypress', nxVersion);

    if (useProjectJson) {
      packageJson.nx = { implicitDependencies: [options.name] };
    } else {
      addProjectConfiguration(tree, options.e2eProjectName, {
        projectType: 'application',
        root: options.e2eProjectRoot,
        sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
        targets: {},
        tags: [],
        implicitDependencies: [options.name],
      });
    }

    if (useProjectJson || options.isTsSolutionSetup) {
      writeJson(
        tree,
        joinPathFragments(options.e2eProjectRoot, 'package.json'),
        packageJson
      );
    }

    await configurationGenerator(tree, {
      project: options.e2eProjectName,
      directory: 'src',
      linter: options.linter,
      skipPackageJson: options.skipPackageJson,
      skipFormat: true,
      devServerTarget: e2eWebServerInfo.e2eDevServerTarget,
      baseUrl: e2eWebServerInfo.e2eWebServerAddress,
      webServerCommands: {
        default: e2eWebServerInfo.e2eWebServerCommand,
        production: e2eWebServerInfo.e2eCiWebServerCommand,
      },
      ciWebServerCommand: e2eWebServerInfo.e2eCiWebServerCommand,
      ciBaseUrl: e2eWebServerInfo.e2eCiBaseUrl,
      rootProject: options.rootProject,
      addPlugin,
    });
  } else if (options.e2eTestRunner === 'playwright') {
    const { configurationGenerator } = ensurePackage<
      typeof import('@nx/playwright')
    >('@nx/playwright', nxVersion);

    if (useProjectJson) {
      packageJson.nx = { implicitDependencies: [options.name] };
    } else {
      addProjectConfiguration(tree, options.e2eProjectName, {
        projectType: 'application',
        root: options.e2eProjectRoot,
        sourceRoot: joinPathFragments(options.e2eProjectRoot, 'src'),
        targets: {},
        implicitDependencies: [options.name],
      });
    }

    if (useProjectJson || options.isTsSolutionSetup) {
      writeJson(
        tree,
        joinPathFragments(options.e2eProjectRoot, 'package.json'),
        packageJson
      );
    }

    await configurationGenerator(tree, {
      project: options.e2eProjectName,
      skipFormat: true,
      skipPackageJson: options.skipPackageJson,
      directory: 'src',
      js: false,
      linter: options.linter,
      setParserOptionsProject: options.setParserOptionsProject,
      webServerCommand: e2eWebServerInfo.e2eWebServerCommand,
      webServerAddress: e2eWebServerInfo.e2eWebServerAddress,
      rootProject: options.rootProject,
      addPlugin,
    });
  }

  return e2eWebServerInfo.e2ePort;
}

function getAngularE2EWebServerInfo(
  tree: Tree,
  projectName: string,
  portOverride: number
): E2EWebServerDetails & { e2ePort: number } {
  const nxJson = readNxJson(tree);
  let e2ePort = portOverride ?? 4200;

  if (
    nxJson.targetDefaults?.['serve'] &&
    (nxJson.targetDefaults?.['serve'].options?.port ||
      nxJson.targetDefaults?.['serve'].options?.env?.PORT)
  ) {
    e2ePort =
      nxJson.targetDefaults?.['serve'].options?.port ||
      nxJson.targetDefaults?.['serve'].options?.env?.PORT;
  }

  const pm = getPackageManagerCommand();
  return {
    e2eCiBaseUrl: 'http://localhost:4200',
    e2eCiWebServerCommand: `${pm.exec} nx run ${projectName}:serve-static`,
    e2eWebServerCommand: `${pm.exec} nx run ${projectName}:serve`,
    e2eWebServerAddress: `http://localhost:${e2ePort}`,
    e2eDevServerTarget: `${projectName}:serve`,
    e2ePort,
  };
}
