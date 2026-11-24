import { useEffect, useMemo, useRef, useState } from "react";
import { effect } from "@shift/editor/signals";
import { Input } from "@shift/ui";
import { useEditor } from "@/workspace/WorkspaceContext";
import {
  TEST_STRIP_EM_PX,
  TEST_STRIP_HEIGHT_EM,
  drawTestStrip,
  testStripGlyphs,
} from "./drawTestStrip";

const STORAGE_KEY = "shift:test-strip";
const DEFAULT_TEXT = "Hamburgefonstiv 0123";

function readStoredText(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? DEFAULT_TEXT;
  } catch {
    return DEFAULT_TEXT;
  }
}

function storeText(text: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, text);
  } catch {
    // Storage is a convenience: the strip works without it.
  }
}

/**
 * A line to test the font while browsing its glyphs: type, and it draws in the font at the
 * window's style (the Style section's sliders), kerned, redrawing as outlines change.
 *
 * @remarks
 * It maps characters through the cmap without shaping; a text page shapes for real.
 */
export function TestStrip() {
  const editor = useEditor();
  const [text, setText] = useState(readStoredText);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const glyphIds = useMemo(() => testStripGlyphs(editor, text), [editor, text]);

  useEffect(() => {
    editor.font.loadGlyphs(glyphIds).catch((error: unknown) => {
      console.error("failed to load test strip glyphs", error);
    });
  }, [editor, glyphIds]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const observer = new ResizeObserver(() => setWidth(canvas.clientWidth));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0) return undefined;

    const subscription = effect(() => drawTestStrip(canvas, editor, glyphIds));
    return () => subscription.dispose();
  }, [editor, glyphIds, width]);

  return (
    <section aria-label="Test the font" className="border-b border-line-subtle px-4 pt-3">
      <Input
        aria-label="Text to test"
        placeholder="Type to test the font"
        value={text}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setText(next);
          storeText(next);
        }}
      />
      <canvas
        ref={canvasRef}
        aria-hidden
        className="block w-full text-primary"
        style={{ height: TEST_STRIP_HEIGHT_EM * TEST_STRIP_EM_PX }}
      />
    </section>
  );
}
