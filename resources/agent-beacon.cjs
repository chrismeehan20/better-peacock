'use strict';

// This helper is installed explicitly by Better Peacock. It accepts lifecycle
// hook JSON on stdin and writes a small, non-executable state record to the
// operating system's temporary directory. It never reads conversation text.

const fs = require('fs');
const os = require('os');
const path = require('path');

const provider = String(process.argv[2] || 'agent').toLowerCase();

function hash(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, '0');
}

function findWorkspace(startingDirectory) {
  let current = path.resolve(startingDirectory || process.cwd());
  while (true) {
    if (fs.existsSync(path.join(current, '.git'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(startingDirectory || process.cwd());
    }
    current = parent;
  }
}

function resolveState(input) {
  const event = input.hook_event_name || input.hookEventName || '';
  const notificationType =
    input.notification_type || input.notificationType || input.matcher || '';

  if (event === 'UserPromptSubmit') {
    return 'running';
  }
  if (event === 'PermissionRequest') {
    return 'needs-input';
  }
  if (event === 'StopFailure') {
    return 'failed';
  }
  if (event === 'Stop') {
    return 'ready';
  }
  if (event === 'Notification') {
    if (notificationType === 'agent_completed') {
      return 'ready';
    }
    if (
      notificationType === 'permission_prompt' ||
      notificationType === 'idle_prompt' ||
      notificationType === 'agent_needs_input'
    ) {
      return 'needs-input';
    }
  }
  return undefined;
}

function record(input) {
  const state = resolveState(input);
  if (!state) {
    return;
  }

  const workspace = findWorkspace(input.cwd);
  const sessionId = String(input.session_id || input.sessionId || 'default');
  const directory = path.join(os.tmpdir(), 'better-peacock-agent-beacon');
  const target = path.join(directory, `${hash(`${workspace}|${provider}|${sessionId}`)}.json`);
  const temporary = `${target}.${process.pid}.tmp`;
  const event = input.hook_event_name || input.hookEventName || '';
  const message = input.message || input.notification_message || input.error || '';
  const payload = {
    version: 1,
    provider,
    state,
    workspace,
    event,
    message: typeof message === 'string' ? message.slice(0, 500) : '',
    sessionId,
    timestamp: Date.now(),
  };

  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  try {
    fs.renameSync(temporary, target);
  } catch (_) {
    try {
      fs.unlinkSync(target);
    } catch (_) {
      // The target may not exist yet.
    }
    fs.renameSync(temporary, target);
  }
}

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  input += chunk;
});
process.stdin.on('end', () => {
  try {
    record(input ? JSON.parse(input) : {});
  } catch (_) {
    // Hook integrations must never block or fail an agent turn.
  }
});
