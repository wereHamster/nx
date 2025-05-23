import type { Tree } from '@nx/devkit';
import {
  generateFiles,
  joinPathFragments,
  names,
  offsetFromRoot,
} from '@nx/devkit';
import { getRootTsConfigFileName } from '@nx/js';
import { UnitTestRunner } from '../../../utils/test-runners';
import type { NormalizedSchema } from './normalized-schema';

export function createFiles(tree: Tree, options: NormalizedSchema) {
  const rootOffset = offsetFromRoot(options.libraryOptions.projectRoot);
  const libNames = names(options.libraryOptions.fileName);
  const pathToComponent = options.componentOptions.flat
    ? options.libraryOptions.fileName
    : joinPathFragments(
        options.libraryOptions.fileName,
        options.libraryOptions.fileName
      );

  const componentType = options.componentOptions.type
    ? names(options.componentOptions.type).className
    : '';
  const componentFileSuffix = options.componentOptions.type
    ? `.${options.componentOptions.type}`
    : '';

  const substitutions = {
    libName: options.libraryOptions.name,
    libFileName: options.libraryOptions.fileName,
    libClassName: libNames.className,
    libPropertyName: libNames.propertyName,
    unitTesting: options.libraryOptions.unitTestRunner !== UnitTestRunner.None,
    rootTsConfig: joinPathFragments(rootOffset, getRootTsConfigFileName(tree)),
    skipModule: options.libraryOptions.skipModule,
    projectRoot: options.libraryOptions.projectRoot,
    routing: options.libraryOptions.routing,
    pathToComponent,
    importPath: options.libraryOptions.importPath,
    rootOffset,
    isTsSolutionSetup: options.libraryOptions.isTsSolutionSetup,
    componentType,
    componentFileSuffix,
    moduleTypeSeparator: options.libraryOptions.moduleTypeSeparator,
    tpl: '',
  };

  generateFiles(
    tree,
    joinPathFragments(__dirname, '../files/base'),
    options.libraryOptions.projectRoot,
    substitutions
  );

  generateFiles(
    tree,
    options.libraryOptions.isTsSolutionSetup
      ? joinPathFragments(__dirname, '../files/tsconfig/ts-solution')
      : joinPathFragments(__dirname, '../files/tsconfig/non-ts-solution'),
    options.libraryOptions.projectRoot,
    substitutions
  );

  if (options.libraryOptions.standalone) {
    generateFiles(
      tree,
      joinPathFragments(__dirname, '../files/standalone-components'),
      options.libraryOptions.projectRoot,
      substitutions
    );
  } else {
    generateFiles(
      tree,
      joinPathFragments(__dirname, '../files/ng-module'),
      options.libraryOptions.projectRoot,
      substitutions
    );

    if (options.libraryOptions.skipModule) {
      tree.delete(options.libraryOptions.modulePath);
    }
  }

  if (!options.libraryOptions.routing) {
    tree.delete(
      joinPathFragments(
        options.libraryOptions.projectRoot,
        'src/lib/lib.routes.ts'
      )
    );
  }

  if (
    !options.libraryOptions.buildable &&
    !options.libraryOptions.publishable
  ) {
    tree.delete(
      joinPathFragments(
        options.libraryOptions.projectRoot,
        `tsconfig.lib.prod.json`
      )
    );
    tree.delete(
      joinPathFragments(options.libraryOptions.projectRoot, `ng-package.json`)
    );
  }
}
