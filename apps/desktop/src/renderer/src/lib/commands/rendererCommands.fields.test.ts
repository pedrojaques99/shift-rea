import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { useTestEditor } from "@/testing/fontFixture";
import type { EditorTestSurface } from "@/testing/surface";
import { runRendererCommand } from "./rendererCommands";

/** How many points, on- and off-curve, the open glyph has. */
async function pointCount(editor: EditorTestSurface): Promise<number> {
  const outline = await editor.outline();
  return outline.reduce((count, contour) => count + contour.points.length, 0);
}

const DOM_GLOBALS = ["document", "HTMLElement", "HTMLInputElement", "HTMLTextAreaElement"] as const;

// Edit › Undo with a text field focused: the agent's message field keeps focus
// after the agent edits, and Ctrl+Z there must still take the edits back.
describe("undo and redo with a text field focused", () => {
  const editor = useTestEditor();
  let field: HTMLTextAreaElement;

  beforeEach(() => {
    const { window } = new JSDOM("<!doctype html><body></body>");
    for (const name of DOM_GLOBALS) Reflect.set(globalThis, name, Reflect.get(window, name));
    field = window.document.createElement("textarea");
    window.document.body.append(field);
    field.focus();
  });

  afterEach(() => {
    for (const name of DOM_GLOBALS) Reflect.deleteProperty(globalThis, name);
  });

  it("undoes and redoes the font while the field is empty", async () => {
    editor.selectTool("pen");
    for (const point of [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]) {
      await editor.clickAt(point);
    }
    const drawn = await pointCount(editor);

    expect(await runRendererCommand(editor.asEditor(), "edit.undo")).toBe(true);
    expect(await pointCount(editor)).toBeLessThan(drawn);
    expect(await runRendererCommand(editor.asEditor(), "edit.redo")).toBe(true);
    expect(await pointCount(editor)).toBe(drawn);
  });

  it("leaves the font alone when the field has text of its own to undo", async () => {
    editor.selectTool("pen");
    await editor.clickAt({ x: 0, y: 0 });
    await editor.clickAt({ x: 100, y: 0 });
    const drawn = await pointCount(editor);
    Reflect.set(field, "value", "a message");

    await runRendererCommand(editor.asEditor(), "edit.undo");

    expect(await pointCount(editor)).toBe(drawn);
  });
});
