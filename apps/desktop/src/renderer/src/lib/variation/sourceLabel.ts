import type { Axis } from "@shift/types";

/**
 * Standard weight-class names, the same table `shift-cli instance add --standard-weights` uses.
 *
 * @remarks
 * Display-only. TODO(rea): expose the Rust table through `shift-wasm` instead of mirroring it.
 */
const STANDARD_WEIGHTS: readonly (readonly [number, string])[] = [
  [100, "Thin"],
  [200, "ExtraLight"],
  [300, "Light"],
  [400, "Regular"],
  [500, "Medium"],
  [600, "SemiBold"],
  [700, "Bold"],
  [800, "ExtraBold"],
  [900, "Black"],
];

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
      return STANDARD_WEIGHTS.find(([weight]) => weight === value)?.[1] ?? `Weight ${value}`;
    case "slnt":
    case "ital":
      return value === 0 ? null : "Italic";
    default:
      return value === axis.kind.default ? null : axis.name;
  }
}
