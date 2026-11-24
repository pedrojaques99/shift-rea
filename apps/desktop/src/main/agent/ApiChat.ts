import crypto from "node:crypto";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMCPClient } from "@ai-sdk/mcp";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { isStepCount, streamText, type LanguageModel, type ModelMessage } from "ai";
import { API_VENDORS, type ApiVendor, type ChatEvent } from "../../shared/agent/chat";
import { toolSummary } from "./chatProviders";

/** How many model turns one message may take while it calls Shift's tools. */
const MAX_STEPS = 40;

/** Where the chat finds the user's keys: {@link AgentKeys} in the app. */
export interface ApiKeySource {
  key(vendor: ApiVendor): string | null;
}

/** One message to a model the user reaches with their own key. */
export interface ApiChatRequest {
  /** `vendor:model`, as {@link ApiChat.models} lists it. */
  model: string;
  prompt: string;
  sessionId: string | null;
  serverName: string;
  url: string;
  context: string;
}

/**
 * The agent chat over the user's own API keys: the model runs through the
 * AI SDK with Shift's MCP tools, so it edits the font as any agent does.
 *
 * @remarks
 * Conversations live in memory for the app's lifetime, by session id.
 */
export class ApiChat {
  readonly #keys: ApiKeySource;
  readonly #modelFor: ((id: string) => LanguageModel) | null;
  // non-reactive: main-process conversation history and run handles.
  readonly #history = new Map<string, ModelMessage[]>();
  readonly #runs = new Map<string, AbortController>();
  #models: { at: number; list: string[] } | null = null;

  /**
   * @param keys - The user's keys.
   * @param modelFor - Builds the model for a `vendor:model` id; defaults to the
   *   vendors' AI SDK providers (tests pass a simulated model).
   */
  constructor(keys: ApiKeySource, modelFor: ((id: string) => LanguageModel) | null = null) {
    this.#keys = keys;
    this.#modelFor = modelFor;
  }

  /** Whether any vendor has a key, so the chat can offer "Your API key". */
  available(): boolean {
    return API_VENDORS.some((vendor) => this.#keys.key(vendor) !== null);
  }

  /**
   * The models each keyed vendor offers for chat with tools, as `vendor:model`,
   * from the vendors' own model lists; cached for ten minutes.
   */
  async models(): Promise<string[]> {
    if (this.#models && Date.now() - this.#models.at < 600_000) return this.#models.list;

    const lists = await Promise.all(
      API_VENDORS.map(async (vendor) => {
        const key = this.#keys.key(vendor);
        if (!key) return [];
        try {
          return (await listVendorModels(vendor, key)).map((model) => `${vendor}:${model}`);
        } catch {
          return [];
        }
      }),
    );
    const list = lists.flat();
    this.#models = { at: Date.now(), list };
    return list;
  }

  /** Forgets cached model lists, as after a key changes. */
  forgetModels(): void {
    this.#models = null;
  }

  /** Sends one message; events stream to `onEvent`, ending with `finished`. */
  send(request: ApiChatRequest, onEvent: (event: ChatEvent) => void): string {
    const runId = crypto.randomUUID();
    const abort = new AbortController();
    this.#runs.set(runId, abort);
    void this.#run(request, abort.signal, onEvent).finally(() => this.#runs.delete(runId));
    return runId;
  }

  stop(runId: string): void {
    this.#runs.get(runId)?.abort();
    this.#runs.delete(runId);
  }

  stopAll(): void {
    for (const abort of this.#runs.values()) abort.abort();
    this.#runs.clear();
  }

  async #run(
    request: ApiChatRequest,
    signal: AbortSignal,
    onEvent: (event: ChatEvent) => void,
  ): Promise<void> {
    const sessionId = request.sessionId ?? crypto.randomUUID();
    onEvent({ kind: "started", sessionId });
    let client: Awaited<ReturnType<typeof createMCPClient>> | null = null;
    try {
      const model = this.#model(request.model);
      client = await createMCPClient({ transport: { type: "http", url: request.url } });
      const tools = await client.tools();
      const messages: ModelMessage[] = [
        ...(this.#history.get(sessionId) ?? []),
        { role: "user", content: request.prompt },
      ];

      const result = streamText({
        model,
        system: request.context,
        messages,
        tools,
        stopWhen: isStepCount(MAX_STEPS),
        abortSignal: signal,
      });

      let text = "";
      for await (const part of result.stream) {
        switch (part.type) {
          case "text-delta":
            text += part.text;
            break;
          case "text-end":
            if (text.trim()) onEvent({ kind: "text", text });
            text = "";
            break;
          case "tool-call":
            onEvent({ kind: "tool", name: part.toolName, summary: toolSummary(part.input) });
            break;
          case "error":
            throw part.error instanceof Error ? part.error : new Error(String(part.error));
          default:
            break;
        }
      }
      if (text.trim()) onEvent({ kind: "text", text });

      this.#history.set(sessionId, [...messages, ...(await result.responseMessages)]);
      onEvent({ kind: "finished", ok: true, error: null, costUsd: null });
    } catch (error) {
      // A stop is not a failure: the run ends quietly.
      if (signal.aborted) {
        onEvent({ kind: "finished", ok: true, error: null, costUsd: null });
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      onEvent({ kind: "finished", ok: false, error: message, costUsd: null });
    } finally {
      await client?.close();
    }
  }

  #model(id: string): LanguageModel {
    if (this.#modelFor) return this.#modelFor(id);

    const separator = id.indexOf(":");
    const vendor = id.slice(0, separator) as ApiVendor;
    const model = id.slice(separator + 1);
    const apiKey = this.#keys.key(vendor);
    if (!apiKey || !model)
      throw new Error(`No API key for ${vendor}; add one in Settings → Agents`);

    switch (vendor) {
      case "anthropic":
        return createAnthropic({ apiKey })(model);
      case "openai":
        return createOpenAI({ apiKey })(model);
      case "google":
        return createGoogleGenerativeAI({ apiKey })(model);
      case "openrouter":
        return createOpenRouter({ apiKey })(model);
    }
  }
}

/** A vendor's chat models, from its own model list. */
async function listVendorModels(vendor: ApiVendor, key: string): Promise<string[]> {
  switch (vendor) {
    case "anthropic": {
      const body = await getJson("https://api.anthropic.com/v1/models?limit=100", {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      });
      return ids(body.data);
    }
    case "openai": {
      const body = await getJson("https://api.openai.com/v1/models", {
        Authorization: `Bearer ${key}`,
      });
      return ids(body.data).filter(
        (id) => !/embed|tts|whisper|dall-e|moderation|audio|image|realtime|transcribe/i.test(id),
      );
    }
    case "google": {
      const body = await getJson("https://generativelanguage.googleapis.com/v1beta/models", {
        "x-goog-api-key": key,
      });
      const models = Array.isArray(body.models) ? body.models : [];
      return models
        .filter(
          (model: Record<string, unknown>) =>
            Array.isArray(model.supportedGenerationMethods) &&
            model.supportedGenerationMethods.includes("generateContent"),
        )
        .map((model: Record<string, unknown>) => String(model.name).replace(/^models\//, ""));
    }
    case "openrouter": {
      const body = await getJson("https://openrouter.ai/api/v1/models", {
        Authorization: `Bearer ${key}`,
      });
      const models = Array.isArray(body.data) ? body.data : [];
      return models
        .filter(
          (model: Record<string, unknown>) =>
            Array.isArray(model.supported_parameters) &&
            model.supported_parameters.includes("tools"),
        )
        .map((model: Record<string, unknown>) => String(model.id));
    }
  }
}

async function getJson(
  url: string,
  headers: Record<string, string>,
): Promise<Record<string, unknown>> {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);

  return (await response.json()) as Record<string, unknown>;
}

function ids(data: unknown): string[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((item: unknown) =>
      typeof item === "object" && item && "id" in item ? String(item.id) : "",
    )
    .filter(Boolean)
    .sort();
}
