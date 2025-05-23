import { cleanupProject, newProject, runCLI, uniq } from '@nx/e2e/utils';

describe('hhhhhhangular-ts-solution', () => {
  let scope: string;

  beforeAll(() => {
    scope = newProject({ preset: 'ts', packages: ['@nx/angular'] });
  });

  afterAll(() => cleanupProject());

  it('should generate applications that work correctly', async () => {
    const appEsbuildJest = uniq('app-esbuild-jest');
    const appEsbuildVitest = uniq('app-esbuild-vitest');
    const appWebpackJest = uniq('app-webpack-jest');
    const appWebpackVitest = uniq('app-webpack-vitest');

    runCLI(
      `generate @nx/angular:app ${appEsbuildJest} --linter=eslint --unitTestRunner=jest`
    );
    runCLI(
      `generate @nx/angular:app ${appEsbuildVitest} --linter=eslint --unitTestRunner=vitest`
    );
    runCLI(
      `generate @nx/angular:app ${appWebpackJest} --bundler=webpack --linter=eslint --unitTestRunner=jest`
    );
    runCLI(
      `generate @nx/angular:app ${appWebpackVitest} --bundler=webpack --linter=eslint --unitTestRunner=vitest`
    );

    expect(runCLI(`build ${appEsbuildJest}`)).toContain(
      `Successfully ran target build for project @${scope}/${appEsbuildJest}`
    );
    expect(runCLI(`lint ${appEsbuildJest}`)).toContain(
      `Successfully ran target lint for project @${scope}/${appEsbuildJest}`
    );
    expect(runCLI(`test ${appEsbuildJest}`)).toContain(
      `Successfully ran target test for project @${scope}/${appEsbuildJest}`
    );

    expect(runCLI(`build ${appEsbuildVitest}`)).toContain(
      `Successfully ran target build for project @${scope}/${appEsbuildVitest}`
    );
    expect(runCLI(`lint ${appEsbuildVitest}`)).toContain(
      `Successfully ran target lint for project @${scope}/${appEsbuildVitest}`
    );
    expect(runCLI(`test ${appEsbuildVitest}`)).toContain(
      `Successfully ran target test for project @${scope}/${appEsbuildVitest}`
    );

    expect(runCLI(`build ${appWebpackJest}`)).toContain(
      `Successfully ran target build for project @${scope}/${appWebpackJest}`
    );
    expect(runCLI(`lint ${appWebpackJest}`)).toContain(
      `Successfully ran target lint for project @${scope}/${appWebpackJest}`
    );
    expect(runCLI(`test ${appWebpackJest}`)).toContain(
      `Successfully ran target test for project @${scope}/${appWebpackJest}`
    );

    expect(runCLI(`build ${appWebpackVitest}`)).toContain(
      `Successfully ran target build for project @${scope}/${appWebpackVitest}`
    );
    expect(runCLI(`lint ${appWebpackVitest}`)).toContain(
      `Successfully ran target lint for project @${scope}/${appWebpackVitest}`
    );
    expect(runCLI(`test ${appWebpackVitest}`)).toContain(
      `Successfully ran target test for project @${scope}/${appWebpackVitest}`
    );
  });
});
