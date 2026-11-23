import { afterEach, describe, expect, it } from "vitest";
import { MockLanguageModelV4, convertArrayToReadableStream } from "ai/test";
import { ShiftMcpServer } from "@shift/mcp";
import type { ChatEvent } from "@shared/agent/chat";
import { ApiChat } from "./ApiChat";

const USAGE = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

/** A model that edits through shift.execute on its first turn and reports on its second. */
function editingModel() {
  let turn = 0;
  return new MockLanguageModelV4({
    doStream: async () => {
      turn += 1;
      const parts =
        turn === 1
          ? [
              { type: "stream-start", warnings: [] },
              {
                type: "tool-call",
                toolCallId: "call-1",
                toolName: "shift.execute",
                input: JSON.stringify({
                  code: 'async () => shift.edits.apply({ windowId: 1, label: "Draw O", intents: [] })',
                }),
              },
              {
                type: "finish",
                usage: USAGE,
                finishReason: { unified: "tool-calls", raw: "tool_use" },
              },
            ]
          : [
              { type: "stream-start", warnings: [] },
              { type: "text-start", id: "t1" },
              { type: "text-delta", id: "t1", delta: "Drew the O." },
              { type: "text-end", id: "t1" },
              { type: "finish", usage: USAGE, finishReason: { unified: "stop", raw: "end_turn" } },
            ];
      return { stream: convertArrayToReadableStream(parts as never[]) };
    },
  });
}

const servers: ShiftMcpServer[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.stop()));
});

describe("the agent chat with the user's own API key", () => {
  it("lets the model call Shift's MCP tools and streams its reply", async () => {
    const executed: string[] = [];
    const server = new ShiftMcpServer({
      execute: async (code) => {
        executed.push(code);
        return { fontRevision: "r1", value: { ids: {} } };
      },
      capture: async () => {
        throw new Error("no window");
      },
      port: 0,
      serverInfo: { name: "shift-dev", version: "0.2.0" },
    });
    servers.push(server);
    const { url } = await server.start();
    const chat = new ApiChat({ key: () => "test-key" }, () => editingModel());
    const events: ChatEvent[] = [];

    await new Promise<void>((resolve) => {
      chat.send(
        {
          model: "anthropic:test",
          prompt: "Draw an O",
          sessionId: null,
          serverName: "shift-dev",
          url,
          context: "ctx",
        },
        (event) => {
          events.push(event);
          if (event.kind === "finished") resolve();
        },
      );
    });

    expect(executed).toHaveLength(1);
    expect(executed[0]).toContain("shift.edits.apply");
    expect(events).toContainEqual({ kind: "tool", name: "shift.execute", summary: "Draw O" });
    expect(events).toContainEqual({ kind: "text", text: "Drew the O." });
    expect(events.at(-1)).toEqual({ kind: "finished", ok: true, error: null, costUsd: null });
  });

  it("says a key is missing instead of calling a vendor", async () => {
    const chat = new ApiChat({ key: () => null });

    expect(chat.available()).toBe(false);
    const finished = await new Promise<ChatEvent>((resolve) => {
      chat.send(
        {
          model: "anthropic:claude",
          prompt: "hi",
          sessionId: null,
          serverName: "shift-dev",
          url: "http://127.0.0.1:1/mcp",
          context: "ctx",
        },
        (event) => {
          if (event.kind === "finished") resolve(event);
        },
      );
    });
    expect(finished).toMatchObject({ kind: "finished", ok: false });
  });
});
