import { useMemo, useState, type FormEvent } from "react";
import { Button, Input } from "@shift/ui";
import { EmptyState } from "@/components/visant/ui/empty-state";
import { useGlyphCatalog } from "@/context/GlyphCatalogContext";
import { charactersToAdd, starterSets } from "@/lib/glyph-grid/startGlyphs";

export interface GlyphGridEmptyStateProps {
  /** Shows glyphs of every colour again: the colour filter lives on the grid, not the catalog. */
  readonly clearColorFilter: () => void;
  /** Opens the agent panel; absent while it is open. */
  readonly askAgent?: () => void;
}

/**
 * What the grid shows with no glyph to show: a new font is invited to get its
 * first glyphs, and a filter that hides everything offers its way back.
 */
export const GlyphGridEmptyState = ({ clearColorFilter, askAgent }: GlyphGridEmptyStateProps) => {
  const { availableGlyphs } = useGlyphCatalog();
  if (availableGlyphs.length === 0) return <NewFontState askAgent={askAgent} />;

  return <NothingMatchesState clearColorFilter={clearColorFilter} />;
};

/** The empty state sits in the grid's upper third, where the first row of tiles will land. */
const Placement = ({ children }: { children: React.ReactNode }) => (
  <div className="pointer-events-none absolute inset-0 z-4 flex justify-center overflow-y-auto px-4 pt-24 pb-8">
    <div className="pointer-events-auto flex h-max w-full max-w-sm flex-col items-center gap-4">
      {children}
    </div>
  </div>
);

const NewFontState = ({ askAgent }: { askAgent?: () => void }) => {
  const { canAuthor, languageScripts, languageGlyphs, generateGlyphs } = useGlyphCatalog();
  const starter = useMemo(() => starterSets(languageScripts).at(0) ?? null, [languageScripts]);

  const addStarterSet = () => {
    if (!starter) return;

    const missing = languageGlyphs(starter.id).filter(({ present }) => !present);
    generateGlyphs(missing.map(({ glyph }) => glyph));
  };

  return (
    <Placement>
      <div className="visant-kit w-full">
        <EmptyState framed={false} art={<FirstTiles />} title="Start with the first glyphs">
          {canAuthor
            ? "Each one lands here as an empty tile, ready to draw. Other scripts are under Languages in the sidebar."
            : "This font has no glyphs, and this window can't add any."}
        </EmptyState>
      </div>
      {canAuthor ? (
        <div className="flex w-full max-w-72 flex-col items-stretch gap-3">
          {starter ? (
            <Button
              variant="primary"
              size="action"
              className="justify-between"
              onClick={addStarterSet}
            >
              <span>{`Add ${starter.script} Basic`}</span>
              <span className="text-ui font-normal tabular-nums opacity-70">
                {`${starter.missingCount} glyphs`}
              </span>
            </Button>
          ) : null}
          <CharacterField />
          {askAgent ? (
            <Button
              variant="muted"
              size="prompt"
              className="self-center font-normal"
              onClick={askAgent}
            >
              Or ask the agent to set it up
            </Button>
          ) : null}
        </div>
      ) : null}
    </Placement>
  );
};

/** Type the characters to draw; Enter adds a glyph for each one the font lacks. */
const CharacterField = () => {
  const { availableGlyphs, createGlyphsForText } = useGlyphCatalog();
  const [text, setText] = useState("");
  const present = useMemo(
    () => new Set(availableGlyphs.flatMap(({ unicode }) => (unicode === null ? [] : [unicode]))),
    [availableGlyphs],
  );
  const count = charactersToAdd(text, present).length;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (count === 0) return;

    createGlyphsForText(text);
    setText("");
  };

  return (
    <form className="flex items-center gap-1.5" onSubmit={submit}>
      <Input
        size="md"
        aria-label="Characters to add"
        placeholder="Or type characters: Hamburgefonstiv"
        value={text}
        onChange={(event) => setText(event.currentTarget.value)}
      />
      <Button type="submit" variant="outline" size="prompt" disabled={count === 0}>
        {count > 1 ? `Add ${count}` : "Add"}
      </Button>
    </form>
  );
};

/**
 * Three tiles drawn as the grid draws an empty glyph: its character muted on
 * the tile, over the name band. H, o and n are where a type designer starts.
 */
const FirstTiles = () => (
  <div aria-hidden="true" className="mb-3 flex gap-1.5">
    {["H", "o", "n"].map((character) => (
      <div key={character} className="flex h-16 w-13 flex-col overflow-hidden rounded-md bg-tile">
        <span className="flex flex-1 items-center justify-center font-sans text-xl text-muted-foreground">
          {character}
        </span>
        <span className="h-3 bg-tile-band" />
      </div>
    ))}
  </div>
);

const NothingMatchesState = ({ clearColorFilter }: { clearColorFilter: () => void }) => {
  const { query, setQuery, selectAll, canAuthor, availableGlyphs, createGlyphsForText } =
    useGlyphCatalog();
  const searched = query.trim();
  const absentCharacter = useMemo(() => {
    const characters = Array.from(searched);
    if (!canAuthor || characters.length !== 1) return null;

    const present = new Set(availableGlyphs.flatMap(({ unicode }) => unicode ?? []));
    return charactersToAdd(searched, present).length === 1 ? searched : null;
  }, [availableGlyphs, canAuthor, searched]);
  const title = searched === "" ? "No glyphs in this filter" : `No glyph matches “${searched}”`;

  const showAll = () => {
    setQuery("");
    selectAll();
    clearColorFilter();
  };

  return (
    <Placement>
      <div className="visant-kit w-full">
        <EmptyState framed={false} title={title}>
          {nothingMatchesReason(searched, absentCharacter !== null)}
        </EmptyState>
      </div>
      <div className="flex items-center gap-2">
        {absentCharacter ? (
          <Button
            variant="primary"
            size="prompt"
            onClick={() => {
              clearColorFilter();
              createGlyphsForText(absentCharacter);
            }}
          >
            {`Add “${absentCharacter}”`}
          </Button>
        ) : null}
        <Button variant={absentCharacter ? "muted" : "outline"} size="prompt" onClick={showAll}>
          Show all glyphs
        </Button>
      </div>
    </Placement>
  );
};

/** Why nothing shows, so the way back is plain. */
function nothingMatchesReason(searched: string, absentCharacter: boolean): string {
  if (absentCharacter) return "The font has no glyph for this character yet.";
  if (searched !== "") return "No glyph has this in its name or character.";
  return "The filters hide every glyph in the font.";
}
