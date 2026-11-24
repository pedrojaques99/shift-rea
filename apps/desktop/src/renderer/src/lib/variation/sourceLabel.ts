import { standardWeightName } from "@shift/wasm";
import type { Axis } from "@shift/types";

/**
 * Names a source the way a designer reads a style: "Regular Oblique · Ink Traps".
 *
 * @remarks
 * Reads the source's **user** location (`font.externalLocationForSource`), the space axis labels
 * live in. Each external axis contributes its authored label at that value; an elidable label is
 * dropped only at the axis default, so two sources never collapse into one name, and the weight
 * always shows ("Regular Oblique", never a bare "Oblique"). Without a label,
 * `wght` uses the standard weight name, `slnt`/`ital` say "Italic" off zero, and any other axis
 * says its name off its default.
 *
 * @param fallback - the source's authored name, used when no axis says anything.
 * @param location - the source's user-space location.
 * @param axes - the font's axes, in display order.
 * @returns a friendly name such as "ExtraBold Oblique · Ink Traps".
 */
export function sourceLabel(
  fallback: string,
  location: ReadonlyMap<string, number>,
  axes: readonly Axis[],
): string {
  const style: string[] = [];
  const extras: string[] = [];

  for (const axis of axes) {
    if (axis.role !== "external") continue;

    const value = location.get(axis.id);
    if (value === undefined) continue;

    const word = axisWord(axis, value);
    if (!word) continue;

    if (isStyleAxis(axis.tag)) style.push(word);
    else extras.push(word);
  }

  if (style.length === 0 && extras.length === 0) return fallback;

  const head = style.length > 0 ? style.join(" ") : "Regular";

  return [head, ...extras].join(" · ");
}

function isStyleAxis(tag: string): boolean {
  return tag === "wght" || tag === "slnt" || tag === "ital";
}

function axisWord(axis: Axis, value: number): string | null {
  // Axis labels are plain data, not signals: destructure so the reactive-read lint stays quiet.
  const label = axis.labels.find(({ value: labelValue }) => labelValue === value);
  const atDefault = value === axis.kind.default;
  const weight = axis.tag === "wght";
  if (label) return label.elidable && atDefault && !weight ? null : label.name;

  switch (axis.tag) {
    case "wght":
      // shift-font owns the table (`weight_class`), shared with `shift-cli instance add`.
      return standardWeightName(value) || `Weight ${value}`;
    case "slnt":
    case "ital":
      return value === 0 ? null : "Italic";
    default:
      return value === axis.kind.default ? null : axis.name;
  }
}
