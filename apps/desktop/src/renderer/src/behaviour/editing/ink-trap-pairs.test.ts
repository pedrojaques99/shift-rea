import { describe, expect, it } from "vitest";
import { useTestEditor } from "@/testing/fontFixture";

const editor = useTestEditor();

const INK_TRAPS = { tag: "INKT", minimum: 0, default: 0, maximum: 100 } as const;

const SQUARE = {
  contours: [
    {
      closed: true,
      points: [
        [0, 0],
        [400, 0],
        [400, 400],
        [0, 400],
      ],
    },
  ],
} as const;

/** Where the first point of the first contour is at `source`. */
async function firstPoint(source: string) {
  return (await editor.layerAt(source)).contours[0]!.points[0];
}

/** A square at both ends of Ink Traps, drawn the same: a glyph without traps. */
async function drawTraplessGlyph() {
  await editor.draw(SQUARE);
  await editor.addAxis(INK_TRAPS);
  await editor.addSource("Traps", { INKT: 100 });
  await editor.editSources(["Traps"]);
  editor.selectTool("select");
}

describe("the two ends of Ink Traps, for a glyph drawn the same at both", () => {
  it("makes a point smooth at both ends when it is double-clicked at one", async () => {
    await drawTraplessGlyph();

    await editor.doubleClickAt({ x: 400, y: 0 });
    await editor.settle();

    for (const source of ["Traps", "Regular"]) {
      expect(await editor.layerAt(source), source).toMatchObject({
        contours: [{ points: [{}, { smooth: true }, {}, {}] }],
      });
    }
  });

  it("moves a component at both ends when it is nudged at one", async () => {
    await editor.addGlyph("base", null);
    await editor.openGlyph("base");
    await editor.draw(SQUARE);
    await editor.openGlyph("A");
    await editor.draw({ components: [{ glyph: "base" }] });
    await editor.addAxis(INK_TRAPS);
    await editor.addSource("Traps", { INKT: 100 });
    await editor.editSources(["Traps"]);
    editor.selectTool("select");
    await editor.clickAt({ x: 200, y: 200 });

    await editor.pressKey("ArrowRight");
    await editor.settle();

    for (const source of ["Traps", "Regular"]) {
      expect(await editor.layerAt(source), source).toMatchObject({
        components: [{ transformation: { dx: 1, dy: 0 } }],
      });
    }
  });

  it("moves a point at both ends when it is moved at one", async () => {
    await drawTraplessGlyph();

    await editor.dragFrom({ x: 0, y: 0 }, { x: 30, y: 20 });
    await editor.settle();

    expect(await firstPoint("Traps")).toMatchObject({ x: 30, y: 20 });
    expect(await firstPoint("Regular")).toMatchObject({ x: 30, y: 20 });
  });

  it("moves only the end being edited with the switch off", async () => {
    await drawTraplessGlyph();
    editor.setMirrorAxisPairs(false);

    await editor.dragFrom({ x: 0, y: 0 }, { x: 30, y: 20 });
    await editor.settle();

    expect(await firstPoint("Traps")).toMatchObject({ x: 30, y: 20 });
    expect(await firstPoint("Regular")).toMatchObject({ x: 0, y: 0 });
  });

  it("leaves the other end alone once the two are drawn differently, as a glyph with traps is", async () => {
    await drawTraplessGlyph();
    editor.setMirrorAxisPairs(false);
    await editor.dragFrom({ x: 0, y: 0 }, { x: 30, y: 20 });
    editor.setMirrorAxisPairs(true);

    await editor.dragFrom({ x: 400, y: 400 }, { x: 420, y: 420 });
    await editor.settle();

    expect(await editor.layerAt("Regular")).toMatchObject({
      contours: [{ points: [{}, {}, { x: 400, y: 400 }, {}] }],
    });
  });

  it("copies one end onto the other, so the two mirror again", async () => {
    await drawTraplessGlyph();
    editor.setMirrorAxisPairs(false);
    await editor.dragFrom({ x: 0, y: 0 }, { x: 30, y: 20 });
    await editor.settle();

    expect(editor.matchMirroredPairs()).toBe(1);
    await editor.settle();

    expect(await firstPoint("Regular")).toMatchObject({ x: 30, y: 20 });
  });
});
