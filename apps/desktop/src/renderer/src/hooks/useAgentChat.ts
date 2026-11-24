import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatEvent, ChatProvider, ChatProviderId, ChatRecord } from "@shared/agent/chat";
import { getShiftHost } from "@/host/shiftHost";
import { useAgentConnections } from "@/hooks/useAgentConnections";
import type { AgentChatView, ChatAttachment, ChatEntry } from "@/types/agentChat";

/** What the chat panel can do. */
export interface AgentChatActions {
  /** Sends `text`; `focus` names what the user has open, for the agent only. */
  send(text: string, focus?: string | null): Promise<void>;
  attachFiles(files: readonly File[]): Promise<void>;
  removeAttachment(id: string): void;
  stop(): Promise<void>;
  /** Starts a fresh conversation with the current provider. */
  reset(): void;
  setProvider(provider: ChatProviderId): void;
  setModel(model: string | null): void;
  allowConnections(): Promise<void>;
}

const MODEL_STORAGE_KEY = "shift:agent-chat-models";

/** The model the user last picked for each provider, kept on this computer. */
function storedModels(): Partial<Record<ChatProviderId, string>> {
  try {
    return JSON.parse(window.localStorage.getItem(MODEL_STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function storeModel(provider: ChatProviderId, model: string | null): void {
  try {
    const models = storedModels();
    if (model) models[provider] = model;
    else delete models[provider];
    window.localStorage.setItem(MODEL_STORAGE_KEY, JSON.stringify(models));
  } catch {
    // Without storage the pick lasts for this session.
  }
}

/** The model to start with: the user's last pick, else an OpenCode Go model, else the default. */
function initialModel(provider: ChatProvider | undefined): string | null {
  if (!provider || provider.models.length === 0) return null;

  const stored = storedModels()[provider.id];
  if (stored && provider.models.includes(stored)) return stored;

  return provider.models.find((model) => model.startsWith("opencode-go/")) ?? null;
}

let entryCount = 0;
function entryId(): string {
  entryCount += 1;
  return `chat-${entryCount}`;
}

/**
 * One window's agent chat: sends messages to the chosen command-line agent
 * and folds its streamed events into a transcript.
 *
 * @remarks
 * Each provider keeps its own conversation, continued by the session id its
 * first reply reports, until {@link AgentChatActions.reset}.
 */
export function useAgentChat(conversation: string | null): AgentChatView & AgentChatActions {
  const connections = useAgentConnections();
  const [providers, setProviders] = useState<readonly ChatProvider[]>([]);
  const [provider, setProviderId] = useState<ChatProviderId>("claude");
  const [model, setModelState] = useState<string | null>(null);
  const [entries, setEntries] = useState<readonly ChatEntry[]>([]);
  const [attachments, setAttachments] = useState<readonly ChatAttachment[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  // Session ids are read only when sending, never rendered.
  const sessions = useRef<Partial<Record<ChatProviderId, string>>>({});
  // A run can report before `send` resolves with its id: hold those events.
  const early = useRef(new Map<string, ChatEvent[]>());
  const activeRun = useRef<string | null>(null);

  // The document's conversation, as kept on disk, comes back when the panel opens.
  useEffect(() => {
    if (!conversation) return;

    let live = true;
    const restore = async () => {
      const history = await getShiftHost().agentChat.history(conversation);
      if (!live) return;

      sessions.current = { ...history.sessions };
      setEntries(entriesFrom(history.records));
    };
    void restore();
    return () => {
      live = false;
    };
  }, [conversation]);

  useEffect(() => {
    let live = true;
    const load = async () => {
      const list = await getShiftHost().agentChat.providers();
      if (!live) return;

      setProviders(list);
      const firstInstalled = list.find(({ installed }) => installed);
      if (!firstInstalled) return;

      setProviderId(firstInstalled.id);
      setModelState(initialModel(firstInstalled));
    };
    void load();
    return () => {
      live = false;
    };
  }, []);

  const receive = useCallback(
    (event: ChatEvent) => {
      applyEvent(event, provider, sessions.current, setEntries);
      if (event.kind !== "finished") return;

      activeRun.current = null;
      setRunId(null);
    },
    [provider],
  );

  useEffect(
    () =>
      getShiftHost().agentChat.onEvent(({ runId: eventRunId, event }) => {
        if (eventRunId === activeRun.current) {
          receive(event);
          return;
        }
        const held = early.current.get(eventRunId) ?? [];
        early.current.set(eventRunId, [...held, event]);
      }),
    [receive],
  );

  const send = useCallback(
    async (text: string, focus: string | null = null) => {
      const prompt = text.trim();
      if ((!prompt && attachments.length === 0) || runId) return;

      const sent = attachments;
      setAttachments([]);
      setEntries((list) => [
        ...list,
        { id: entryId(), kind: "user", text: prompt, attachments: sent.map(({ name }) => name) },
      ]);
      try {
        const run = await getShiftHost().agentChat.send({
          provider,
          prompt,
          sessionId: sessions.current[provider] ?? null,
          model,
          attachments: sent.map(({ path }) => path),
          focus,
          conversation,
        });
        activeRun.current = run.runId;
        setRunId(run.runId);
        const held = early.current.get(run.runId) ?? [];
        early.current.delete(run.runId);
        for (const event of held) receive(event);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setEntries((list) => [...list, { id: entryId(), kind: "error", text: message }]);
      }
    },
    [provider, model, runId, receive, attachments, conversation],
  );

  const stop = useCallback(async () => {
    if (!runId) return;

    await getShiftHost().agentChat.stop(runId);
    activeRun.current = null;
    setRunId(null);
  }, [runId]);

  const reset = useCallback(() => {
    sessions.current = {};
    setEntries([]);
    if (conversation) void getShiftHost().agentChat.reset(conversation);
  }, [conversation]);

  const attachFiles = useCallback(async (files: readonly File[]) => {
    for (const file of files) {
      try {
        const data = new Uint8Array(await file.arrayBuffer());
        const path = await getShiftHost().agentChat.attach(file.name, data);
        const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
        setAttachments((list) => [...list, { id: entryId(), name: file.name, path, preview }]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setEntries((list) => [...list, { id: entryId(), kind: "error", text: message }]);
      }
    }
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments((list) => list.filter((attachment) => attachment.id !== id));
  }, []);

  const setProvider = useCallback(
    (next: ChatProviderId) => {
      setProviderId(next);
      setModelState(initialModel(providers.find(({ id }) => id === next)));
    },
    [providers],
  );

  const setModel = useCallback(
    (next: string | null) => {
      setModelState(next);
      storeModel(provider, next);
    },
    [provider],
  );

  const allowConnections = useCallback(async () => {
    await getShiftHost().agentConnections.setAllowed(true);
  }, []);

  return {
    providers,
    provider,
    model,
    entries,
    running: runId !== null,
    connectionsOff: connections !== null && connections.status !== "listening",
    attachments,
    attachFiles,
    removeAttachment,
    send,
    stop,
    reset,
    setProvider,
    setModel,
    allowConnections,
  };
}

/** The last part of a path, on Windows or anywhere else. */
function fileName(file: string): string {
  const parts = file.replaceAll(String.fromCharCode(92), "/").split("/");
  return parts.at(-1) || file;
}

/** The transcript a conversation's records show, as the live chat would have built it. */
function entriesFrom(records: readonly ChatRecord[]): ChatEntry[] {
  return records.flatMap((record): ChatEntry[] => {
    switch (record.kind) {
      case "user":
        return [
          {
            id: entryId(),
            kind: "user",
            text: record.text,
            attachments: record.attachments.map(fileName),
          },
        ];
      case "reset":
        return [];
      case "event": {
        const { event } = record;
        switch (event.kind) {
          case "text":
            return [{ id: entryId(), kind: "agent", text: event.text }];
          case "tool":
            return [{ id: entryId(), kind: "tool", name: event.name, summary: event.summary }];
          case "finished":
            return !event.ok && event.error
              ? [{ id: entryId(), kind: "error", text: event.error }]
              : [];
          case "started":
            return [];
        }
      }
    }
  });
}

function applyEvent(
  event: ChatEvent,
  provider: ChatProviderId,
  sessions: Partial<Record<ChatProviderId, string>>,
  setEntries: (update: (list: readonly ChatEntry[]) => readonly ChatEntry[]) => void,
): void {
  switch (event.kind) {
    case "started":
      sessions[provider] = event.sessionId;
      return;
    case "text":
      setEntries((list) => [...list, { id: entryId(), kind: "agent", text: event.text }]);
      return;
    case "tool":
      setEntries((list) => [
        ...list,
        { id: entryId(), kind: "tool", name: event.name, summary: event.summary },
      ]);
      return;
    case "finished":
      if (event.ok || !event.error) return;

      setEntries((list) => [...list, { id: entryId(), kind: "error", text: event.error ?? "" }]);
  }
}
