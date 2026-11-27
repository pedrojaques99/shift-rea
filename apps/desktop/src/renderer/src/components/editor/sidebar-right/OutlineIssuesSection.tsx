import { useState } from "react";
import { Eye, EyeOff, Wand2 } from "lucide-react";
import { Button, Tooltip, cn } from "@shift/ui";
import type { CraftIssue } from "@shift/editor";
import { ascending, comparing, type SourceId } from "@shift/types";
import { useSignalState } from "@shift/editor/signals";
import { useEditor } from "@/workspace/WorkspaceContext";
import { SidebarSection } from "./SidebarSection";

/** Rows shown before the list folds the rest behind "Show all". */
const FOLDED_ROWS = 6;

/** Where a row sorts: the master being edited first, then between masters, then the rest. */
function rank(issue: CraftIssue, activeSourceId: SourceId | null): number {
  if (issue.sourceId === activeSourceId) return 0;
  if (issue.sourceId === null) return 1;
  return 2;
}

/**
 * The craft review of the open glyph: what reads as unfinished in its outline,
 * where, and the fix for each.
 *
 * @remarks
 * Hidden while the glyph is clean, so it costs nothing when there is nothing
 * to say. Problems in the master being edited come first; a row elsewhere
 * takes the canvas to its master. Clicking a row selects its point; the wand
 * fixes it; Fix All fixes the glyph in every master, as one undo step.
 */
export const OutlineIssuesSection = () => {
  const editor = useEditor();
  const issues = useSignalState(editor.craft.issuesCell, { schedule: "frame" });
  const visible = useSignalState(editor.craft.visibleCell);
  const activeSourceId = useSignalState(editor.activeSourceIdCell);
  const [expanded, setExpanded] = useState(false);

  if (issues.length === 0) return null;

  const ordered = [...issues].sort(comparing((issue) => rank(issue, activeSourceId), ascending));
  // At a master, its own problems and those between masters lead; the other
  // masters' wait behind one line. Between masters, every master's are listed.
  const here =
    activeSourceId === null
      ? ordered
      : ordered.filter((issue) => issue.sourceId === activeSourceId || issue.sourceId === null);
  const elsewhere = ordered.length - here.length;
  const otherMasters = new Set(
    ordered.filter((issue) => !here.includes(issue)).map((issue) => issue.sourceId),
  ).size;
  const shown = expanded ? ordered : here;
  let moreLabel = `Show all ${here.length}`;
  if (expanded) moreLabel = "Show this master only";
  else if (elsewhere > 0)
    moreLabel = `+${elsewhere} in ${otherMasters} other master${otherMasters === 1 ? "" : "s"}`;
  const rows = expanded ? shown : shown.slice(0, FOLDED_ROWS);
  const fixable = issues.filter((issue) => issue.fix).length;
  const sourceName = (issue: CraftIssue) =>
    issue.sourceId === null
      ? "All masters"
      : (editor.font.source(issue.sourceId)?.name ?? "Master");

  return (
    <SidebarSection
      title={`Outline · ${issues.length}`}
      actions={
        <div className="flex items-center gap-1">
          <Tooltip content={visible ? "Hide markers on the canvas" : "Show markers on the canvas"}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={visible ? "Hide outline markers" : "Show outline markers"}
              aria-pressed={visible}
              className="text-sidebar-icon"
              onClick={() => editor.craft.toggleVisible()}
            >
              {visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            </Button>
          </Tooltip>
          {fixable > 0 ? (
            <Tooltip content="Fix every issue in this glyph, in every master (Shift+F)">
              <Button variant="muted" size="sm" onClick={() => void editor.craft.fix(issues)}>
                Fix all
              </Button>
            </Tooltip>
          ) : null}
        </div>
      }
    >
      <ul className="flex flex-col">
        {rows.map((issue) => (
          <li
            key={`${issue.code}:${issue.sourceId ?? "all"}:${[...issue.points].join(",")}`}
            className="group flex h-7 items-center gap-2 rounded px-1 hover:bg-hover"
          >
            <Tooltip content={issue.message}>
              <button
                type="button"
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left outline-none focus-visible:ring-1 focus-visible:ring-accent"
                onClick={() => editor.craft.reveal(issue)}
              >
                <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-canvas-orange" />
                <span className="truncate text-ui text-primary">{issue.summary}</span>
                <span
                  className={cn(
                    "ml-auto shrink-0 truncate text-ui",
                    "text-secondary",
                    issue.sourceId !== activeSourceId && "opacity-60",
                  )}
                >
                  {sourceName(issue)}
                </span>
              </button>
            </Tooltip>
            {issue.fix ? (
              <Tooltip content={`${issue.fix.label} (F)`}>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={issue.fix.label}
                  className="shrink-0 text-sidebar-icon opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => void editor.craft.fix([issue])}
                >
                  <Wand2 className="size-3.5" />
                </Button>
              </Tooltip>
            ) : null}
          </li>
        ))}
      </ul>
      {here.length === 0 && !expanded ? (
        <p className="text-ui text-secondary">This master is clean.</p>
      ) : null}
      {expanded || here.length > FOLDED_ROWS || elsewhere > 0 ? (
        <button
          type="button"
          className="self-start text-ui text-secondary hover:text-primary"
          onClick={() => setExpanded(!expanded)}
        >
          {moreLabel}
        </button>
      ) : null}
    </SidebarSection>
  );
};
