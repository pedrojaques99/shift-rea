import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatEvent, ChatProvider, ChatProviderId } from "@shared/agent/chat";
import { getShiftHost } from "@/host/shiftHost";
import { useAgentConnections } from "@/hooks/useAgentConnections";
import type { AgentChatView, ChatEntry } from "@/types/agentChat";

/** What the chat panel can do. */
export interface AgentChatActions {
  send(text: string): Promise<void>;
  stop(): Promise<void>;
  /** Starts a fresh conversation with the current provider. */
  reset(): void;
  setProvider(provider: ChatProviderId): void;
  allowConnections(): Promise<void>;
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
export function useAgentChat(): AgentChatView & AgentChatActions {
  const connections = useAgentConnections();
  const [providers, setProviders] = useState<readonly ChatProvider[]>([]);
  const [provider, setProvider] = useState<ChatProviderId>("claude");
  const [entries, setEntries] = useState<readonly ChatEntry[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  // Session ids are read only when sending, never rendered.
  const sessions = useRef<Partial<Record<ChatProviderId, string>>>({});
  // A run can report before `send` resolves with its id: hold those events.
  const early = useRef(new Map<string, ChatEvent[]>());
  const activeRun = useRef<string | null>(null);

  useEffect(() => {
    let live = true;
    const load = async () => {
      const list = await getShiftHost().agentChat.providers();
      if (!live) return;

      setProviders(list);
      const firstInstalled = list.find(({ installed }) => installed);
      if (firstInstalled) setProvider(firstInstalled.id);
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
    async (text: string) => {
      const prompt = text.trim();
      if (!prompt || runId) return;

      setEntries((list) => [...list, { id: entryId(), kind: "user", text: prompt }]);
      try {
        const run = await getShiftHost().agentChat.send({
          provider,
          prompt,
          sessionId: sessions.current[provider] ?? null,
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
    [provider, runId, receive],
  );

  const stop = useCallback(async () => {
    if (!runId) return;

    await getShiftHost().agentChat.stop(runId);
    activeRun.current = null;
    setRunId(null);
  }, [runId]);

  const reset = useCallback(() => {
    delete sessions.current[provider];
    setEntries([]);
  }, [provider]);

  const allowConnections = useCallback(async () => {
    await getShiftHost().agentConnections.setAllowed(true);
  }, []);

  return {
    providers,
    provider,
    entries,
    running: runId !== null,
    connectionsOff: connections !== null && connections.status !== "listening",
    send,
    stop,
    reset,
    setProvider,
    allowConnections,
  };
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
