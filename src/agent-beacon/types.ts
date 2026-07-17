export type AgentBeaconProvider = 'codex' | 'claude';
export type AgentBeaconStateName = 'running' | 'needs-input' | 'ready' | 'failed';

export interface AgentBeaconState {
  version: 1;
  provider: AgentBeaconProvider;
  state: AgentBeaconStateName;
  workspace: string;
  event: string;
  message: string;
  sessionId: string;
  timestamp: number;
  sourceUri?: string;
}

export interface HookHandler {
  type: string;
  command?: string;
  [key: string]: any;
}

export interface HookGroup {
  matcher?: string;
  hooks: HookHandler[];
  [key: string]: any;
}

export interface HookConfiguration {
  hooks?: { [event: string]: HookGroup[] };
  [key: string]: any;
}
