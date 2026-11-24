import { describe, expect, it } from "vitest";
import type { Axis, AxisId, AxisLabel, AxisLabelId } from "@shift/types";
import { sourceLabel } from "./sourceLabel";

const label = (value: number, name: string, elidable = false): AxisLabel => ({
  id: name as AxisLabelId,
  name,
  value,
  elidable,
});

const axis = (tag: string, name: string, def: number, labels: AxisLabel[] = []): Axis => ({
  id: tag as AxisId,
  tag,
  name,
  role: "external",
  kind: { kind: "continuous", minimum: -100, default: def, maximum: 1000 },
  labels,
  hidden: false,
});

const at = (wght: number, slnt: number, inkt: number) =>
  new Map([
    ["wght", wght],
    ["slnt", slnt],
    ["INKT", inkt],
  ]);

describe("sourceLabel", () => {
  it("names unlabeled axes by weight class, italic and axis name", () => {
    const axes = [
      axis("wght", "Weight", 200),
      axis("slnt", "Slant", 0),
      axis("INKT", "Ink Traps", 0),
    ];

    expect(sourceLabel("raw", at(400, 0, 0), axes)).toBe("Regular");
    expect(sourceLabel("raw", at(800, -10, 0), axes)).toBe("ExtraBold Italic");
    expect(sourceLabel("raw", at(200, -10, 100), axes)).toBe("ExtraLight Italic · Ink Traps");
  });

  it("reads Visant Sans' STAT labels, keeps the weight and never collapses two sources", () => {
    // As authored in VisantSans.shift: both Ink Traps labels are elidable.
    const axes = [
      axis("wght", "Weight", 400, [label(400, "Regular", true), label(800, "ExtraBold")]),
      axis("slnt", "Slant", 0, [label(0, "Upright", true), label(-10, "Oblique")]),
      axis("INKT", "Ink Traps", 0, [label(0, "No Ink Traps", true), label(100, "Ink Traps", true)]),
    ];

    expect(sourceLabel("master.Regular", at(400, 0, 0), axes)).toBe("Regular");
    expect(sourceLabel("master.Regular.italic", at(400, -10, 0), axes)).toBe("Regular Oblique");
    expect(sourceLabel("master.ExtraBold.italic.inkt", at(800, -10, 100), axes)).toBe(
      "ExtraBold Oblique · Ink Traps",
    );
  });

  it("falls back to the authored name when the font has no axes", () => {
    expect(sourceLabel("master.raw", at(400, 0, 0), [])).toBe("master.raw");
  });
});
