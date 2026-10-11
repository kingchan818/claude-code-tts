// What the band above the prompt shows; empty means the voice is idle.
export type Status = string

declare module 'claude-code' {
  interface PluginState {
    'read-aloud': { status: Status }
  }
}
