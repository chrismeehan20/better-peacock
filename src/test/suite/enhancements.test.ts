import * as assert from 'assert';
import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { addAgentBeaconHooks, AgentBeaconState, removeAgentBeaconHooks } from '../../agent-beacon';
import { selectPrimaryAgentState } from '../../agent-beacon';
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

  test('adds Claude-specific notification and failure hooks', () => {
    const configuration = addAgentBeaconHooks(
      {},
      'claude',
      '/home/me/.better-peacock/agent-beacon.cjs',
    );
    assert.ok(configuration.hooks && configuration.hooks.Notification);
    assert.ok(configuration.hooks && configuration.hooks.StopFailure);
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
