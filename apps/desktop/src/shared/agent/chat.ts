/**
 * The in-app agent chat: a command-line agent the user already signed in to
 * (Claude Code, Codex) runs against this window's font through Shift's own
 * MCP server, and its replies stream back to the window.
 */

/** A command-line agent the chat can run. */
export type ChatProviderId = "claude" | "codex" | "agy" | "opencode" | "api";

/** A model vendor the chat can call with the user's own API key. */
export type ApiVendor = (typeof API_VENDORS)[number];

/** Every vendor that takes the user's own key, in the order Settings lists them. */
export const API_VENDORS = ["anthropic", "openai", "google", "openrouter"] as const;

/** Which vendors have a key stored; the keys themselves never leave main. */
export type ApiKeysState = Record<ApiVendor, boolean>;

/** A provider as the chat lists it. */
export interface ChatProvider {
  id: ChatProviderId;
  /** As people say it: "Claude Code", "Codex". */
  name: string;
  /** Whether its command is on this computer's search path. */
  installed: boolean;
  /**
   * Models the provider offers to choose from, as its CLI lists them; empty
   * when it picks its own (the account's default).
   */
  models: string[];
}

/** One message to the agent. */
export interface ChatSendRequest {
  provider: ChatProviderId;
  prompt: string;
  /** The conversation to continue, from an earlier `started` event; null starts one. */
  sessionId: string | null;
  /** A model from {@link ChatProvider.models}; null uses the provider's default. */
  model: string | null;
  /** Files the user attached, as `agentChat.attach` saved them; the agent may read them. */
  attachments: string[];
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
