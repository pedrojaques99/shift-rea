import { describe, expect, it } from "vitest";
import type { LanguageScript } from "@shift/glyph-info";
import { charactersToAdd, starterSets } from "./startGlyphs";

/** A tracked script with the groups the sidebar lists, as `[slug, present, required]`. */
function script(name: string, ...groups: [string, number, number][]): LanguageScript {
  return {
    script: name,
    languages: [],
    groups: groups.map(([slug, presentCount, requiredCount]) => ({
      group: { id: `${name.toLowerCase()}/${slug}`, name: slug, script: name },
      presentCount,
      requiredCount,
    })),
  };
}

describe("starter sets for a font", () => {
  it("offers each script's Basic set with what is missing, Latin first", () => {
    const sets = starterSets([
      script("Cyrillic", ["basic", 0, 66], ["punctuation", 0, 4]),
      script("Latin", ["basic", 10, 52]),
    ]);

    expect(sets).toEqual([
      { id: "latin/basic", script: "Latin", missingCount: 42 },
      { id: "cyrillic/basic", script: "Cyrillic", missingCount: 66 },
    ]);
  });

  it("leaves out a Basic set the font already has", () => {
    expect(starterSets([script("Latin", ["basic", 52, 52])])).toEqual([]);
  });
});

describe("characters typed to add", () => {
  it("adds each new character once, in the order typed, skipping spaces", () => {
    expect(charactersToAdd("Hon oH\n", new Set())).toEqual([0x48, 0x6f, 0x6e]);
  });

  it("skips characters the font already has", () => {
    expect(charactersToAdd("Hon", new Set([0x6f]))).toEqual([0x48, 0x6e]);
  });

  it("reads characters outside the Basic Multilingual Plane as one", () => {
    expect(charactersToAdd("𝔸", new Set())).toEqual([0x1d538]);
  });
});
