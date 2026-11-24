import { describe, expect, it } from "vitest";
import { Rect } from "@shift/geo";
import { nextRecentFileIndex } from "./recentFileFocus";

// The launcher grid: a wide first tile over two columns, then 100 px tiles,
// four columns, 20 px between rows.
const grid = [
  Rect.fromXYWH(0, 0, 216, 150),
  Rect.fromXYWH(232, 0, 100, 150),
  Rect.fromXYWH(348, 0, 100, 150),
  Rect.fromXYWH(0, 170, 100, 150),
  Rect.fromXYWH(116, 170, 100, 150),
  Rect.fromXYWH(232, 170, 100, 150),
];

const list = [0, 1, 2].map((row) => Rect.fromXYWH(0, row * 48, 800, 48));

describe("arrow keys over recent files", () => {
  it("steps through the files in order with Left and Right, stopping at the ends", () => {
    expect(nextRecentFileIndex(grid, 1, "ArrowRight")).toBe(2);
    expect(nextRecentFileIndex(grid, 2, "ArrowRight")).toBe(3);
    expect(nextRecentFileIndex(grid, 5, "ArrowRight")).toBe(5);
    expect(nextRecentFileIndex(grid, 0, "ArrowLeft")).toBe(0);
  });

  it("moves to the file straight below or above in the grid", () => {
    expect(nextRecentFileIndex(grid, 1, "ArrowDown")).toBe(5);
    expect(nextRecentFileIndex(grid, 5, "ArrowUp")).toBe(1);
    expect(nextRecentFileIndex(grid, 4, "ArrowUp")).toBe(0);
  });

  it("lands under the wide tile's centre when going down from it", () => {
    expect(nextRecentFileIndex(grid, 0, "ArrowDown")).toBe(3);
  });

  it("stays put at the top and bottom rows", () => {
    expect(nextRecentFileIndex(grid, 0, "ArrowUp")).toBe(0);
    expect(nextRecentFileIndex(grid, 3, "ArrowDown")).toBe(3);
  });

  it("walks a list one row at a time", () => {
    expect(nextRecentFileIndex(list, 0, "ArrowDown")).toBe(1);
    expect(nextRecentFileIndex(list, 2, "ArrowUp")).toBe(1);
  });

  it("jumps to the ends with Home and End, and ignores other keys", () => {
    expect(nextRecentFileIndex(grid, 3, "Home")).toBe(0);
    expect(nextRecentFileIndex(grid, 0, "End")).toBe(5);
    expect(nextRecentFileIndex(grid, 0, "Enter")).toBeNull();
    expect(nextRecentFileIndex([], 0, "ArrowDown")).toBeNull();
  });
});
