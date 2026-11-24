import type { Editor } from "../lib/editor/Editor";
import type { Glyph } from "../lib/model/Glyph";
import { useSignalState } from "../lib/signals";

/** How far above the baseline the preview reaches, in ems: room for accents. */
const TOP_EM = 1.05;
/** How far below the baseline it reaches, in ems. */
const BOTTOM_EM = 0.3;

interface GlyphSpacingPreviewProps {
  readonly editor: Editor;
  readonly glyph: Glyph;
}

/**
 * The glyph as the canvas draws it, between two dashed lines at its advance's edges, so the
 * space on each side reads at a glance: the gap to the left line is the Left field's value,
 * the gap to the right line the Right field's.
 */
export function GlyphSpacingPreview({ editor, glyph }: GlyphSpacingPreviewProps) {
  const model = glyph.renderModelAt(editor.externalLocationCell, editor.activeSourceIdCell);
  const path = useSignalState(model.svgPathCell);
  const advance = Math.max(1, useSignalState(model.xAdvanceCell));
  const unitsPerEm = useSignalState(editor.font.metricsCell).unitsPerEm;

  const top = TOP_EM * unitsPerEm;
  const height = (TOP_EM + BOTTOM_EM) * unitsPerEm;
  const pad = 0.08 * unitsPerEm;

  return (
    <svg
      aria-hidden
      viewBox={`${-pad} ${-top} ${advance + pad * 2} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-16 w-16 text-primary"
    >
      <g transform="scale(1, -1)">
        <path d={path} fill="currentColor" fillRule="nonzero" />
      </g>
      {[0, advance].map((x) => (
        <line
          key={x}
          x1={x}
          x2={x}
          y1={-top}
          y2={height - top}
          stroke="currentColor"
          strokeOpacity={0.45}
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
