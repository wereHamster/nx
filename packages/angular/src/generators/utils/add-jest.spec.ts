import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { UnitTestRunner } from '../../utils/test-runners';
import { addJest } from './add-jest';
import { generateTestApplication } from './testing';

describe('addJest', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    await generateTestApplication(tree, {
      name: 'app1',
      directory: 'app1',
      unitTestRunner: UnitTestRunner.None,
      skipFormat: true,
    });
  });

  it('generate the test setup file', async () => {
    await addJest(tree, {
      name: 'app1',
      projectRoot: 'app1',
      skipPackageJson: false,
      strict: false,
      runtimeTsconfigFileName: 'tsconfig.app.json',
    });

    expect(tree.read('app1/src/test-setup.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

      setupZoneTestEnv();
      "
    `);
  });

  it('generate the test setup file with strict', async () => {
    await addJest(tree, {
      name: 'app1',
      projectRoot: 'app1',
      skipPackageJson: false,
      strict: true,
      runtimeTsconfigFileName: 'tsconfig.app.json',
    });

    expect(tree.read('app1/src/test-setup.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

      setupZoneTestEnv({
        errorOnUnknownElements: true,
        errorOnUnknownProperties: true
      });
      "
    `);
  });
});
