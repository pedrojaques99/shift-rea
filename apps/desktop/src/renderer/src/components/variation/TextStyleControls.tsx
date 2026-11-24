import { useSignalState } from "@shift/editor/signals";
import { axisValue, externalAxisLocationFromLocation } from "@shift/editor/variation";
import type { NamedInstance } from "@shift/types";
import {
  Button,
  Check,
  ChevronDown,
  Menu,
  MenuItem,
  MenuPopup,
  MenuPortal,
  MenuPositioner,
  MenuTrigger,
} from "@shift/ui";
import FontSizeIcon from "@/assets/general/font-size.svg";
import { SidebarNumberField } from "@/components/editor/sidebar-right/SidebarNumberField";
import { useTextSettingsRun } from "@/hooks/useTextSettingsRun";
import { useExternalLocation } from "@/hooks/useExternalLocation";
import { useNamedInstances } from "@/hooks/useNamedInstances";
import { useEditor, useFontSession } from "@/workspace/WorkspaceContext";
import { AxesPanel } from "./AxesPanel";

/**
 * The text's style, as Figma's type panel shows it: a style menu over the font's
 * named instances (Regular, Bold, Italic…), then one slider per variable axis.
 *
 * @remarks
 * Both drive the window's axis location, which every proof text is laid out at.
 * A location between instances reads "Custom".
 */
export const TextStyleControls = ({ withSize = false }: { readonly withSize?: boolean }) => {
  const editor = useEditor();
  const textRun = useTextSettingsRun();
  const session = useFontSession();
  const instances = useNamedInstances();
  const [location] = useExternalLocation();
  const axes = useSignalState(session.font.externalAxesCell);

  const isAt = (instance: NamedInstance) =>
    axes.every((axis) => instance.location.values[axis.id] === axisValue(location, axis));
  const current = instances.find(isAt) ?? null;
  const pick = (instance: NamedInstance) =>
    editor.setExternalLocation(externalAxisLocationFromLocation(instance.location));

  return (
    <div className="flex flex-col gap-2">
      {/* The page's text size, outside typing too: the Text section shows its own field. */}
      {withSize && textRun ? (
        <SidebarNumberField
          ariaLabel="Font size"
          label={<FontSizeIcon aria-hidden className="size-4" />}
          value={textRun.node.size}
          onValueCommit={(size) =>
            editor.history.capture("Set font size", () =>
              editor.text.setSize(textRun.node.id, size),
            )
          }
        />
      ) : null}
      {instances.length > 0 ? (
        <Menu modal={false}>
          <MenuTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                aria-label="Style"
                className="h-7 w-full justify-between bg-input px-2"
              />
            }
          >
            <span className="truncate text-ui text-primary">{current?.name ?? "Custom"}</span>
            <span className="flex shrink-0 text-muted">
              <ChevronDown className="h-3 w-3" strokeWidth={1.75} />
            </span>
          </MenuTrigger>
          <MenuPortal>
            <MenuPositioner sideOffset={4} align="start">
              <MenuPopup className="max-h-80 overflow-y-auto">
                {instances.map((instance) => (
                  <MenuItem key={instance.id} onClick={() => pick(instance)}>
                    <span className="flex w-4 shrink-0">
                      {instance.id === current?.id ? <Check className="h-3 w-3" /> : null}
                    </span>
                    {instance.name}
                  </MenuItem>
                ))}
              </MenuPopup>
            </MenuPositioner>
          </MenuPortal>
        </Menu>
      ) : null}
      <AxesPanel actions={false} />
    </div>
  );
};
