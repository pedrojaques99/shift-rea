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
