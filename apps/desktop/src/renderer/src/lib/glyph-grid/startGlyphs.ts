import type { LanguageScript } from "@shift/glyph-info";
import type { Unicode } from "@shift/types";
import type { StarterSet } from "@/types/glyphCatalog";

/** The script a new font most often starts with, offered first. */
const FIRST_SCRIPT = "Latin";

/**
 * The tracked scripts' Basic sets the font is still missing glyphs from,
 * Latin first, then in the sidebar's order.
 */
export function starterSets(scripts: readonly LanguageScript[]): StarterSet[] {
  const sets = scripts.flatMap(({ script, groups }) =>
    groups.flatMap(({ group, presentCount, requiredCount }) => {
      const missingCount = requiredCount - presentCount;
      const basic = group.id === `${script.toLowerCase()}/basic`;
      return basic && missingCount > 0 ? [{ id: group.id, script, missingCount }] : [];
    }),
  );
  const first = sets.filter(({ script }) => script === FIRST_SCRIPT);
  const rest = sets.filter(({ script }) => script !== FIRST_SCRIPT);
  return [...first, ...rest];
}

/** White space and control characters: typing them asks for no glyph. */
const NOT_A_GLYPH = /^[\p{White_Space}\p{Cc}]$/u;

/**
 * The code points typed in `text` that the font has no glyph for, once each,
 * in the order typed.
 *
 * @param present - code points the font already has a glyph for.
 */
export function charactersToAdd(text: string, present: ReadonlySet<number>): Unicode[] {
  const seen = new Set<number>();
  const added: Unicode[] = [];
  for (const character of text) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined || NOT_A_GLYPH.test(character)) continue;
    if (present.has(codePoint) || seen.has(codePoint)) continue;
    seen.add(codePoint);
    added.push(codePoint as Unicode);
  }
  return added;
}
