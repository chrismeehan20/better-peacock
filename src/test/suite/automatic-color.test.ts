import * as assert from 'assert';
import { applyColor } from '../../apply-color';
import { branchPatternMatches, resolveBranchColor } from '../../automatic-color/branch';
import { hashToColor, normalizeGitRemote } from '../../automatic-color/hash';
import { applyPaletteStrategy, dominantColorFromPixels } from '../../automatic-color/icon';
import { getColorCustomizationConfig } from '../../configuration';
import { azureBlue, ColorSettings, IPeacockSettings, peacockGreen } from '../../models';
import { isValidColorInput } from '../../color-library';
import { setupTest, setupTestSuite, teardownTestSuite } from './lib/setup-teardown-test-suite';

suite('Automatic Colors', () => {
  const originalValues = {} as IPeacockSettings;

  suiteSetup(async () => await setupTestSuite(originalValues));
  suiteTeardown(async () => await teardownTestSuite(originalValues));
  setup(async () => await setupTest());

  test('normalizes HTTPS and SSH remotes to the same identity', () => {
    const https = normalizeGitRemote('https://github.com/OpenAI/example.git');
    const ssh = normalizeGitRemote('git@github.com:OpenAI/example.git');
    assert.equal(https, 'github.com/openai/example');
    assert.equal(https, ssh);
  });

  test('creates a stable valid color from an identity', () => {
    const first = hashToColor('github.com/openai/example');
    const second = hashToColor('github.com/openai/example');
    assert.equal(first, second);
    assert.ok(isValidColorInput(first));
    assert.notEqual(first, hashToColor('github.com/openai/another-example'));
  });

  test('matches exact and glob branch rules', () => {
    assert.ok(branchPatternMatches('release/*', 'release/2026.07'));
    assert.ok(!branchPatternMatches('release/*', 'feature/release-notes'));
    assert.equal(resolveBranchColor('main', { '*': peacockGreen, main: azureBlue }), azureBlue);
    assert.equal(resolveBranchColor('release/1.0', { 'release/*': peacockGreen }), peacockGreen);
  });

  test('extracts a colorful dominant pixel while ignoring transparency and white', () => {
    const pixels = new Uint8Array([
      255, 255, 255, 255, 255, 255, 255, 255, 220, 20, 60, 255, 220, 20, 60, 255, 0, 0, 255, 0,
    ]);
    assert.equal(dominantColorFromPixels(pixels), '#dc143c');
  });

  test('supports image palette strategies', () => {
    assert.equal(applyPaletteStrategy('#336699', 'dominant'), '#336699');
    assert.notEqual(applyPaletteStrategy('#336699', 'pastel'), '#336699');
    assert.notEqual(applyPaletteStrategy('#336699', 'vibrant'), '#336699');
  });

  test('overrides only the status bar for a protected branch', async () => {
    await applyColor(peacockGreen, { statusBarColor: azureBlue });
    const colors = getColorCustomizationConfig();
    assert.equal(colors[ColorSettings.statusBar_background], azureBlue);
    assert.equal(colors[ColorSettings.titleBar_activeBackground], peacockGreen);
  });
});
