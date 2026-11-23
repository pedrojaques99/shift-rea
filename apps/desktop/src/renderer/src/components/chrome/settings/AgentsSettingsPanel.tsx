import { useEffect, useState } from "react";
import { Button, Check, Copy, Input, Switch, Tooltip } from "@shift/ui";
import {
  API_VENDORS,
  type ApiKeysState,
  type ApiVendor,
  type ChatProvider,
} from "@shared/agent/chat";
import type { AgentConnectionsState } from "@shared/agent/connections";
import { getShiftHost } from "@/host/shiftHost";
import { useAgentConnections } from "@/hooks/useAgentConnections";

const EXAMPLE_PROMPT = "Look at the glyph I have open in Shift and describe its contours.";

/** Settings → Agents: allow local agents to connect, and how to connect them. */
export const AgentsSettingsPanel = () => {
  const state = useAgentConnections();
  const [pending, setPending] = useState(false);

  if (!state) return null;

  return (
    <section className="flex h-full flex-col gap-5 overflow-y-auto p-6" aria-label="Agents">
      <header className="flex flex-col gap-1 pr-8">
        <h2 className="text-sm font-medium text-primary">Agents</h2>
        <p className="text-ui text-secondary">
          Let AI agents on this computer work on your open fonts through Shift's MCP server. Agents
          can inspect, check and edit them; each edit is one undo step, and only you save or export.
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <label className="flex items-center justify-between gap-4 text-sm text-primary">
          Allow agent connections
          <Switch
            checked={state.allowed}
            aria-label="Allow agent connections"
            disabled={pending}
            onCheckedChange={async (allowed) => {
              setPending(true);
              try {
                await getShiftHost().agentConnections.setAllowed(allowed);
              } finally {
                setPending(false);
              }
            }}
          />
        </label>
        <ConnectionStatus state={state} />
      </div>

      <DetectedAgents />

      <ApiKeys />

      <ConnectionSteps state={state} />
    </section>
  );
};

/** The command-line agents found on this computer, which the Agent panel can run. */
const DetectedAgents = () => {
  const [providers, setProviders] = useState<readonly ChatProvider[] | null>(null);
  const [scanning, setScanning] = useState(false);

  const scan = async () => {
    setScanning(true);
    try {
      setProviders(await getShiftHost().agentChat.providers());
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    void scan();
  }, []);

  return (
    <div className="flex flex-col gap-2" aria-label="Agents on this computer">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-sm text-primary">Agents on this computer</h3>
        <Button variant="outline" size="sm" disabled={scanning} onClick={() => void scan()}>
          {scanning ? "Looking…" : "Look again"}
        </Button>
      </div>
      <p className="text-ui text-secondary">
        The Agent panel runs the ones you are signed in to, with your own subscription, and lets
        them reach this font only through Shift.
      </p>
      <ul className="flex flex-col gap-1">
        {(providers ?? []).map((provider) => (
          <li key={provider.id} className="flex items-center gap-2 text-ui">
            <span aria-hidden className={provider.installed ? "text-accent" : "text-muted"}>
              ●
            </span>
            <span className="text-primary">{provider.name}</span>
            <span className="text-muted">{agentStatus(provider)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

const VENDOR_NAMES: Record<ApiVendor, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  openrouter: "OpenRouter",
};

/** The user's own API keys: the Agent panel offers "Your API key" once one is set. */
const ApiKeys = () => {
  const [state, setState] = useState<ApiKeysState | null>(null);

  useEffect(() => {
    let live = true;
    const load = async () => {
      const next = await getShiftHost().agentKeys.state();
      if (live) setState(next);
    };
    void load();
    return () => {
      live = false;
    };
  }, []);

  if (!state) return null;

  return (
    <div className="flex flex-col gap-2" aria-label="Your own API keys">
      <h3 className="text-sm text-primary">Your own API keys</h3>
      <p className="text-ui text-secondary">
        No subscription? Use a key instead. Keys are encrypted with this computer's keychain and
        only go to their own vendor.
      </p>
      <ul className="flex flex-col gap-2">
        {API_VENDORS.map((vendor) => (
          <ApiKeyRow key={vendor} vendor={vendor} saved={state[vendor]} onChange={setState} />
        ))}
      </ul>
    </div>
  );
};

const ApiKeyRow = ({
  vendor,
  saved,
  onChange,
}: {
  vendor: ApiVendor;
  saved: boolean;
  onChange: (state: ApiKeysState) => void;
}) => {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const name = VENDOR_NAMES[vendor];

  const save = async (key: string | null) => {
    setError(null);
    try {
      onChange(await getShiftHost().agentKeys.set(vendor, key));
      setDraft("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  };

  return (
    <li className="flex flex-col gap-1">
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void save(draft);
        }}
      >
        <span className="w-24 shrink-0 text-ui text-primary">{name}</span>
        <Input
          type="password"
          autoComplete="off"
          aria-label={`${name} API key`}
          placeholder={saved ? "Saved · type to replace" : "Paste a key"}
          value={draft}
          className="min-w-0 flex-1"
          onChange={(event) => setDraft(event.target.value)}
        />
        <Button type="submit" variant="outline" size="sm" aria-disabled={!draft.trim()}>
          Save
        </Button>
        {saved ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => void save(null)}>
            Remove
          </Button>
        ) : null}
      </form>
      {error ? (
        <p role="alert" className="text-ui text-error">
          {error}
        </p>
      ) : null}
    </li>
  );
};

function agentStatus(provider: ChatProvider): string {
  if (!provider.installed) return "not found";
  if (provider.models.length > 0) return `found · ${provider.models.length} models`;

  return "found";
}

const ConnectionStatus = ({ state }: { state: AgentConnectionsState }) => {
  const now = useNow(5_000);

  if (state.status === "off") return null;
  if (state.status === "failed") {
    return (
      <p role="alert" className="text-ui text-error">
        {state.error}
      </p>
    );
  }

  const { lastRequestAt, clients } = state.activity;
  const names = clients.map(({ name }) => name).join(", ");
  return (
    <p className="flex items-center gap-2 text-ui text-secondary" aria-label="Agent activity">
      <span aria-hidden className={lastRequestAt === null ? "text-muted" : "text-accent"}>
        ●
      </span>
      {lastRequestAt === null
        ? "Listening. No agent has connected yet."
        : `${names || "An agent"} · last request ${relativeTime(now - lastRequestAt)}`}
    </p>
  );
};

const ConnectionSteps = ({ state }: { state: AgentConnectionsState }) => {
  const { serverName, url } = state;
  const claudeCommand = `claude mcp add --transport http --scope user ${serverName} ${url}`;
  const config = JSON.stringify({ mcpServers: { [serverName]: { type: "http", url } } }, null, 2);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-ui font-medium text-primary">Connect an agent</h3>
      <ol className="flex list-decimal flex-col gap-4 pl-4 text-ui text-secondary marker:text-muted">
        <li>
          <div className="flex flex-col gap-2">
            For Claude Code, run this in your terminal:
            <CodeSnippet label="Claude Code command" text={claudeCommand} />
            For other agents, add Shift to the agent's MCP config:
            <CodeSnippet label="MCP config" text={config} />
            <span className="text-muted">
              Shift runs a Streamable HTTP MCP server on this computer. Your agent may use a
              different config format, so check its documentation and adapt the snippet as needed.
            </span>
          </div>
        </li>
        <li>
          <div className="flex flex-col gap-2">
            Ask your agent something about your font to test the connection:
            <CodeSnippet label="Example prompt" text={EXAMPLE_PROMPT} />
          </div>
        </li>
      </ol>
    </div>
  );
};

const CodeSnippet = ({ label, text }: { label: string; text: string }) => (
  <div className="relative">
    <pre
      aria-label={label}
      className="overflow-x-auto whitespace-pre-wrap rounded border border-line-subtle bg-surface py-2 pl-3 pr-10 font-mono text-ui text-primary"
    >
      {text}
    </pre>
    <CopyButton text={text} label={`Copy ${label.toLowerCase()}`} />
  </div>
);

const CopyButton = ({ text, label }: { text: string; label: string }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 1_500);
    return () => clearTimeout(timeout);
  }, [copied]);

  return (
    <Tooltip content={copied ? "Copied" : label}>
      <Button
        variant="muted"
        size="icon-sm"
        aria-label={label}
        className="absolute right-1.5 top-1.5"
        onClick={async () => {
          await getShiftHost().clipboard.writeText(text);
          setCopied(true);
        }}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </Tooltip>
  );
};

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);
  return now;
}

function relativeTime(elapsedMs: number): string {
  const seconds = Math.max(0, Math.round(elapsedMs / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.round(minutes / 60)}h ago`;
}
