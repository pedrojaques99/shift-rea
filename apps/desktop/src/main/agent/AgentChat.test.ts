import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import type { ChatEvent } from "@shared/agent/chat";
import { AgentChat } from "./AgentChat";
import { CHAT_ADAPTERS, readClaudeLine, readCodexLine } from "./chatProviders";

const FAKE_CLAUDE = path.join(import.meta.dirname, "fixtures", "fake-claude.mjs");
const TARGET = { serverName: "shift-dev", url: "http://127.0.0.1:17463/mcp", windowId: 3 };

describe("the agent chat runs a signed-in command-line agent against Shift's MCP", () => {
  afterEach(() => {
    delete process.env.SHIFT_CHAT_CMD_CLAUDE;
  });

  it("streams the agent's reply and tool calls, and ends once", async () => {
    process.env.SHIFT_CHAT_CMD_CLAUDE = JSON.stringify([process.execPath, FAKE_CLAUDE]);
    const chat = new AgentChat();
    const events: ChatEvent[] = [];

    await new Promise<void>((resolve) => {
      chat.send({ provider: "claude", prompt: "draw an O", sessionId: null }, TARGET, (event) => {
        events.push(event);
        if (event.kind === "finished") resolve();
      });
    });

    expect(events[0]).toEqual({ kind: "started", sessionId: "session-1" });
    expect(events).toContainEqual({ kind: "text", text: "heard: draw an O" });
    expect(events).toContainEqual({ kind: "tool", name: "shift.execute", summary: "Draw O" });
    expect(events.filter((event) => event.kind === "finished")).toEqual([
      { kind: "finished", ok: true, error: null, costUsd: 0.01 },
    ]);
  });

  it("gives Claude Code only Shift's MCP server and only its tools", () => {
    const args = CHAT_ADAPTERS.claude.args({
      sessionId: null,
      newSessionId: "new-id",
      serverName: "shift-dev",
      url: TARGET.url,
      context: "ctx",
    });

    expect(args).toContain("--strict-mcp-config");
    const allowed = args[args.indexOf("--allowedTools") + 1];
    expect(allowed.split(",")).toEqual([
      "mcp__shift-dev__shift.guide",
      "mcp__shift-dev__shift.describe",
      "mcp__shift-dev__shift.execute",
      "mcp__shift-dev__shift.capture",
    ]);
    expect(JSON.parse(args[args.indexOf("--mcp-config") + 1])).toEqual({
      mcpServers: { "shift-dev": { type: "http", url: TARGET.url } },
    });
    expect(args.slice(-2)).toEqual(["--session-id", "new-id"]);
  });

  it("continues a conversation with the session it started", () => {
    const args = CHAT_ADAPTERS.claude.args({
      sessionId: "session-1",
      newSessionId: "unused",
      serverName: "shift-dev",
      url: TARGET.url,
      context: "ctx",
    });

    expect(args.slice(-2)).toEqual(["--resume", "session-1"]);
  });

  it("runs Codex read-only with Shift's server added, and opens with the window's context", () => {
    const invocation = {
      sessionId: null,
      newSessionId: "x",
      serverName: "shift-dev",
      url: TARGET.url,
      context: "ctx",
    };

    const args = CHAT_ADAPTERS.codex.args(invocation);

    expect(args).toEqual(
      expect.arrayContaining([
        'sandbox_mode="read-only"',
        `mcp_servers.shift-dev.url="${TARGET.url}"`,
      ]),
    );
    expect(CHAT_ADAPTERS.codex.prompt("hi", invocation)).toBe("ctx\n\n---\n\nhi");
    expect(CHAT_ADAPTERS.codex.prompt("hi", { ...invocation, sessionId: "t1" })).toBe("hi");
  });

  it("reads Codex's JSON events as chat events", () => {
    expect(readCodexLine('{"type":"thread.started","thread_id":"t1"}')).toEqual([
      { kind: "started", sessionId: "t1" },
    ]);
    expect(
      readCodexLine('{"type":"item.completed","item":{"type":"agent_message","text":"Done."}}'),
    ).toEqual([{ kind: "text", text: "Done." }]);
    expect(readCodexLine('{"type":"turn.failed","error":{"message":"quota"}}')).toEqual([
      { kind: "finished", ok: false, error: "quota", costUsd: null },
    ]);
  });

  it("ignores lines that are not events", () => {
    expect(readClaudeLine("warning: something")).toEqual([]);
    expect(readClaudeLine('{"type":"user"}')).toEqual([]);
  });
});
