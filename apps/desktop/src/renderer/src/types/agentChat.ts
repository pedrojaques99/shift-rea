import type { ChatProvider, ChatProviderId } from "@shared/agent/chat";

/** One entry in the chat transcript, as the panel shows it. */
export type ChatEntry =
  | { id: string; kind: "user"; text: string; attachments: readonly string[] }
  | { id: string; kind: "agent"; text: string }
  /** A Shift call the agent made, such as an edit and its label. */
  | { id: string; kind: "tool"; name: string; summary: string }
  | { id: string; kind: "error"; text: string };

/** A file attached to the next message, saved where the agent can read it. */
export interface ChatAttachment {
  id: string;
  name: string;
  /** Where the agent finds it. */
  path: string;
  /** An object URL for images, shown as a thumbnail. */
  preview: string | null;
}

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
  /** Files waiting to go with the next message. */
  attachments: readonly ChatAttachment[];
}
