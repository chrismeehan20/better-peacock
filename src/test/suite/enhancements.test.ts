import * as assert from 'assert';
import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { addAgentBeaconHooks, AgentBeaconState, removeAgentBeaconHooks } from '../../agent-beacon';
import { selectPrimaryAgentState } from '../../agent-beacon';
import {
  AgentBeaconLivenessState,
  evaluateHookLiveness,
  forgetInstall,
  hookSettleMilliseconds,
  recordHookEvent,
  recordInstall,
  recordWarning,
} from '../../agent-beacon';
import { nodeExecutableCandidates } from '../../agent-beacon';
import {
  environmentPatternMatches,
  resolveEnvironmentGuardrail,
} from '../../environment-guardrails';
import { summarizeGitRisk } from '../../git-risk';

suite('Better Peacock Enhancements', () => {
  test('hook helper records state without reading project files', () => {
    const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'better-peacock-test-'));
    try {
      const project = path.join(temporary, 'project');
      fs.mkdirSync(path.join(project, '.git'), { recursive: true });
      const helper = path.resolve(__dirname, '../../../resources/agent-beacon.cjs');
      childProcess.execFileSync(process.execPath, [helper, 'codex'], {
        input: JSON.stringify({
          hook_event_name: 'PermissionRequest',
          cwd: project,
          session_id: 'test-session',
        }),
        env: { ...process.env, TMPDIR: temporary },
      });
      const stateDirectory = path.join(temporary, 'better-peacock-agent-beacon');
      const files = fs.readdirSync(stateDirectory);
      assert.equal(files.length, 1);
      const state = JSON.parse(fs.readFileSync(path.join(stateDirectory, files[0]), 'utf8'));
      assert.equal(state.provider, 'codex');
      assert.equal(state.state, 'needs-input');
      assert.equal(state.workspace, project);
      assert.equal(state.sessionId, 'test-session');
    } finally {
      const fileSystem = fs as typeof fs & {
        rmSync?: (target: string, options: { recursive: boolean; force: boolean }) => void;
      };
      if (fileSystem.rmSync) {
        fileSystem.rmSync(temporary, { recursive: true, force: true });
      } else {
        fs.rmdirSync(temporary, { recursive: true });
      }
    }
  });

  test('merges and removes Agent Beacon hooks without touching existing hooks', () => {
    const existing = {
      hooks: {
        Stop: [
          {
            hooks: [{ type: 'command', command: 'node existing-hook.cjs' }],
          },
        ],
      },
      theme: 'dark',
    };
    const once = addAgentBeaconHooks(
      existing,
      'codex',
      '/home/me/.better-peacock/agent-beacon.cjs',
    );
    const twice = addAgentBeaconHooks(once, 'codex', '/home/me/.better-peacock/agent-beacon.cjs');
    const serialized = JSON.stringify(twice);
    assert.equal((serialized.match(/better-peacock\/agent-beacon\.cjs/g) || []).length, 3);
    assert.ok(serialized.includes('existing-hook.cjs'));
    assert.equal(twice.theme, 'dark');

    const removed = removeAgentBeaconHooks(twice);
    assert.ok(JSON.stringify(removed).includes('existing-hook.cjs'));
    assert.ok(!JSON.stringify(removed).includes('better-peacock/agent-beacon.cjs'));
  });

  test('quotes an absolute Node path into the hook command', () => {
    const configuration = addAgentBeaconHooks(
      {},
      'codex',
      '/home/me/.better-peacock/agent-beacon.cjs',
      '/home/me/.nvm/versions/node/v22.18.0/bin/node',
    );
    const command =
      configuration.hooks &&
      configuration.hooks.Stop &&
      configuration.hooks.Stop[0].hooks[0].command;
    // The absolute path is what makes the hook independent of the PATH the
    // agent launched with.
    assert.equal(
      command,
      '"/home/me/.nvm/versions/node/v22.18.0/bin/node" "/home/me/.better-peacock/agent-beacon.cjs" codex',
    );
  });

  test('still recognizes its own hooks when the Node path changes', () => {
    const installed = addAgentBeaconHooks(
      {},
      'codex',
      '/home/me/.better-peacock/agent-beacon.cjs',
      '/usr/local/bin/node',
    );
    // A Node upgrade changes the command string; removal keys off the helper
    // path, so uninstall must still find it.
    const removed = removeAgentBeaconHooks(
      addAgentBeaconHooks(
        installed,
        'codex',
        '/home/me/.better-peacock/agent-beacon.cjs',
        '/opt/homebrew/bin/node',
      ),
    );
    assert.ok(!JSON.stringify(removed).includes('agent-beacon.cjs'));
  });

  test('prefers PATH for Node and falls back to common install directories', () => {
    const candidates = nodeExecutableCandidates(
      '/home/me/.nvm/versions/node/v22.18.0/bin:/usr/bin',
      'darwin',
      '/home/me',
    );
    assert.equal(candidates[0], '/home/me/.nvm/versions/node/v22.18.0/bin/node');
    assert.ok(candidates.includes('/usr/bin/node'));
    assert.ok(candidates.includes('/opt/homebrew/bin/node'));
    assert.ok(candidates.includes('/home/me/.volta/bin/node'));
    // Duplicates would mean redundant stat calls on every install.
    assert.equal(new Set(candidates).size, candidates.length);
  });

  test('builds Windows Node candidates with the right separators', () => {
    const candidates = nodeExecutableCandidates(
      'C:\\tools\\node;C:\\Windows\\System32',
      'win32',
      'C:\\Users\\me',
    );
    assert.equal(candidates[0], 'C:\\tools\\node\\node.exe');
    assert.ok(candidates.includes('C:\\Program Files\\nodejs\\node.exe'));
    assert.ok(candidates.every(candidate => candidate.endsWith('node.exe')));
  });

  test('tolerates an empty or missing PATH', () => {
    assert.ok(nodeExecutableCandidates(undefined, 'linux', undefined).includes('/usr/bin/node'));
    assert.ok(nodeExecutableCandidates('', 'linux', undefined).length > 0);
    assert.ok(nodeExecutableCandidates('::', 'linux', undefined).every(entry => entry.length > 1));
  });

  test('adds Claude-specific notification and failure hooks', () => {
    const configuration = addAgentBeaconHooks(
      {},
      'claude',
      '/home/me/.better-peacock/agent-beacon.cjs',
    );
    assert.ok(configuration.hooks && configuration.hooks.Notification);
    assert.ok(configuration.hooks && configuration.hooks.StopFailure);
  });

  test('treats installed hooks as unproven until an event arrives', () => {
    const state = recordInstall({}, 'codex', 1000);
    assert.equal(evaluateHookLiveness({}, 'codex', undefined), 'not-installed');
    // No evidence the agent ran, so silence says nothing either way.
    assert.equal(evaluateHookLiveness(state, 'codex', undefined), 'awaiting-first-event');
    assert.equal(evaluateHookLiveness(state, 'codex', 500), 'awaiting-first-event');
  });

  test('reports silent hooks when the agent ran after installation without firing', () => {
    // The real failure this guards against: Codex hooks written to
    // ~/.codex/hooks.json but never trusted, so a full session produces
    // no hook events at all while installation looks successful.
    const state = recordInstall({}, 'codex', 1000);
    const ranLater = 1000 + hookSettleMilliseconds + 1;
    assert.equal(evaluateHookLiveness(state, 'codex', ranLater), 'silent');

    const fired = recordHookEvent(state, 'codex', 1500);
    assert.equal(evaluateHookLiveness(fired, 'codex', ranLater), 'live');
  });

  test('does not blame hooks for a session that straddles installation', () => {
    const state = recordInstall({}, 'codex', 1000);
    assert.equal(
      evaluateHookLiveness(state, 'codex', 1000 + hookSettleMilliseconds - 1),
      'awaiting-first-event',
    );
  });

  test('tracks hook liveness per provider', () => {
    let state: AgentBeaconLivenessState = recordInstall({}, 'codex', 1000);
    state = recordInstall(state, 'claude', 1000);
    state = recordHookEvent(state, 'claude', 2000);
    const ranLater = 1000 + hookSettleMilliseconds + 1;
    assert.equal(evaluateHookLiveness(state, 'claude', ranLater), 'live');
    assert.equal(evaluateHookLiveness(state, 'codex', ranLater), 'silent');
  });

  test('reinstalling clears a past warning and invalidates earlier hook events', () => {
    let state: AgentBeaconLivenessState = recordInstall({}, 'codex', 1000);
    state = recordHookEvent(state, 'codex', 1500);
    state = recordWarning(state, 'codex');
    assert.deepEqual(state.warnedFor, ['codex']);

    // Reinstalling rewrites the definitions, so Codex trust and therefore
    // liveness must be proven again rather than inherited.
    state = recordInstall(state, 'codex', 3000);
    assert.deepEqual(state.warnedFor, []);
    assert.equal(evaluateHookLiveness(state, 'codex', 3000 + hookSettleMilliseconds + 1), 'silent');
  });

  test('ignores out-of-order hook event timestamps', () => {
    let state: AgentBeaconLivenessState = recordHookEvent({}, 'codex', 2000);
    state = recordHookEvent(state, 'codex', 1000);
    assert.equal(state.lastHookEventAt && state.lastHookEventAt.codex, 2000);
  });

  test('only an unproven install can become silent', () => {
    // The poll loop skips the session-file scan unless the cheap check with no
    // activity returns 'awaiting-first-event', so that result must be a
    // precondition for 'silent' or a real fault would be skipped.
    const cases: AgentBeaconLivenessState[] = [
      {},
      recordInstall({}, 'codex', 1000),
      recordHookEvent(recordInstall({}, 'codex', 1000), 'codex', 2000),
      recordHookEvent({}, 'codex', 2000),
    ];
    cases.forEach(state => {
      const withoutActivity = evaluateHookLiveness(state, 'codex', undefined);
      const withActivity = evaluateHookLiveness(state, 'codex', 9_999_999);
      if (withActivity === 'silent') {
        assert.equal(withoutActivity, 'awaiting-first-event');
      }
    });
  });

  test('forgetting an install leaves other providers intact', () => {
    let state: AgentBeaconLivenessState = recordInstall({}, 'codex', 1000);
    state = recordInstall(state, 'claude', 1000);
    state = recordHookEvent(state, 'claude', 1500);
    state = forgetInstall(state, 'codex');
    assert.equal(evaluateHookLiveness(state, 'codex', 9999), 'not-installed');
    assert.equal(evaluateHookLiveness(state, 'claude', 9999), 'live');
  });

  test('selects the highest-priority agent state for the current workspace', () => {
    const base = {
      version: 1 as const,
      provider: 'codex' as const,
      workspace: '/work/project',
      event: 'Stop',
      message: '',
      sessionId: 'one',
      timestamp: 100,
    };
    const states: AgentBeaconState[] = [
      { ...base, state: 'ready' },
      { ...base, state: 'needs-input', provider: 'claude', sessionId: 'two', timestamp: 90 },
      { ...base, state: 'failed', workspace: '/work/other' },
    ];
    const selected = selectPrimaryAgentState(states, ['/work/project']);
    assert.equal(selected && selected.state, 'needs-input');
    assert.equal(selected && selected.provider, 'claude');
  });

  test('summarizes only meaningful Git risk', () => {
    assert.equal(
      summarizeGitRisk({ changes: 0, conflicts: 0, ahead: 0, behind: 0 }, 2).visible,
      false,
    );
    const summary = summarizeGitRisk({ changes: 3, conflicts: 1, ahead: 1, behind: 4 }, 2);
    assert.ok(summary.visible);
    assert.ok(summary.text.includes('$(warning) 1'));
    assert.ok(summary.text.includes('$(diff) 3'));
    assert.ok(!summary.text.includes('↑1'));
    assert.ok(summary.text.includes('↓4'));
  });

  test('matches explicit environment guardrails case-insensitively', () => {
    assert.ok(environmentPatternMatches('*prod*', 'SSH-REMOTE+Production-East'));
    const match = resolveEnvironmentGuardrail(
      [{ name: 'Production', pattern: '*prod*', target: 'remote', severity: 'error' }],
      {
        workspace: ['project'],
        remote: ['ssh-remote+production-east'],
        branch: ['main'],
        gitRemote: ['github.com/example/project'],
      },
    );
    assert.equal(match && match.rule.name, 'Production');
    assert.equal(match && match.target, 'remote');
  });
});
