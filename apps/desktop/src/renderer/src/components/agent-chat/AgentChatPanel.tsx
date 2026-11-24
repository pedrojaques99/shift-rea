import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronRight, Plus } from "lucide-react";
import {
  Button,
  ChevronDown,
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
  Tooltip,
} from "@shift/ui";
import { PromptComposer } from "@/components/visant/ui/prompt-composer";
import {
  SoftwareGlyph,
  softwareById,
  softwareFromTool,
} from "@/components/visant/ui/software-glyph";
import { WorkingGlyph } from "@/components/visant/ui/working-glyph";
import { useSignalState } from "@shift/editor/signals";
import { useAgentChat } from "@/hooks/useAgentChat";
import { documentViewKey } from "@/lib/workspace/documentViews";
import type { Workspace } from "@/workspace/Workspace";
import { useFont, useFontSession } from "@/workspace/WorkspaceContext";
import type { ChatProviderId } from "@shared/agent/chat";
import type { ChatEntry } from "@/types/agentChat";
import { Markdown } from "./Markdown";

/**
 * Each provider's logo in the kit's software catalog: the agent's maker, since
 * the CLIs have no marks of their own (Codex is OpenAI's, agy is Google's).
 */
const PROVIDER_LOGO: Record<ChatProviderId, string> = {
  claude: "claude",
  codex: "openai",
  agy: "gemini",
  opencode: "terminal",
  api: "ferramenta",
};

/** The model option that leaves the provider's own default. */
const DEFAULT_MODEL = "__default__";

/** Starting points for a font that has no glyphs yet: the agent builds it. */
const NEW_FONT_SUGGESTIONS = [
  "Draw A–Z and a–z as a clean geometric sans",
  "Set up Regular and Bold masters with a weight axis",
  "Add the Latin basic character set with empty glyphs",
  "Draw H, O and n first so we can agree on the style",
];

/** Starting points that show what the agent can do with the open font. */
const SUGGESTIONS = [
  "Draw the O in the style of the H",
  "Check the font and fix what you find",
  "Space the capitals like the H",
  "Build Aacute, Eacute and Oacute from components",
];

type Tool = Extract<ChatEntry, { kind: "tool" }>;

/**
 * The agent chat, built from the Visant kit (@visant/prompt-composer,
 * software-glyph, working-glyph): the user's signed-in agent, or their own API
 * key, works on the open font through Shift, and every change is one undo step.
 */
export function AgentChatPanel() {
  const session = useFontSession();
  if (session.mode !== "workspace") return <ChatBody conversation={null} />;

  return <WorkspaceChat workspace={session.workspace} />;
}

/** One conversation per document, kept on disk; a different document starts its own. */
function WorkspaceChat({ workspace }: { workspace: Workspace }) {
  const document = useSignalState(workspace.documentStateCell);
  const conversation = document === null ? null : documentViewKey(document);
  return <ChatBody key={conversation ?? "none"} conversation={conversation} />;
}

function ChatBody({ conversation }: { conversation: string | null }) {
  const chat = useAgentChat(conversation);
  const [draft, setDraft] = useState("");
  const viewport = useRef<HTMLDivElement>(null);
  const installed = chat.providers.filter(({ installed: has }) => has);
  const models = chat.providers.find(({ id }) => id === chat.provider)?.models ?? [];

  useEffect(() => {
    const element = viewport.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [chat.entries.length, chat.running]);

  const submit = (text: string) => {
    if (chat.running) return;

    setDraft("");
    void chat.send(text);
  };

  return (
    <section aria-label="Agent" className="visant-kit flex h-full min-h-0 flex-col bg-background">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="text-sm font-medium text-foreground">Agent</h2>
        <HeaderSelect
          label="Agent"
          value={chat.provider}
          options={installed.map(({ id, name }) => ({
            id,
            label: name,
            icon: <SoftwareGlyph software={softwareById(PROVIDER_LOGO[id])} size={12} />,
          }))}
          disabled={chat.running}
          onChange={chat.setProvider}
        />
        {models.length > 0 ? (
          <HeaderSelect
            label="Model"
            value={chat.model ?? DEFAULT_MODEL}
            options={[
              { id: DEFAULT_MODEL, label: "Default model" },
              ...models.map((model) => ({ id: model, label: model })),
            ]}
            disabled={chat.running}
            onChange={(next) => chat.setModel(next === DEFAULT_MODEL ? null : next)}
          />
        ) : null}
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
              onPick={submit}
            />
          ) : null}
          {grouped(chat.entries).map((item) =>
            Array.isArray(item) ? (
              <Actions key={item[0]!.id} tools={item} />
            ) : (
              <Entry key={item.id} entry={item} />
            ),
          )}
          {chat.running ? (
            <li className="flex items-center gap-2 text-xs text-muted-foreground">
              <WorkingGlyph size={14} />
              Working on the font…
            </li>
          ) : null}
        </ol>
      </ScrollArea>

      {chat.connectionsOff ? (
        <div className="flex items-center gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <span className="flex-1">The agent reaches your font through agent connections.</span>
          <Button variant="outline" size="sm" onClick={() => void chat.allowConnections()}>
            Turn on
          </Button>
        </div>
      ) : null}

      <div className="border-t border-border p-2">
        <PromptComposer
          value={draft}
          onValueChange={setDraft}
          onSubmit={() => submit(draft)}
          onStop={() => void chat.stop()}
          status={chat.running ? "streaming" : "ready"}
          canSubmit={!chat.connectionsOff && (draft.trim() !== "" || chat.attachments.length > 0)}
          attachments={chat.attachments.map(({ id, name, preview }) => ({
            id,
            label: name,
            preview: preview ?? undefined,
          }))}
          onRemoveAttachment={chat.removeAttachment}
          onAttachFiles={(files) => void chat.attachFiles(files)}
          accept="image/*,.svg,.pdf,.glyphs,.ufo,.ttf,.otf"
          minRows={2}
          placeholder="Ask the agent to draw, space, kern or check…"
          label="Message the agent"
          submitLabel="Send"
          queueLabel="Queue"
          stopLabel="Stop"
          attachLabel="Attach a sketch or reference"
          removeLabel={(attachment) => `Remove ${attachment.label}`}
        />
      </div>
    </section>
  );
}

/** Consecutive tool calls fold into one row: the reply matters, not each call. */
function grouped(entries: readonly ChatEntry[]): (Exclude<ChatEntry, Tool> | Tool[])[] {
  const out: (Exclude<ChatEntry, Tool> | Tool[])[] = [];
  for (const entry of entries) {
    const last = out.at(-1);
    if (entry.kind !== "tool") {
      out.push(entry);
      continue;
    }
    if (Array.isArray(last)) last.push(entry);
    else out.push([entry]);
  }
  return out;
}

/** A run of Shift calls, collapsed to their count; open to see each call and what it did. */
function Actions({ tools }: { tools: readonly Tool[] }) {
  const read = tools.map((tool) => ({ tool, ...softwareFromTool(tool.name) }));
  const softwares = [
    ...new Map(read.map((r) => [`${r.software.id}:${r.software.name}`, r.software])).values(),
  ];
  return (
    <li>
      <details className="group text-xs text-muted-foreground">
        <summary className="flex w-fit max-w-full cursor-pointer list-none items-center gap-1.5 rounded-md py-0.5 pr-1.5 hover:text-foreground [&::-webkit-details-marker]:hidden">
          <ChevronRight className="size-3 flex-none transition-transform group-open:rotate-90" />
          <span className="flex flex-none items-center gap-1 text-foreground/70">
            {softwares.slice(0, 4).map((software) => (
              <SoftwareGlyph
                key={`${software.id}:${software.name}`}
                software={software}
                size={12}
              />
            ))}
          </span>
          <span className="flex-none">
            {tools.length === 1 ? "1 action" : `${tools.length} actions`}
          </span>
        </summary>
        <ol className="mt-1 ml-1.5 flex flex-col gap-1 border-l border-border pl-3">
          {read.map(({ tool, software, action }) => (
            <li
              key={tool.id}
              className="flex min-w-0 items-center gap-1.5"
              title={`${tool.name} ${tool.summary}`}
            >
              <span className="flex flex-none text-foreground/70">
                <SoftwareGlyph software={software} size={12} />
              </span>
              <span className="flex-none text-foreground/80">{action || tool.name}</span>
              {tool.summary ? (
                <span className="min-w-0 truncate font-mono text-muted-foreground/70">
                  {tool.summary}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </details>
    </li>
  );
}

function Entry({ entry }: { entry: Exclude<ChatEntry, Tool> }) {
  switch (entry.kind) {
    case "user":
      return (
        <li className="ml-8 rounded-lg bg-muted/60 px-3 py-2">
          {entry.text ? <Markdown>{entry.text}</Markdown> : null}
          {entry.attachments.length ? (
            <span className="mt-1 block text-xs text-muted-foreground">
              {entry.attachments.join(" · ")}
            </span>
          ) : null}
        </li>
      );
    case "agent":
      return (
        <li>
          <Markdown>{entry.text}</Markdown>
        </li>
      );
    case "error":
      return (
        <li
          role="alert"
          className="rounded-md border border-destructive/30 px-3 py-2 text-xs text-destructive"
        >
          {entry.text}
        </li>
      );
  }
}

function EmptyState({
  noProvider,
  onPick,
}: {
  noProvider: boolean;
  onPick: (text: string) => void;
}) {
  const font = useFont();
  const glyphs = useSignalState(font.glyphEntriesCell);
  const suggestions = glyphs.length === 0 ? NEW_FONT_SUGGESTIONS : SUGGESTIONS;

  if (noProvider) {
    return (
      <li className="text-xs text-muted-foreground">
        Install Claude Code, Codex, agy or OpenCode and sign in, or add your own API key in Settings
        → Agents.
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        Ask in your own words, attach a sketch or a reference. Each change is one undo step.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((text) => (
          <Button key={text} variant="outline" size="sm" onClick={() => onPick(text)}>
            {text}
          </Button>
        ))}
      </div>
    </li>
  );
}

function HeaderSelect<Value extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: Value;
  options: readonly { id: Value; label: string; icon?: ReactNode }[];
  disabled: boolean;
  onChange: (value: Value) => void;
}) {
  const selected = options.find((option) => option.id === value);
  const current = selected?.label ?? `No ${label.toLowerCase()}`;

  return (
    <Select
      value={value}
      disabled={disabled || options.length === 0}
      onValueChange={(next) => {
        if (next !== null) onChange(next);
      }}
    >
      <SelectTrigger variant="field" aria-label={label} className="h-6 w-auto min-w-0">
        {selected?.icon}
        <span className="truncate text-ui">{current}</span>
        <span aria-hidden className="flex shrink-0 text-muted">
          <ChevronDown className="h-3 w-3" strokeWidth={1.75} />
        </span>
      </SelectTrigger>
      <SelectPortal>
        <SelectPositioner sideOffset={4} align="start">
          <SelectPopup>
            <SelectList>
              {options.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  <SelectItemIndicator />
                  <SelectItemText>
                    <span className="flex items-center gap-1.5">
                      {option.icon}
                      {option.label}
                    </span>
                  </SelectItemText>
                </SelectItem>
              ))}
            </SelectList>
          </SelectPopup>
        </SelectPositioner>
      </SelectPortal>
    </Select>
  );
}
