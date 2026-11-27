import { useCallback, useMemo, useState } from "react";
import {
  Autocomplete,
  AutocompleteEmpty,
  AutocompleteInput,
  AutocompleteItem,
  AutocompleteList,
  Dialog,
  DialogBackdrop,
  DialogPopup,
  DialogPortal,
  DialogTitle,
  Search,
} from "@shift/ui";
import { useGlyphCatalog } from "@/context/GlyphCatalogContext";
import type { GlyphCatalogItem } from "@/types/glyphCatalog";

interface GlyphSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Results shown at once; typing narrows the rest. */
const MAX_RESULTS = 80;

/** `U+0061`, `u+61` or `0x61`: a code point typed as hex. */
const CODE_POINT = /^(?:u\+|0x)([0-9a-f]{1,6})$/i;

/**
 * Go to Glyph (Ctrl+K): finds a glyph by name, by its character, or by its
 * code point, and opens it.
 *
 * @remarks
 * Matching is the glyph grid's own search (`filterGlyphs`), so a query finds
 * here what it finds there. A typed `U+0061` jumps to that code point. Mounts
 * only while open, like Add Component, so it costs nothing while closed.
 */
export function GlyphSearchDialog({ open, onOpenChange }: GlyphSearchDialogProps) {
  if (!open) return null;
  return <OpenGlyphSearchDialog onOpenChange={onOpenChange} />;
}

function OpenGlyphSearchDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const catalog = useGlyphCatalog();
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const trimmed = query.trim();
    const hex = CODE_POINT.exec(trimmed);
    if (hex) {
      const unicode = Number.parseInt(hex[1]!, 16);
      return catalog.availableGlyphs.filter((glyph) => glyph.unicode === unicode);
    }
    if (trimmed === "") return catalog.availableGlyphs.slice(0, MAX_RESULTS);
    const found = catalog.filterGlyphs({ query: trimmed, categoryFilters: [], languageId: null });
    // An exact name or character match leads, so `a` opens a, not aacute.
    const exact = found.filter(
      (glyph) =>
        glyph.name === trimmed ||
        (glyph.unicode !== null && String.fromCodePoint(glyph.unicode) === trimmed),
    );
    const rest = found.filter((glyph) => !exact.includes(glyph));
    return [...exact, ...rest].slice(0, MAX_RESULTS);
  }, [catalog, query]);

  const open = useCallback(
    async (glyph: GlyphCatalogItem) => {
      onOpenChange(false);
      await catalog.openGlyph(glyph);
    },
    [catalog, onOpenChange],
  );

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="fixed left-1/2 top-24 flex h-100 w-105 -translate-x-1/2 flex-col overflow-hidden border border-line-subtle">
          <DialogTitle className="sr-only">Go to Glyph</DialogTitle>
          <Autocomplete
            inline
            open
            items={results}
            filter={null}
            autoHighlight="always"
            itemToStringValue={(glyph) => glyph.name}
            value={query}
            onValueChange={setQuery}
          >
            <div className="shrink-0 border-b border-line-subtle p-2">
              <AutocompleteInput
                autoFocus
                aria-label="Search glyphs"
                icon={<Search className="h-3 w-3 text-muted" />}
                iconPosition="left"
                placeholder="Glyph name, character or U+0061"
                size="md"
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || results.length === 0) return;
                  // Enter opens the highlighted result; with none highlighted, the first.
                  const highlighted = document.querySelector<HTMLElement>(
                    "[data-glyph-search-item][data-highlighted]",
                  );
                  const name = highlighted?.dataset.glyphSearchItem;
                  const glyph = results.find((item) => item.name === name) ?? results[0]!;
                  event.preventDefault();
                  void open(glyph);
                }}
              />
            </div>
            <AutocompleteEmpty className="flex min-h-16 items-center justify-center">
              No glyph matches
            </AutocompleteEmpty>
            <AutocompleteList className="min-h-0 flex-1 overflow-y-auto">
              {(glyph: GlyphCatalogItem) => (
                <AutocompleteItem
                  key={glyph.id}
                  value={glyph}
                  data-glyph-search-item={glyph.name}
                  aria-label={`Open ${glyph.displayName}`}
                  className="h-11"
                  onClick={() => void open(glyph)}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-8 w-8 shrink-0 items-center justify-center font-display text-2xl leading-none text-primary"
                  >
                    {glyph.unicode === null ? "—" : String.fromCodePoint(glyph.unicode)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-primary">
                    {glyph.displayName}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted">
                    {glyph.unicode === null
                      ? ""
                      : `U+${glyph.unicode.toString(16).toUpperCase().padStart(4, "0")}`}
                  </span>
                </AutocompleteItem>
              )}
            </AutocompleteList>
          </Autocomplete>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
