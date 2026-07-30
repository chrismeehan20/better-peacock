import * as path from 'path';

import { runTests } from '@vscode/test-electron';

import { instrument } from './coverage';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to test runner
    // Passed to --extensionTestsPath
    let extensionTestsPath = path.resolve(__dirname, './suite/index');

    if (process.argv.indexOf('--coverage') >= 0) {
      // generate instrumented files at out-cov
      instrument();

      // load the instrumented files
      extensionTestsPath = path.resolve(__dirname, '../../out-cov/test/suite/index');

      // signal that the coverage data should be gathered
      process.env['GENERATE_COVERAGE'] = '1';
    }

    // Download VS Code, unzip it and run the integration test
    await runTests({
      // Pin a modern compatible host so extension API behavior is reproducible.
      version: '1.85.2',
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        path.resolve(extensionDevelopmentPath, 'testworkspace'),
        '--disable-extensions',
        '--user-data-dir',
        path.resolve(extensionDevelopmentPath, '.vscode-test', 'user-data'),
        '--extensions-dir',
        path.resolve(extensionDevelopmentPath, '.vscode-test', 'extensions'),
      ],
    });
  } catch (err) {
    console.error('Failed to run tests', err instanceof Error ? err.stack : err);
    process.exit(1);
  }
}

main();
