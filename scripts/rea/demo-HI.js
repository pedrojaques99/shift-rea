async () => {
  const windowId = 2;
  const font = await shift.font.get({ windowId });
  const sourceId = font.value.sources[0].id;
  const cap = 700, stem = 90, sb = 60;

  const glyph = (key, name, unicode, outline, width) => {
    const layer = `new:layer:${key}`;
    return [
      { kind: "createGlyph", createGlyph: { glyphId: `new:glyph:${key}`, name, unicodes: [unicode] } },
      { kind: "createGlyphLayer", createGlyphLayer: { layerId: layer, glyphId: `new:glyph:${key}`, sourceId } },
      { kind: "addContour", addContour: { layerId: layer, contourId: `new:contour:${key}/0`, closed: true } },
      {
        kind: "addPoints",
        addPoints: {
          layerId: layer,
          contourId: `new:contour:${key}/0`,
          points: outline.map(([x, y], i) => ({ id: `new:point:${key}/0/${i}`, x, y, pointType: "onCurve", smooth: false })),
        },
      },
      { kind: "setXAdvance", setXAdvance: { layerId: layer, width } },
    ];
  };

  // H: dois fustes e a barra, um só contorno (sentido anti-horário).
  const w = 520, l = sb, r = sb + w, bar = 330, barH = 70;
  const H = [
    [l, 0], [l + stem, 0], [l + stem, bar], [r - stem, bar], [r - stem, 0], [r, 0],
    [r, cap], [r - stem, cap], [r - stem, bar + barH], [l + stem, bar + barH], [l + stem, cap], [l, cap],
  ];
  const I = [[sb, 0], [sb + stem, 0], [sb + stem, cap], [sb, cap]];

  const edit = await shift.edits.apply({
    windowId,
    ifFontRevision: font.fontRevision,
    label: "Agent: draw H and I",
    intents: [...glyph("H", "H", 0x48, H, w + 2 * sb), ...glyph("I", "I", 0x49, I, stem + 2 * sb)],
  });

  const after = await shift.glyphs.list({ windowId });
  return { edit: edit.value, revision: edit.fontRevision, glyphs: after.value.items.map((g) => g.name) };
}
