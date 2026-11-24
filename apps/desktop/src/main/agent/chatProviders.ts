import type { ChatEvent, ChatProviderId } from "../../shared/agent/chat";

/** What a provider's command needs for one message. */
export interface ChatInvocation {
  /** The conversation to continue; null starts one. */
  sessionId: string | null;
  /** A fresh id for a new Claude Code conversation, which picks its own id up front. */
  newSessionId: string;
  /** This build's MCP server name and loopback URL. */
  serverName: string;
  url: string;
  /** What the agent should know about the window it works on. */
  context: string;
  /** A model the user picked; null leaves the provider's default. */
  model: string | null;
}

/** How one command-line agent is run and read. */
export interface ChatAdapter {
  name: string;
  command: string;
  /** The command's arguments; `prompt` is the message, for commands that take it as an argument. */
  args(invocation: ChatInvocation, prompt: string): string[];
  /** The message as the agent receives it: the user's text, with the window's context where needed. */
  prompt(text: string, invocation: ChatInvocation): string;
  /** Whether the message goes to standard input rather than into the arguments. */
  stdin: boolean;
  /**
   * Files the command reads from its working directory, by name: how agents
   * without a per-run MCP flag find Shift's server.
   */
  workFiles?(invocation: ChatInvocation): Record<string, string>;
  /** A command to run once before the agent, such as registering Shift's MCP server. */
  setup?(invocation: ChatInvocation): string[];
  /** The chat events one line of the command's output stands for. */
  read(line: string): ChatEvent[];
}

/** The Shift MCP tools an agent may call: reading, rendering, checking and editing the open font. */
const SHIFT_TOOLS = ["shift.guide", "shift.describe", "shift.execute", "shift.capture"];

/** Tools outside Shift a chat agent may use: reading the files the user attached. */
const READ_TOOLS = ["Read"];

/**
 * Claude Code, as `claude -p` with `stream-json` output. It sees only Shift's
 * MCP server (`--strict-mcp-config`) and may call only its tools: every other
 * tool, such as Bash or file edits, is refused without asking.
 */
const claude: ChatAdapter = {
  name: "Claude Code",
  command: "claude",
  stdin: true,
  args({ sessionId, newSessionId, serverName, url, context, model }) {
    const config = JSON.stringify({ mcpServers: { [serverName]: { type: "http", url } } });
    const allowed = [
      ...SHIFT_TOOLS.map((tool) => `mcp__${serverName}__${tool}`),
      ...READ_TOOLS,
    ].join(",");
    const conversation = sessionId ? ["--resume", sessionId] : ["--session-id", newSessionId];
    return [
      "-p",
      "--output-format",
      "stream-json",
      "--verbose",
      "--strict-mcp-config",
      "--mcp-config",
      config,
      "--allowedTools",
      allowed,
      "--append-system-prompt",
      context,
      ...(model ? ["--model", model] : []),
      ...conversation,
    ];
  },
  prompt: (text) => text,
  read: readClaudeLine,
};

/**
 * Codex, as `codex exec --json`, with Shift's MCP server added for the run
 * and a read-only sandbox: it changes the font through Shift, never files.
 */
const codex: ChatAdapter = {
  name: "Codex",
  command: "codex",
  stdin: true,
  args({ sessionId, serverName, url, model }) {
    const common = [
      ...(model ? ["-m", model] : []),
      "--json",
      "--skip-git-repo-check",
      "-c",
      'sandbox_mode="read-only"',
      "-c",
      `mcp_servers.${serverName}.url="${url}"`,
    ];
    return sessionId ? ["exec", "resume", ...common, sessionId, "-"] : ["exec", ...common, "-"];
  },
  // Codex has no system-prompt flag; the window's context opens the first message.
  prompt: (text, { sessionId, context }) => (sessionId ? text : `${context}\n\n---\n\n${text}`),
  read: readCodexLine,
};

/**
 * Antigravity's `agy`, in print mode with `stream-json` output. It has no
 * per-run MCP flag, so Shift registers its server with `agy mcp add` first
 * (which adds or updates it) and runs it sandboxed.
 */
const agy: ChatAdapter = {
  name: "Antigravity (agy)",
  command: "agy",
  stdin: false,
  setup: ({ serverName, url }) => ["mcp", "add", "--type", "http", serverName, url],
  args({ sessionId, model }, prompt) {
    return [
      "--output-format",
      "stream-json",
      "--sandbox",
      "--mode",
      "accept-edits",
      ...(sessionId ? ["--conversation", sessionId] : []),
      ...(model ? ["--model", model] : []),
      `-p=${prompt}`,
    ];
  },
  prompt: (text, { sessionId, context }) =>
    sessionId
      ? text
      : `${context}

---

${text}`,
  read: readAgyLine,
};

/**
 * OpenCode, as `opencode run --format json`. It finds Shift's server in the
 * `opencode.jsonc` Shift writes in the chat's working directory, which also
 * denies shell commands and file edits: it changes the font through Shift.
 */
const opencode: ChatAdapter = {
  name: "OpenCode",
  command: "opencode",
  stdin: false,
  workFiles: ({ serverName, url }) => ({
    "opencode.jsonc": JSON.stringify(
      {
        $schema: "https://opencode.ai/config.json",
        mcp: { servers: { [serverName]: { type: "remote", url, oauth: false } } },
        permissions: [
          { action: "shell", resource: "*", effect: "deny" },
          { action: "edit", resource: "*", effect: "deny" },
        ],
      },
      null,
      2,
    ),
  }),
  args({ sessionId, model }, prompt) {
    return [
      "run",
      "--format",
      "json",
      ...(model ? ["-m", model] : []),
      ...(sessionId ? ["--session", sessionId] : []),
      prompt,
    ];
  },
  prompt: (text, { sessionId, context }) =>
    sessionId
      ? text
      : `${context}

---

${text}`,
  read: readOpenCodeLine,
};

/** The providers that run a command-line agent: all but the user's own API key. */
export type CommandProviderId = Exclude<ChatProviderId, "api">;

/** Every command-line provider the chat can run, by id, in the order the chat lists them. */
export const CHAT_ADAPTERS: Readonly<Record<CommandProviderId, ChatAdapter>> = {
  claude,
  codex,
  agy,
  opencode,
};

/** One line of `agy --output-format stream-json`, as chat events. */
export function readAgyLine(line: string): ChatEvent[] {
  const event = parseLine(line);
  if (!event) return [];

  if (event.event === "init" && typeof event.conversation_id === "string") {
    return [{ kind: "started", sessionId: event.conversation_id }];
  }
  if (event.event !== "result" || !isObject(event.result)) return [];

  const result = event.result;
  if (result.status !== "SUCCESS") {
    const error = typeof result.error === "string" ? result.error : "agy failed";
    return [{ kind: "finished", ok: false, error, costUsd: null }];
  }
  const text = typeof result.response === "string" ? result.response.trim() : "";
  return [
    ...(text ? [{ kind: "text", text } satisfies ChatEvent] : []),
    { kind: "finished", ok: true, error: null, costUsd: null },
  ];
}

/** One line of `opencode run --format json`, as chat events. */
export function readOpenCodeLine(line: string): ChatEvent[] {
  const event = parseLine(line);
  if (!event) return [];

  const part = isObject(event.part) ? event.part : null;
  switch (event.type) {
    case "step_start":
      return typeof event.sessionID === "string"
        ? [{ kind: "started", sessionId: event.sessionID }]
        : [];
    case "text":
      return typeof part?.text === "string" && part.text.trim()
        ? [{ kind: "text", text: part.text }]
        : [];
    case "tool_use": {
      const state = isObject(part?.state) ? part.state : null;
      const name = typeof part?.tool === "string" ? toolName(part.tool) : "tool";
      return [{ kind: "tool", name, summary: toolSummary(state?.input) }];
    }
    case "error": {
      const error = isObject(event.error) ? event.error : null;
      const message = typeof error?.message === "string" ? error.message : "OpenCode failed";
      return [{ kind: "finished", ok: false, error: message, costUsd: null }];
    }
    default:
      return [];
  }
}

/** One line of Claude Code's `stream-json` output, as chat events. */
export function readClaudeLine(line: string): ChatEvent[] {
  const event = parseLine(line);
  if (!event) return [];

  switch (event.type) {
    case "system":
      return event.subtype === "init" && typeof event.session_id === "string"
        ? [{ kind: "started", sessionId: event.session_id }]
        : [];
    case "assistant":
      return assistantBlocks(event);
    case "result":
      return [
        {
          kind: "finished",
          ok: event.is_error !== true,
          error: event.is_error === true ? resultText(event) : null,
          costUsd: typeof event.total_cost_usd === "number" ? event.total_cost_usd : null,
        },
      ];
    default:
      return [];
  }
}

/** One line of `codex exec --json` output, as chat events. */
export function readCodexLine(line: string): ChatEvent[] {
  const event = parseLine(line);
  if (!event) return [];

  switch (event.type) {
    case "thread.started":
      return typeof event.thread_id === "string"
        ? [{ kind: "started", sessionId: event.thread_id }]
        : [];
    case "item.completed":
      return codexItem(event.item);
    case "turn.completed":
      return [{ kind: "finished", ok: true, error: null, costUsd: null }];
    case "turn.failed":
    case "error":
      return [{ kind: "finished", ok: false, error: codexError(event), costUsd: null }];
    default:
      return [];
  }
}

type JsonObject = Record<string, unknown>;

function parseLine(line: string): JsonObject | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{")) return null;

  try {
    const value: unknown = JSON.parse(trimmed);
    return isObject(value) ? value : null;
  } catch {
    return null;
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assistantBlocks(event: JsonObject): ChatEvent[] {
  const message = isObject(event.message) ? event.message : null;
  const content = Array.isArray(message?.content) ? message.content : [];
  return content.flatMap((block): ChatEvent[] => {
    if (!isObject(block)) return [];

    if (block.type === "text" && typeof block.text === "string" && block.text.trim()) {
      return [{ kind: "text", text: block.text }];
    }
    if (block.type === "tool_use" && typeof block.name === "string") {
      return [{ kind: "tool", name: toolName(block.name), summary: toolSummary(block.input) }];
    }
    return [];
  });
}

function codexItem(item: unknown): ChatEvent[] {
  if (!isObject(item)) return [];

  switch (item.type) {
    case "agent_message":
      return typeof item.text === "string" && item.text.trim()
        ? [{ kind: "text", text: item.text }]
        : [];
    case "mcp_tool_call":
      return [
        {
          kind: "tool",
          name: typeof item.tool === "string" ? item.tool : "shift",
          summary: toolSummary(item.arguments),
        },
      ];
    case "error":
      return [
        {
          kind: "finished",
          ok: false,
          error: typeof item.message === "string" ? item.message : "Codex failed",
          costUsd: null,
        },
      ];
    default:
      return [];
  }
}

function codexError(event: JsonObject): string {
  const error = isObject(event.error) ? event.error : null;
  if (typeof error?.message === "string") return error.message;

  return typeof event.message === "string" ? event.message : "Codex failed";
}

function resultText(event: JsonObject): string {
  return typeof event.result === "string" && event.result ? event.result : "The agent failed";
}

/** `mcp__shift__shift.execute` reads as `shift.execute`. */
function toolName(name: string): string {
  const parts = name.split("__");
  return parts.length >= 3 ? parts.slice(2).join("__") : name;
}

/** A short line of what a tool call did: the label of an edit, or the start of its code. */
export function toolSummary(input: unknown): string {
  if (!isObject(input)) return "";

  const code = typeof input.code === "string" ? input.code : null;
  if (code) {
    const label = /label:\s*["'`]([^"'`]{1,80})["'`]/.exec(code);
    if (label) return label[1];

    return code.replace(/\s+/g, " ").slice(0, 100);
  }
  const topic = typeof input.topic === "string" ? input.topic : null;
  return topic ?? "";
}
