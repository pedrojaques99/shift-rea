import { beforeEach, describe, expect, it } from "vitest";
import { FONTS, useTestEditor } from "@/testing/fontFixture";

// T then A kerns -75 at LightCondensed, the master the open A is edited at.
const editor = useTestEditor({ file: FONTS.mutatorSans, glyph: "A" });

describe("kerning the open glyph with its neighbours, from the sidebar", () => {
  beforeEach(async () => {
    // The text is TA, with the open A edited in place.
    editor.selectTool("text");
    editor.moveCaret(-1, "character");
    editor.typeText("T");
    await editor.pressKey("Escape");
  });

  it("lists the pair the open glyph makes with its neighbour, with its kern", () => {
    expect(editor.neighbourKerning()).toEqual([{ pair: "TA", amount: -75, editable: true }]);
  });

  it("changes the kern from the field, as one undo step", async () => {
    editor.setNeighbourKerning(0, -90);
    await editor.settle();
    expect(editor.neighbourKerning()[0]).toMatchObject({ amount: -90 });
    expect(editor.kerningAt("LightCondensed", "T", "A").amount).toBe(-90);

    await editor.undo();
    expect(editor.neighbourKerning()[0]).toMatchObject({ amount: -75 });
  });

  it("shows the kern between masters but locks it, as only a master authors kerning", () => {
    editor.setLocation({ wght: 500, wdth: 0 });

    expect(editor.neighbourKerning()).toEqual([
      { pair: "TA", amount: expect.any(Number), editable: false },
    ]);
  });
});
