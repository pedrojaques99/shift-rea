# Editing fonts over MCP

`shift.edits.apply` changes the font the way the editor's own tools and menus do: it takes the engine's `FontIntent`s, applies them as **one undo step**, marks the document unsaved and moves `fontRevision`. `shift.describe` lists every intent and its payload (`type FontIntent`). Rust validates each one; if it refuses any, the call fails with `FontEditRefusedError` and nothing is kept.

A font file opened directly is a read-only preview (`FontEditUnavailableError`). Edit a document: one made with **New font**, or a file saved as a `.shift` document.

## Work like a type designer

1. **Read before you draw.** `shift.font.get` gives the sources (masters), their metric values (baseline, x-height, cap height, ascender, descender, with overshoots) and `unitsPerEm`. `shift.glyphs.list` and `read.layers.resolve` show what exists. Match new glyphs to the stems, proportions and spacing already in the font.
2. **One meaningful step per call.** Label it as Edit › Undo should show it ("Draw H and I", "Space lowercase"). The user undoes a whole step with Ctrl+Z, or you do with `shift.history.undo`.
3. **Guard with the revision.** Pass the `fontRevision` you read as `ifFontRevision`, so a call fails with `FontChangedError` instead of overwriting a change the user made meanwhile.
4. **Look at the result.** After an edit, `read.layers.render` returns an SVG with points and metrics, and `shift.capture` a PNG of the window. Check the shape, then fix or undo.
5. **Check like a reviewer.** `shift.font.check({ windowId, glyphs: [{ name: "O" }] })` runs the engine's checks (the whole font without `glyphs`): interpolation compatibility between masters, contour direction, open or degenerate contours, **curves missing a point at their extremes (`O008`)**, **points a unit or two off a metric line (`O009`)**, invalid advances, kerning and swaps. Each finding names the glyph, master and contour. Fix every error and the warnings that are real before you report the glyph done.

## New ids: placeholders

Write `"new:<prefix>:<key>"` wherever a new entity's id goes. Each distinct placeholder becomes one fresh id, the same everywhere it appears in the call, and the answer's `ids` maps it back. Prefixes: `glyph`, `layer`, `contour`, `point`, `anchor`, `component`, `source`, `axis`, `axisLabel`, `axisMapping`, `kerningGroup`, `namedInstance`, `metric`, `swap`.

## Recipes

**A new glyph with an outline.** Create the glyph, give it a layer in each master, add a contour, add its points, set its advance:

```js
async () => {
  const windowId = (await shift.sessions.list())[0].windowId;
  const font = await shift.font.get({ windowId });
  const sourceId = font.value.sources[0].id;
  const L = "new:layer:I";
  return shift.edits.apply({
    windowId,
    ifFontRevision: font.fontRevision,
    label: "Draw I",
    intents: [
      { kind: "createGlyph", createGlyph: { glyphId: "new:glyph:I", name: "I", unicodes: [0x49] } },
      { kind: "createGlyphLayer", createGlyphLayer: { layerId: L, glyphId: "new:glyph:I", sourceId } },
      { kind: "addContour", addContour: { layerId: L, contourId: "new:contour:I0", closed: true } },
      { kind: "addPoints", addPoints: { layerId: L, contourId: "new:contour:I0", points: [
        { id: "new:point:I0", x: 60, y: 0, pointType: "onCurve", smooth: false },
        { id: "new:point:I1", x: 150, y: 0, pointType: "onCurve", smooth: false },
        { id: "new:point:I2", x: 150, y: 700, pointType: "onCurve", smooth: false },
        { id: "new:point:I3", x: 60, y: 700, pointType: "onCurve", smooth: false },
      ] } },
      { kind: "setXAdvance", setXAdvance: { layerId: L, width: 210 } },
    ],
  });
}
```

**Curves.** Points are cubic: two `offCurve` handles between `onCurve` points. Mark on-curve points between curves `smooth: true` when the handles are collinear. Put on-curve points at the extremes (where the curve is horizontal or vertical); round shapes overshoot the baseline and the x-height or cap height by the source's overshoot value.

**Direction.** Outer contours run counter-clockwise and counters (holes) clockwise, y up. `reverseContour` fixes one; `applyBooleanOp` (`union`, `subtract`, `intersect`, `difference`) merges or cuts overlapping contours.

**Accents and composites.** Build `Aacute` from components, not copied outlines: `createGlyph`, `createGlyphLayer`, then `addComponent` with `baseGlyphId` for `A` and `acutecomb`. Anchors (`addAnchors`: `top` on the base, `_top` on the mark) let components align; `setComponentTransforms` places one by hand (`transforms` is the affine `[xx, xy, yx, yy, dx, dy]` per component).

**Spacing.** `setSidebearings` sets left and right sidebearings for several glyphs at once, in one master (`scope: { kind: "source", source }`) or all (`{ kind: "everyMaster" }`); each side is `{ kind: "keep" }` or `{ kind: "set", set: 60 }`. `setGlyphMetricsKey` links a side to another glyph (`"=H"`, `"=|n"`, `"=o+10"`), as metrics keys do in Glyphs.

**Kerning.** Group glyphs that kern alike (`createKerningGroup`, `setKerningGroupMember`, by `position` `first` or `second`), then set values per master with `setKerningValues`: `{ sourceId, pair: { first, second }, value }`, each side `{ kind: "glyph", glyph }` or `{ kind: "group", group }`. A `null` value removes the pair. Kern groups first, then exceptions.

**Masters and variation.** `createAxis`, `createSource` and `createGlyphLayer` per source add masters; every master's layer of a glyph needs the same contours and point structure to interpolate. See the `variable-fonts` topic.
