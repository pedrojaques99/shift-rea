import { useState, type ComponentType } from "react";
import { Tooltip } from "@shift/ui";
import {
  CollapsibleSection,
  SidebarActionButton,
  type CollapsibleSectionProps,
} from "@/components/sidebar";
import { CreateSourceMenu } from "./CreateSourceMenu";
import { Sources } from "./Sources";
import { OutlineVisibilityButton } from "./OutlineVisibilityButton";
import { useActiveSourceId } from "@/hooks/useActiveSourceId";
import { useSources } from "@/hooks/useSources";
import { OutlineTargets } from "@shift/editor/model";
import type { GlyphOutlineControls } from "@shift/editor/types";
import { useFontSession } from "@/workspace/WorkspaceContext";
import PlusIcon from "@/assets/general/plus.svg";

interface SourcesSectionProps {
  defaultOpen?: boolean;
  /** Draws the section, so it can match the sections around it. */
  section?: ComponentType<CollapsibleSectionProps>;
  outlineControls?: GlyphOutlineControls;
}

export const SourcesSection = ({
  defaultOpen = false,
  outlineControls,
  section: Section = CollapsibleSection,
}: SourcesSectionProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const [sourceMenuOpen, setSourceMenuOpen] = useState(false);
  const canAuthor = useFontSession().mode === "workspace";
  const activeSourceId = useActiveSourceId();
  const sources = useSources();
  const sourceTargets = OutlineTargets.sources(
    sources.filter((source) => source.id !== activeSourceId).map((source) => source.id),
  );
  const toggleAll = () => outlineControls?.onToggleGroup(sourceTargets);

  return (
    <Section
      title="Sources"
      open={open || sourceMenuOpen}
      onOpenChange={setOpen}
      isActive={sourceMenuOpen}
      actions={
        <>
          {outlineControls && sourceTargets.size > 0 && (
            <OutlineVisibilityButton
              visible={outlineControls.groupActive}
              alwaysOpen
              label="all source outlines"
              onClick={toggleAll}
            />
          )}
          {canAuthor ? (
            <CreateSourceMenu onOpenChange={setSourceMenuOpen} />
          ) : (
            <Tooltip content="Create source">
              <SidebarActionButton label="Create source" aria-disabled>
                <PlusIcon className="h-3 w-3" />
              </SidebarActionButton>
            </Tooltip>
          )}
        </>
      }
    >
      {/* Says, in a designer's words, what this list is and how it differs from the other. */}
      <p className="pb-1 pl-2 text-ui text-muted">
        The drawings you edit. Every style is mixed from them, and kerning is set on them.
      </p>
      <Sources canAuthor={canAuthor} outlineControls={outlineControls} />
    </Section>
  );
};
