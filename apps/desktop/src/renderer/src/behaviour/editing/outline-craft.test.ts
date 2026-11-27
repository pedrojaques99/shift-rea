import { describe, expect, it } from "vitest";
import { useTestEditor, WEIGHT } from "@/testing/fontFixture";

const editor = useTestEditor();

/** A box whose bottom edge runs 3 units up over 400: meant level, drawn a hair off. */
const TILTED_BOX = {
  contours: [
    {
      closed: true,
      points: [
        { name: "a", x: 0, y: 0, pointType: "onCurve" as const },
        { name: "b", x: 400, y: 3, pointType: "onCurve" as const },
        { name: "c", x: 400, y: 600, pointType: "onCurve" as const },
        { name: "d", x: 0, y: 600, pointType: "onCurve" as const },
      ],
    },
  ],
};

describe("the craft review", () => {
  it("finds a line a hair off level, and F levels it as one undo step", async () => {
    const names = await editor.draw(TILTED_BOX);

    expect(await editor.reviewOutline()).toContain("near-axis-line");
    expect(editor.markedOutlineIssues()).toContain("near-axis-line");

    editor.select([names.a]);
    expect(await editor.runCommand("glyph.fixOutlineIssue")).toBe(true);
    await editor.settle();

    const a = (await editor.point(names.a))!;
    const b = (await editor.point(names.b))!;
    expect(a.y).toBe(b.y);
    expect(await editor.reviewOutline()).toEqual([]);

    await editor.undo();
    await editor.settle();
    expect(await editor.point(names.a)).toMatchObject({ x: 0, y: 0 });
    expect(await editor.point(names.b)).toMatchObject({ x: 400, y: 3 });
  });

  it("does nothing when the focused point has no issue", async () => {
    const names = await editor.draw(TILTED_BOX);
    await editor.reviewOutline();

    editor.select([names.c]);
    expect(await editor.runCommand("glyph.fixOutlineIssue")).toBe(false);
  });

  it("fixes the same point in every master that has the issue", async () => {
    await editor.draw(TILTED_BOX);
    await editor.addAxis(WEIGHT);
    await editor.addSource("Bold", { wght: 700 });
    await editor.reviewOutline();

    expect(await editor.runCommand("glyph.fixAllOutlineIssues")).toBe(true);
    await editor.settle();

    for (const source of ["Regular", "Bold"]) {
      const [a, b] = (await editor.layerAt(source)).contours[0]!.points;
      expect(a!.y, source).toBe(b!.y);
    }
  });

  it("hides its markers when Show Outline Issues is off", async () => {
    await editor.draw(TILTED_BOX);
    await editor.reviewOutline();
    expect(editor.markedOutlineIssues().length).toBeGreaterThan(0);

    await editor.runCommand("view.toggleOutlineIssues");
    expect(editor.markedOutlineIssues()).toEqual([]);
  });
});
