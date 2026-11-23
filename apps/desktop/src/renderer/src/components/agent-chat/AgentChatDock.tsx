import { useState } from "react";
import { Button, Tooltip, X } from "@shift/ui";
import { AgentChatPanel } from "./AgentChatPanel";

/**
 * The agent chat, docked over the canvas's top-right corner: a button that
 * opens the panel, so the canvas keeps its width until the user asks.
 */
export function AgentChatDock() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="absolute top-3 right-3 z-10">
        <Tooltip content="Open the agent">
          <Button variant="default" size="sm" onClick={() => setOpen(true)}>
            Agent
          </Button>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="absolute top-3 right-3 bottom-3 z-10 flex w-88 flex-col overflow-hidden rounded-lg border border-line-subtle shadow-lg">
      <div className="absolute top-1.5 right-1.5 z-10">
        <Tooltip content="Close the agent">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close the agent"
            onClick={() => setOpen(false)}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </Tooltip>
      </div>
      <AgentChatPanel />
    </div>
  );
}
