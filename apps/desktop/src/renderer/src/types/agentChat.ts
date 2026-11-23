import type { ChatProvider, ChatProviderId } from "@shared/agent/chat";

/** One entry in the chat transcript, as the panel shows it. */
export type ChatEntry =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "agent"; text: string }
  /** A Shift call the agent made, such as an edit and its label. */
  | { id: string; kind: "tool"; name: string; summary: string }
  | { id: string; kind: "error"; text: string };

/** The chat as one window holds it. */
export interface AgentChatView {
  providers: readonly ChatProvider[];
  provider: ChatProviderId;
  /** The model picked for the provider; null when it uses its own default. */
  model: string | null;
  entries: readonly ChatEntry[];
  /** Whether a reply is being written now. */
  running: boolean;
  /** Whether agent connections are off, so a message can't reach the font. */
  connectionsOff: boolean;
}
