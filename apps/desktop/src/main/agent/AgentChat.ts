import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type {
  ChatEvent,
  ChatProvider,
  ChatProviderId,
  ChatRun,
  ChatSendRequest,
} from "@shared/agent/chat";
import { CHAT_ADAPTERS, type ChatInvocation } from "./chatProviders";

/** Where the chat's agent finds this build's MCP server, and what it should know. */
export interface ChatTarget {
  serverName: string;
  url: string;
  /** The window the chat belongs to, named in the agent's context. */
  windowId: number;
}

/**
 * Runs the in-app agent chat: one command-line agent process per message,
 * whose output becomes {@link ChatEvent}s for the window that asked.
 *
 * @remarks
 * The agent reaches the font only through Shift's MCP server, so every
 * change it makes is an undoable edit the window shows. A provider's command
 * can be replaced, for tests, by `SHIFT_CHAT_CMD_<PROVIDER>`: a JSON array of
 * the executable and its leading arguments.
 */
export class AgentChat {
  // non-reactive: process handles, owned by main and never rendered.
  readonly #runs = new Map<string, ChildProcess>();
  readonly #workDir: string;

  /** @param workDir - The agents' working directory; it holds their per-run config files. */
  constructor(workDir: string = path.join(os.tmpdir(), "shift-agent-chat")) {
    this.#workDir = workDir;
  }

  /** The providers found on this computer, and the models each lets the user pick. */
  providers(): ChatProvider[] {
    return (Object.keys(CHAT_ADAPTERS) as ChatProviderId[]).map((id) => {
      const command = commandFor(id);
      return {
        id,
        name: CHAT_ADAPTERS[id].name,
        installed: command !== null,
        models: command ? listModels(id, command) : [],
      };
    });
  }

  /**
   * Sends one message and streams the agent's reply to `onEvent`, ending
   * with a `finished` event.
   *
   * @throws {Error} when the provider's command is not installed.
   */
  send(request: ChatSendRequest, target: ChatTarget, onEvent: (event: ChatEvent) => void): ChatRun {
    const adapter = CHAT_ADAPTERS[request.provider];
    const command = commandFor(request.provider);
    if (!command) throw new Error(`${adapter.name} is not installed on this computer`);

    const invocation: ChatInvocation = {
      sessionId: request.sessionId,
      newSessionId: crypto.randomUUID(),
      serverName: target.serverName,
      url: target.url,
      context: chatContext(target),
      model: request.model,
    };
    fs.mkdirSync(this.#workDir, { recursive: true });
    for (const [name, content] of Object.entries(adapter.workFiles?.(invocation) ?? {})) {
      fs.writeFileSync(path.join(this.#workDir, name), content);
    }
    const setup = adapter.setup?.(invocation);
    if (setup) {
      spawnSync(command[0], [...command.slice(1), ...setup], {
        cwd: this.#workDir,
        windowsHide: true,
        timeout: 30_000,
      });
    }

    const prompt = adapter.prompt(request.prompt, invocation);
    const runId = crypto.randomUUID();
    const child = spawn(command[0], [...command.slice(1), ...adapter.args(invocation, prompt)], {
      cwd: this.#workDir,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.#runs.set(runId, child);

    let finished = false;
    const emit = (event: ChatEvent) => {
      if (finished) return;

      if (event.kind === "finished") finished = true;
      onEvent(event);
    };
    readLines(child, (line) => {
      for (const event of adapter.read(line)) emit(event);
    });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr = (stderr + chunk.toString("utf8")).slice(-2000);
    });
    child.on("error", (error) => {
      emit({ kind: "finished", ok: false, error: error.message, costUsd: null });
    });
    child.on("close", (code) => {
      this.#runs.delete(runId);
      const error = code === 0 ? null : lastLine(stderr) || `${adapter.name} exited with ${code}`;
      emit({ kind: "finished", ok: code === 0, error, costUsd: null });
    });

    child.stdin?.end(adapter.stdin ? prompt : undefined);
    return { runId };
  }

  /** Stops a run; nothing happens when it already ended. */
  stop(runId: string): void {
    const child = this.#runs.get(runId);
    if (!child?.pid) return;

    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true });
    } else {
      child.kill("SIGTERM");
    }
    this.#runs.delete(runId);
  }

  /** Stops every run, as the app quits. */
  stopAll(): void {
    for (const runId of this.#runs.keys()) this.stop(runId);
  }
}

/** Models a provider's CLI lists, for those that let the user pick one; cached per provider. */
const modelCache = new Map<ChatProviderId, string[]>();
function listModels(provider: ChatProviderId, command: string[]): string[] {
  if (provider !== "opencode") return [];

  const cached = modelCache.get(provider);
  if (cached) return cached;

  const result = spawnSync(command[0], [...command.slice(1), "models"], {
    windowsHide: true,
    encoding: "utf8",
    timeout: 20_000,
  });
  const models =
    result.status === 0
      ? result.stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => /^[\w.-]+\/[\w.:-]+$/.test(line))
      : [];
  modelCache.set(provider, models);
  return models;
}

/** What the agent should know: which window, and how to work on its font. */
function chatContext({ windowId, serverName }: ChatTarget): string {
  return [
    `You are the type-design assistant inside Shift, a font editor. The user's font is open in Shift window ${windowId}.`,
    `Work on it only through the ${serverName} MCP tools: call shift.guide with topic "editing" before your first edit, shift.describe for the typed API, then shift.execute.`,
    "Read the font before drawing, match its stems and proportions, make each meaningful step one shift.edits.apply call with a clear label, run shift.font.check on what you changed and fix what it finds, and look at the result (layers.render or shift.capture).",
    "Never save or export files; the user does. Answer in the user's language, briefly.",
  ].join(" ");
}

/** The executable and leading arguments that run `provider`, or null when it is missing. */
function commandFor(provider: ChatProviderId): string[] | null {
  const override = process.env[`SHIFT_CHAT_CMD_${provider.toUpperCase()}`];
  if (override) return JSON.parse(override) as string[];

  const found = which(CHAT_ADAPTERS[provider].command);
  if (!found) return null;

  return windowsShim(found) ?? [found];
}

/** The first path the system's search finds for `command`. */
function which(command: string): string | null {
  const finder = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(finder, [command], { windowsHide: true, encoding: "utf8" });
  if (result.status !== 0) return null;

  const paths = result.stdout.split(/\r?\n/).filter(Boolean);
  if (process.platform !== "win32") return paths[0] ?? null;

  // On Windows prefer what runs without a shell: an .exe, else an npm .cmd shim.
  return (
    paths.find((candidate) => candidate.toLowerCase().endsWith(".exe")) ??
    paths.find((candidate) => candidate.toLowerCase().endsWith(".cmd")) ??
    null
  );
}

/**
 * What an npm `.cmd` shim runs, without the shim: a shim needs a shell, and a
 * shell would mangle the quotes in the agent's arguments. Shims start either
 * a script with node (Codex) or a bundled executable (OpenCode).
 */
function windowsShim(found: string): string[] | null {
  if (!found.toLowerCase().endsWith(".cmd")) return null;

  const shim = fs.readFileSync(found, "utf8");
  const target = /"%~?dp0%\\(node_modules\\[^"]+\.(?:js|exe))"/i.exec(shim);
  if (!target) return null;

  const resolved = path.join(path.dirname(found), target[1]);
  return resolved.toLowerCase().endsWith(".exe") ? [resolved] : ["node", resolved];
}

function readLines(child: ChildProcess, onLine: (line: string) => void): void {
  let buffer = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) onLine(line);
  });
  child.stdout?.on("end", () => {
    if (buffer) onLine(buffer);
  });
}

function lastLine(text: string): string {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .pop() ?? ""
  );
}
