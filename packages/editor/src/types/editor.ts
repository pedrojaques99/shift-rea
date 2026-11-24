import type { ToolMenuItem, ToolName } from "../lib/tools/core";

export type ToolStateScope = "app" | "document";

export type CursorType =
  | { type: "default" }
  | { type: "pointer" }
  | { type: "grab" }
  | { type: "grabbing" }
  | { type: "move" }
  | { type: "copy" }
  | { type: "add" }
  | { type: "bend" }
  | { type: "spacing" }
  | { type: "end" }
  | { type: "point" }
  | { type: "point-move" }
  | { type: "handle" }
  | { type: "handle-move" }
  | { type: "anchor" }
  | { type: "anchor-move" }
  | { type: "segment" }
  | { type: "component" }
  | { type: "crosshair" }
  | { type: "crosshair-circle" }
  | { type: "crosshair-square" }
  | { type: "pen" }
  | { type: "pen-add" }
  | { type: "pen-end" }
  | { type: "pen-close" }
  | { type: "not-allowed" }
  | { type: "ew-resize" }
  | { type: "ns-resize" }
  | { type: "nwse-resize" }
  | { type: "nesw-resize" }
  | { type: "rotate-tl" }
  | { type: "rotate-tr" }
  | { type: "rotate-bl" }
  | { type: "rotate-br" }
  | { type: "text" };

export type VisualState = "idle" | "hovered" | "selected";

export interface ToolRegistryItem {
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  tooltip: string;
  shortcut?: string;
  onSelect?: () => void;
  // oxlint-disable-next-line shift/no-optional-collection-field -- absent renders a plain button; present renders a menu button
  menuItems?: readonly ToolMenuItem[];
  hidden?: boolean;
  disabled?: boolean;
}

export interface TemporaryToolOptions {
  onActivate?: () => void;
  onReturn?: () => void;
}

export interface ToolSwitchHandler {
  requestTemporary: (toolId: ToolName, options?: TemporaryToolOptions) => void;
  returnFromTemporary: () => void;
}
