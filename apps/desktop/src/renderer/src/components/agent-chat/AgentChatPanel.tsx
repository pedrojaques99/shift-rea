import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowRight,
  Button,
  ChevronDown,
  Plus,
  ScrollArea,
  Select,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectList,
  SelectPopup,
  SelectPortal,
  SelectPositioner,
  SelectTrigger,
  Square,
  Textarea,
  Tooltip,
  cn,
} from "@shift/ui";
import type { ChatProviderId } from "@shared/agent/chat";
import { useAgentChat } from "@/hooks/useAgentChat";
import type { ChatEntry } from "@/types/agentChat";

/** Starting points that show what the agent can do with the open font. */
const SUGGESTIONS = [
  "Draw the O in the style of the H",
  "Check the font and fix what you find",
  "Space the capitals like the H",
  "Build Aacute, Eacute and Oacute from components",
];

/**
 * The agent chat: the user's signed-in Claude Code or Codex works on the open
 * font through Shift, and every change it makes is an undoable edit.
 */
export function AgentChatPanel() {
  const chat = useAgentChat();
  const [draft, setDraft] = useState("");
  const viewport = useRef<HTMLDivElement>(null);
  const installed = chat.providers.filter(({ installed: has }) => has);

  useEffect(() => {
    const element = viewport.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [chat.entries.length, chat.running]);

  const submit = async (text: string) => {
    if (!text.trim() || chat.running) return;

    setDraft("");
    await chat.send(text);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;

    event.preventDefault();
    void submit(draft);
  };

  return (
    <section aria-label="Agent" className="flex h-full min-h-0 flex-col bg-surface">
      <header className="flex items-center gap-2 border-b border-line-subtle py-2 pr-10 pl-3">
        <h2 className="text-sm font-medium text-primary">Agent</h2>
        <ProviderSelect
          value={chat.provider}
          providers={installed.map(({ id, name }) => ({ id, name }))}
          disabled={chat.running}
          onChange={chat.setProvider}
        />
        <Tooltip content="New conversation">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="New conversation"
            className="ml-auto"
            disabled={chat.running}
            onClick={chat.reset}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </Tooltip>
      </header>

      <ScrollArea className="min-h-0 flex-1" viewportRef={viewport}>
        <ol className="flex flex-col gap-3 px-3 py-3" aria-live="polite">
          {chat.entries.length === 0 ? (
            <EmptyState
              noProvider={chat.providers.length > 0 && installed.length === 0}
              onPick={(text) => void submit(text)}
            />
          ) : null}
          {chat.entries.map((entry) => (
            <Entry key={entry.id} entry={entry} />
          ))}
          {chat.running ? <Thinking /> : null}
        </ol>
      </ScrollArea>

      {chat.connectionsOff ? (
        <div className="flex items-center gap-2 border-t border-line-subtle px-3 py-2 text-ui text-secondary">
          <span className="flex-1">The agent reaches your font through agent connections.</span>
          <Button variant="outline" size="sm" onClick={() => void chat.allowConnections()}>
            Turn on
          </Button>
        </div>
      ) : null}

      <form
        className="flex items-end gap-2 border-t border-line-subtle p-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(draft);
        }}
      >
        <Textarea
          aria-label="Message the agent"
          placeholder="Ask the agent to draw, space, kern or check…"
          rows={2}
          value={draft}
          className="max-h-40 min-h-9 flex-1 resize-none"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {chat.running ? (
          <Tooltip content="Stop">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Stop"
              onClick={() => void chat.stop()}
            >
              <Square className="h-3 w-3" aria-hidden />
            </Button>
          </Tooltip>
        ) : (
          <Tooltip content="Send (Enter)">
            <Button
              type="submit"
              variant="primary"
              size="icon"
              aria-label="Send"
              aria-disabled={!draft.trim() || chat.connectionsOff}
            >
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </Tooltip>
        )}
      </form>
    </section>
  );
}

function Entry({ entry }: { entry: ChatEntry }) {
  switch (entry.kind) {
    case "user":
      return (
        <li className="ml-8 self-end whitespace-pre-wrap rounded-lg bg-hover px-3 py-2 text-sm text-primary">
          {entry.text}
        </li>
      );
    case "agent":
      return (
        <li className="whitespace-pre-wrap text-sm leading-relaxed text-primary">{entry.text}</li>
      );
    case "tool":
      return (
        <li className="flex min-w-0 items-center gap-1.5 text-ui text-muted">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <span className="shrink-0 font-mono">{entry.name}</span>
          {entry.summary ? (
            <span className="truncate text-secondary">· {entry.summary}</span>
          ) : null}
        </li>
      );
    case "error":
      return (
        <li role="alert" className="text-ui text-error">
          {entry.text}
        </li>
      );
  }
}

function Thinking() {
  return (
    <li className="flex items-center gap-1 text-ui text-muted" aria-label="The agent is working">
      <span className="animate-pulse">Working…</span>
    </li>
  );
}

function EmptyState({
  noProvider,
  onPick,
}: {
  noProvider: boolean;
  onPick: (text: string) => void;
}) {
  if (noProvider) {
    return (
      <li className="text-ui text-secondary">
        Install Claude Code or Codex and sign in; the agent uses your own subscription.
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2">
      <p className="text-ui text-secondary">
        Ask in your own words. Each change is one undo step; Ctrl+Z takes it back.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((text) => (
          <Button key={text} variant="outline" size="sm" onClick={() => onPick(text)}>
            {text}
          </Button>
        ))}
      </div>
    </li>
  );
}

function ProviderSelect({
  value,
  providers,
  disabled,
  onChange,
}: {
  value: ChatProviderId;
  providers: readonly { id: ChatProviderId; name: string }[];
  disabled: boolean;
  onChange: (provider: ChatProviderId) => void;
}) {
  const name = providers.find(({ id }) => id === value)?.name ?? "No agent";

  return (
    <Select
      value={value}
      disabled={disabled || providers.length === 0}
      onValueChange={(next) => {
        if (next !== null) onChange(next);
      }}
    >
      <SelectTrigger variant="field" aria-label="Agent" className={cn("h-6 w-auto")}>
        <span className="truncate text-ui">{name}</span>
        <span aria-hidden className="flex shrink-0 text-muted">
          <ChevronDown className="h-3 w-3" strokeWidth={1.75} />
        </span>
      </SelectTrigger>
      <SelectPortal>
        <SelectPositioner sideOffset={4} align="start">
          <SelectPopup>
            <SelectList>
              {providers.map(({ id, name: label }) => (
                <SelectItem key={id} value={id}>
                  <SelectItemIndicator />
                  <SelectItemText>{label}</SelectItemText>
                </SelectItem>
              ))}
            </SelectList>
          </SelectPopup>
        </SelectPositioner>
      </SelectPortal>
    </Select>
  );
}
