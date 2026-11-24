import { useSignalState } from "@shift/editor/signals";
import { axisValue, withExternalAxisValue } from "@shift/editor/variation";
import type { Axis } from "@shift/types";
import type { Axis as ModelAxis } from "@shift/editor/model";
import {
  Button,
  Menu,
  MenuItem,
  MenuPopup,
  MenuPortal,
  MenuPositioner,
  MenuSeparator,
  MenuTrigger,
  Tooltip,
} from "@shift/ui";
import { InspectorSlider } from "@/components/visant/ui/inspector-controls";
import VerticalElipsis from "@/assets/general/vertical-ellipsis.svg";
import { useSettingsNavigation } from "@/context/SettingsNavigationContext";
import { useExternalLocation } from "@/hooks/useExternalLocation";
import { useFontSession } from "@/workspace/WorkspaceContext";
import { formatAxisValue, parseAxisText } from "./axisSliderText";

/**
 * The Font axes rows: one inspector slider per varying axis (the row is the
 * slider: drag it, click to type, double-click for the default), and in a
 * workspace a ⋮ menu to edit, reset or delete the axis.
 */
export const AxesPanel = ({ actions = true }: { readonly actions?: boolean }) => {
  const session = useFontSession();
  const [location, setExternalLocation] = useExternalLocation();
  const settings = useSettingsNavigation();
  const axes = useSignalState(session.font.externalAxesCell).filter(
    (axis) => !axis.isDiscrete && axis.varies,
  );

  if (axes.length === 0) return <p className="pl-2 text-ui text-muted">No varying axes</p>;

  return (
    <div className={actions ? "flex flex-col gap-1 pl-2" : "flex flex-col gap-1"}>
      {axes.map((axis) => {
        const value = axisValue(location, axis);
        const setValue = (next: number) =>
          setExternalLocation(withExternalAxisValue(location, axis, next));

        return (
          <div
            key={axis.id}
            title={axisHint(axis)}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1"
          >
            <InspectorSlider
              label={axis.name}
              value={value}
              min={axis.minimum}
              max={axis.maximum}
              step={0.01}
              defaultValue={axis.default}
              format={formatAxisValue}
              parse={(text) => parseAxisText(text, value)}
              onValueChange={setValue}
            />
            {actions && session.mode === "workspace" ? (
              <AxisActionsMenu
                axis={axis}
                onEdit={() => settings.open({ category: "axes", axisId: axis.id })}
                onReset={() => setValue(axis.kind.default)}
                onDelete={() => session.font.deleteAxis(axis.id)}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

interface AxisActionsMenuProps {
  axis: Axis;
  onEdit: () => void;
  onReset: () => void;
  onDelete: () => void;
}

const AxisActionsMenu = ({ axis, onEdit, onReset, onDelete }: AxisActionsMenuProps) => (
  <Menu modal={false}>
    <Tooltip content={`Actions for ${axis.name}`}>
      <MenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${axis.name}`} />}
      >
        <VerticalElipsis className="h-5 w-5 text-icon-subtle" />
      </MenuTrigger>
    </Tooltip>
    <MenuPortal>
      <MenuPositioner sideOffset={4} align="start">
        <MenuPopup>
          <MenuItem onClick={onEdit}>Edit</MenuItem>
          <MenuItem onClick={onReset}>Reset</MenuItem>
          <MenuSeparator />
          <MenuItem onClick={onDelete}>Delete</MenuItem>
        </MenuPopup>
      </MenuPositioner>
    </MenuPortal>
  </Menu>
);

/** What each registered axis changes, in a designer's words. */
const AXIS_HINTS: Readonly<Record<string, string>> = {
  wght: "How heavy the letters are, from thin to black",
  wdth: "How wide the letters are, from condensed to extended",
  opsz: "Tunes the design for the size it is read at",
  slnt: "How far the letters lean",
  ital: "Switches to the italic forms",
};

/** The hover hint for an axis row: what it does, then its range. Double-click resets it. */
function axisHint(axis: ModelAxis): string {
  const what = AXIS_HINTS[axis.tag] ?? `${axis.name}, an axis of this font`;
  return `${what} (${axis.minimum} to ${axis.maximum}). Drag, type, or double-click to reset.`;
}
