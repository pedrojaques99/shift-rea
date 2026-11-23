/**
 * The in-app agent chat: a command-line agent the user already signed in to
 * (Claude Code, Codex) runs against this window's font through Shift's own
 * MCP server, and its replies stream back to the window.
 */

/** A command-line agent the chat can run. */
export type ChatProviderId = "claude" | "codex";

/** A provider as the chat lists it. */
export interface ChatProvider {
  id: ChatProviderId;
  /** As people say it: "Claude Code", "Codex". */
  name: string;
  /** Whether its command is on this computer's search path. */
  installed: boolean;
}

/** One message to the agent. */
export interface ChatSendRequest {
  provider: ChatProviderId;
  prompt: string;
  /** The conversation to continue, from an earlier `started` event; null starts one. */
  sessionId: string | null;
}

/** A run the chat started, which `agentChat.stop` can end. */
export interface ChatRun {
  runId: string;
}

/** What a run reports while it works, in order. */
export type ChatEvent =
  /** The agent opened or resumed a conversation, which later messages continue. */
  | { kind: "started"; sessionId: string }
  /** A paragraph of the agent's reply. */
  | { kind: "text"; text: string }
  /** The agent used a tool: a Shift call such as `shift.edits.apply`. */
  | { kind: "tool"; name: string; summary: string }
  /** The run ended; `error` says why when it failed. */
  | { kind: "finished"; ok: boolean; error: string | null; costUsd: number | null };
