import type { Editor } from "@shift/editor";
import { track } from "@shift/editor/signals";
import type { GlyphId } from "@shift/types";
import { fillGlyph, previewGlyph, type PreviewGlyph } from "../kerning/groups/previewGlyphs";

/** The strip's largest type size, in CSS pixels per em; a long line shrinks to fit. */
export const TEST_STRIP_EM_PX = 72;
/** The smallest size a long line shrinks to before it clips. */
const MIN_EM_PX = 20;
/** Half a typical cap height, in ems: the baseline sits this far below the strip's middle. */
const CAP_HALF_EM = 0.35;
/** The strip's height, in ems. */
export const TEST_STRIP_HEIGHT_EM = 1.4;
const PADDING_PX = 16;

/** The glyph ids a line of text maps to through the font's cmap; `.notdef` where a character has none. */
export function testStripGlyphs(editor: Editor, text: string): GlyphId[] {
  const notdef = editor.font.entryForName(".notdef")?.id ?? null;
  const ids: GlyphId[] = [];
  for (const char of text) {
    const id = editor.font.entryForUnicode(char.codePointAt(0) ?? 0)?.id ?? notdef;
    if (id) ids.push(id);
  }
  return ids;
}

/**
 * Sets `glyphIds` in one line, kerned as the font kerns at the window's axis location,
 * shrinking from {@link TEST_STRIP_EM_PX} to fit the canvas. Reads its signals, so an effect
 * around it redraws on any outline, kerning or location change.
 */
export function drawTestStrip(
  canvas: HTMLCanvasElement,
  editor: Editor,
  glyphIds: readonly GlyphId[],
): void {
  track(editor.font.kerningCell);
  track(editor.externalLocationCell);
  track(editor.activeSourceIdCell);
  track(editor.font.metricsCell);

  const glyphs = glyphIds.map((id) => previewGlyph(editor, id));
  const loaded = glyphs.filter((glyph): glyph is PreviewGlyph => glyph !== null);
  const kerns = pairKerns(editor, glyphIds, glyphs);
  const units = loaded.reduce((sum, glyph) => sum + glyph.advance, 0) + sum(kerns);

  const unitsPerEm = editor.font.metricsCell.peek().unitsPerEm;
  const width = canvas.clientWidth;
  const room = Math.max(1, width - PADDING_PX * 2);
  const emPx = Math.max(
    MIN_EM_PX,
    Math.min(TEST_STRIP_EM_PX, (room / Math.max(units, 1)) * unitsPerEm),
  );
  const scale = emPx / unitsPerEm;
  const height = TEST_STRIP_HEIGHT_EM * TEST_STRIP_EM_PX;

  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = getComputedStyle(canvas).color;

  // Centre the cap-height band (about 0.7 em above the baseline) whatever size it shrank to.
  const baseline = height / 2 + emPx * CAP_HALF_EM;
  let x = PADDING_PX;
  for (const [index, glyph] of glyphs.entries()) {
    if (!glyph) continue;
    fillGlyph(ctx, glyph.path, x, baseline, scale, ratio, 1);
    x += (glyph.advance + (kerns[index] ?? 0)) * scale;
  }
}

/** The kern after each glyph, against the next one; 0 where either is not loaded yet. */
function pairKerns(
  editor: Editor,
  glyphIds: readonly GlyphId[],
  glyphs: readonly (PreviewGlyph | null)[],
): number[] {
  if (glyphIds.length < 2) return [];

  const pairs = glyphIds.slice(0, -1).flatMap((id, index) => [id, glyphIds[index + 1]!]);
  const kerns = editor.font.kerningRun(
    pairs,
    editor.externalLocationCell.peek(),
    editor.activeSourceIdCell.peek(),
  );
  return kerns.map((kern, index) => (glyphs[index] && glyphs[index + 1] ? kern : 0));
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
