import { describe, expect, it } from "vitest";
import { dragValueText } from "./DragReadoutLabel";

describe("a drag's live value reads as a short label", () => {
  it.each([
    [{ kind: "move", delta: { x: 12, y: -40 } }, "Δx 12  Δy −40"],
    [{ kind: "move", delta: { x: 0.04, y: 2.25 } }, "Δx 0  Δy 2.3"],
    [{ kind: "handle", length: 100, angle: 53.1301 }, "100  53.1°"],
    [{ kind: "resize", width: 150, height: 125.5 }, "150 × 125.5"],
    [{ kind: "rotate", angle: -30 }, "−30°"],
  ] as const)("%o reads %s", (value, text) => {
    expect(dragValueText(value)).toBe(text);
  });
});
