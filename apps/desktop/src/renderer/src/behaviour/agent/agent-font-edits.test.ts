import { describe, expect, it } from "vitest";
import { useTestEditor } from "@/testing/fontFixture";

// Agents edit the font through `shift.edits.apply`: the engine's own intents,
// one undo step per call, with `new:` placeholders for what they create.
describe("agents edit the font as the editor does, one undo step per call", () => {
  const editor = useTestEditor();

  function defaultSource() {
    const source = editor.source("default");
    if (!source) throw new Error("Expected a default source");
    return source;
  }

  it("creates a glyph with a drawn contour and an advance, and undo removes it", async () => {
    const source = defaultSource();
    const square = [
      [100, 0],
      [400, 0],
      [400, 500],
      [100, 500],
    ] as const;

    const { value: edit } = await editor.agentDocument("edits.apply", {
      label: "Draw square",
      intents: [
        {
          kind: "createGlyph",
          createGlyph: { glyphId: "new:glyph:sq", name: "square.agent", unicodes: [] },
        },
        {
          kind: "createGlyphLayer",
          createGlyphLayer: {
            layerId: "new:layer:sq",
            glyphId: "new:glyph:sq",
            sourceId: source.id,
          },
        },
        {
          kind: "addContour",
          addContour: { layerId: "new:layer:sq", contourId: "new:contour:sq/0", closed: true },
        },
        {
          kind: "addPoints",
          addPoints: {
            layerId: "new:layer:sq",
            contourId: "new:contour:sq/0",
            points: square.map(([x, y], index) => ({
              id: `new:point:sq/0/${index}`,
              x,
              y,
              pointType: "onCurve",
              smooth: false,
            })),
          },
        },
        { kind: "setXAdvance", setXAdvance: { layerId: "new:layer:sq", width: 500 } },
      ] as never,
    });

    const glyphId = edit.ids["new:glyph:sq"];
    expect(glyphId).toMatch(/^glyph_/);
    expect(edit.ids["new:layer:sq"]).toMatch(/^layer_/);
    expect(Object.keys(edit.ids)).toHaveLength(7);
    expect(edit.layerIds).toEqual([edit.ids["new:layer:sq"]]);
    expect(edit.fontChanged).toBe(true);
    expect(editor.glyphNamed("square.agent")).toMatchObject({ id: glyphId });

    await editor.openGlyph("square.agent");
    const layer = await editor.layerAt(source.name);
    expect(layer.advanceWidth).toBe(500);
    expect(layer.contours).toHaveLength(1);
    expect(layer.contours[0]!.points.map(({ x, y }) => [x, y])).toEqual(square);

    const { value: undone } = await editor.agentDocument("history.undo", {});
    expect(undone.undone).toBe(true);
    expect(editor.glyphNamed("square.agent")).toBeNull();
  });

  it("refuses an intent Rust rejects and keeps nothing", async () => {
    await expect(
      editor.agentDocument("edits.apply", {
        label: "Broken",
        intents: [
          {
            kind: "createGlyph",
            createGlyph: { glyphId: "new:glyph:x", name: "x.agent", unicodes: [] },
          },
          { kind: "setXAdvance", setXAdvance: { layerId: "layer_doesnotexist", width: 10 } },
        ] as never,
      }),
    ).rejects.toMatchObject({ name: "FontEditRefusedError" });
    expect(editor.glyphNamed("x.agent")).toBeNull();
  });

  it("rejects a placeholder prefix ids do not use", async () => {
    await expect(
      editor.agentDocument("edits.apply", {
        label: "Typo",
        intents: [
          {
            kind: "createGlyph",
            createGlyph: { glyphId: "new:glif:a", name: "a.agent", unicodes: [] },
          },
        ] as never,
      }),
    ).rejects.toMatchObject({ name: "FontEditPlaceholderError" });
    expect(editor.glyphNamed("a.agent")).toBeNull();
  });
});

describe("agents check the font before and after they edit it", () => {
  const editor = useTestEditor();

  it("finds a curve missing its extreme point and a point a unit off the baseline", async () => {
    const sourceId = editor.source("default")!.id;
    const layer = "new:layer:bump";
    await editor.agentDocument("edits.apply", {
      label: "Draw a flawed bump",
      intents: [
        {
          kind: "createGlyph",
          createGlyph: { glyphId: "new:glyph:bump", name: "bump.agent", unicodes: [0xe000] },
        },
        {
          kind: "createGlyphLayer",
          createGlyphLayer: { layerId: layer, glyphId: "new:glyph:bump", sourceId },
        },
        {
          kind: "addContour",
          addContour: { layerId: layer, contourId: "new:contour:b", closed: true },
        },
        {
          kind: "addPoints",
          addPoints: {
            layerId: layer,
            contourId: "new:contour:b",
            points: [
              { id: "new:point:b0", x: 0, y: 1, pointType: "onCurve", smooth: false },
              { id: "new:point:b1", x: 0, y: 300, pointType: "offCurve", smooth: false },
              { id: "new:point:b2", x: 400, y: 300, pointType: "offCurve", smooth: false },
              { id: "new:point:b3", x: 400, y: 1, pointType: "onCurve", smooth: false },
            ],
          },
        },
        { kind: "setXAdvance", setXAdvance: { layerId: layer, width: 400 } },
      ] as never,
    });

    const check = await editor.fontCheck(["bump.agent"]);

    expect(check.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "O008", glyph: "bump.agent", contour: 0 }),
        expect.objectContaining({ code: "O009", glyph: "bump.agent", severity: "warning" }),
      ]),
    );
    expect(check.warnings).toBeGreaterThanOrEqual(2);
  });
});
