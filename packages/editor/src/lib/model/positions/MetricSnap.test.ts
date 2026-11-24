import { describe, expect, it } from "vitest";
import { asMetricId, type MetricDefinition, type SourceMetrics } from "@shift/types";
import { MetricSnap, overshootMetricLines } from "./MetricSnap";

const metrics: SourceMetrics = {
  unitsPerEm: 1000,
  metricValues: {},
  ascender: 800,
  descender: -200,
  baseline: 10,
  xHeight: 500,
  capHeight: 700,
};

describe("metric snapping follows authored horizontal metrics", () => {
  it("returns the nearest metric inside the radius", () => {
    const snap = MetricSnap.standard(metrics, 8).snap({ x: 40, y: 496 });

    expect(snap).toEqual({
      x: null,
      y: { offset: 4, guides: [{ kind: "metric", metric: "xHeight", x: 40, y: 500 }] },
    });
  });

  it("uses a non-zero authored baseline", () => {
    const snap = MetricSnap.standard(metrics, 8).snap({ x: 40, y: 4 });

    expect(snap?.y).toEqual({
      offset: 6,
      guides: [{ kind: "metric", metric: "baseline", x: 40, y: 10 }],
    });
  });

  it("does not fabricate absent optional metrics at zero", () => {
    const sparse = { ...metrics, xHeight: undefined, capHeight: undefined };
    const snap = MetricSnap.standard(sparse, 2).snap({ x: 40, y: 0 });

    expect(snap).toBeNull();
  });

  it("honors its per-frame activation condition", () => {
    let enabled = false;
    const snapping = MetricSnap.standard(metrics, 8, { when: () => enabled });

    expect(snapping.snap({ x: 40, y: 496 })).toBeNull();
    enabled = true;
    expect(snapping.snap({ x: 40, y: 496 })?.y?.offset).toBe(4);
  });

  it("only snaps over the lines' horizontal extent", () => {
    const snapping = MetricSnap.standard(metrics, 8).across({ minX: 0, maxX: 600 });

    expect(snapping.snap({ x: 300, y: 496 })?.y?.offset).toBe(4);
    expect(snapping.snap({ x: 700, y: 496 })).toBeNull();
    expect(snapping.snap({ x: -20, y: 496 })).toBeNull();
  });
});

describe("metric snapping reaches the overshoot zones a source authors", () => {
  const xHeightId = asMetricId("x-height");
  const baselineId = asMetricId("baseline");
  const definitions: MetricDefinition[] = [
    { id: baselineId, kind: "baseline", name: "Baseline" },
    { id: xHeightId, kind: "xHeight", name: "x-Height" },
  ];
  const zoned: SourceMetrics = {
    ...metrics,
    baseline: 0,
    metricValues: {
      [baselineId]: { position: 0, overshoot: -12 },
      [xHeightId]: { position: 500, overshoot: 0 },
    },
  };

  it("snaps to a metric's overshoot edge, marked as an overshoot", () => {
    const snap = MetricSnap.standard(zoned, 4)
      .including(overshootMetricLines(zoned, definitions))
      .snap({ x: 40, y: -10 });

    expect(snap?.y).toEqual({
      offset: -2,
      guides: [{ kind: "metric", metric: "baseline", x: 40, y: -12, overshoot: true }],
    });
  });

  it("adds no line for a metric without overshoot", () => {
    expect(overshootMetricLines(zoned, definitions)).toEqual([
      { kind: "metric", metric: "baseline", y: -12, overshoot: true },
    ]);
  });
});
