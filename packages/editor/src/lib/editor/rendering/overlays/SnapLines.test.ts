import { describe, expect, it } from "vitest";
import { snapFeedback } from "./SnapLines";
import type { PositionGuide } from "../../../../types/positionEdit";

const alignment = (target: { x: number; y: number }, point: { x: number; y: number }) =>
  ({ kind: "alignment", target, point }) as const satisfies PositionGuide;

describe("snap feedback crosses the positions its guide lines pass through", () => {
  it("crosses a crossing on a vertical alignment line's span, not one past its end or beside it", () => {
    const feedback = snapFeedback(
      [alignment({ x: 100, y: 0 }, { x: 100, y: 300 })],
      [
        { x: 100, y: 120 },
        { x: 100 + 1e-7, y: 200 },
        { x: 100 - 1e-7, y: 250 },
        { x: 100, y: 400 },
        { x: 101, y: 150 },
      ],
    );

    // Crosses draw in no particular order.
    expect(feedback.markers).toHaveLength(5);
    expect(feedback.markers).toEqual(
      expect.arrayContaining([
        { x: 100, y: 0 },
        { x: 100, y: 300 },
        { x: 100, y: 120 },
        { x: 100 + 1e-7, y: 200 },
        { x: 100 - 1e-7, y: 250 },
      ]),
    );
  });

  it("crosses a crossing on a metric span", () => {
    const feedback = snapFeedback(
      [
        { kind: "metric", metric: "baseline", x: 10, y: 0 },
        { kind: "metric", metric: "baseline", x: 90, y: 0 },
      ],
      [
        { x: 50, y: 0 },
        { x: 50, y: 1 },
      ],
    );

    expect(feedback.lines).toEqual([
      [
        { x: 10, y: 0 },
        { x: 90, y: 0 },
      ],
    ]);
    expect(feedback.markers).toEqual([
      { x: 10, y: 0 },
      { x: 90, y: 0 },
      { x: 50, y: 0 },
    ]);
  });

  it("draws a line repeated by several guides once", () => {
    const guide = alignment({ x: 0, y: 0 }, { x: 0, y: 50 });
    const feedback = snapFeedback([
      guide,
      { ...guide },
      alignment({ x: 0, y: 0 }, { x: 0, y: 80 }),
    ]);

    expect(feedback.lines).toEqual([
      [
        { x: 0, y: 0 },
        { x: 0, y: 50 },
      ],
      [
        { x: 0, y: 0 },
        { x: 0, y: 80 },
      ],
    ]);
  });
});

describe("snap feedback draws the letter-architecture guides", () => {
  it("measures a matched distance and every distance it equals", () => {
    const feedback = snapFeedback([
      {
        kind: "distance",
        axis: "x",
        from: { x: 400, y: 398 },
        to: { x: 480, y: 400 },
        distance: 80,
        reference: [
          { x: 100, y: 0 },
          { x: 180, y: 0 },
        ],
      },
    ]);

    // The stationary end is measured on the moving position's row.
    expect(feedback.measures).toEqual([
      { from: { x: 400, y: 400 }, to: { x: 480, y: 400 }, distance: 80 },
      { from: { x: 100, y: 0 }, to: { x: 180, y: 0 }, distance: 80 },
    ]);
  });

  it("draws an advance line across its span and crosses the snapped position", () => {
    const feedback = snapFeedback([
      { kind: "advance", edge: "centre", x: 300, y: 250, minY: -200, maxY: 800 },
    ]);

    expect(feedback).toMatchObject({
      lines: [
        [
          { x: 300, y: -200 },
          { x: 300, y: 800 },
        ],
      ],
      markers: [{ x: 300, y: 250 }],
    });
  });

  it("joins a mirrored pair and crosses it on the centre line", () => {
    const feedback = snapFeedback([
      { kind: "symmetry", mirror: { x: 150, y: 250 }, point: { x: 450, y: 250 }, centre: 300 },
    ]);

    expect(feedback.markers).toEqual([
      { x: 150, y: 250 },
      { x: 450, y: 250 },
      { x: 300, y: 250 },
    ]);
  });
});
