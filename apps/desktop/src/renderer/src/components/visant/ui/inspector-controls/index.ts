// Copied from jaques-os (components/ui/inspector-controls); not yet in the @visant registry. Fix it there first.
// Colhido para o registry: `@visant/inspector-controls` (branch `inspector-controls` do Vintageuiuxlibrary,
// ainda não publicado). Lá o CSS vai pelo campo `css` do item; aqui, por este import.
// Correção que valha para outros projetos deve ir no registry primeiro.
import "./inspector-controls.css";

export {
  formatNumber,
  parseNumber,
  InspectorColor,
  InspectorHint,
  InspectorRow,
  InspectorSection,
  InspectorSegments,
  InspectorSlider,
  InspectorSwatches,
  InspectorThumb,
  InspectorThumbs,
  InspectorToggle,
  InspectorVector,
  type InspectorSectionProps,
  type InspectorSliderProps,
  type SegmentOption,
  type SwatchOption,
  type VectorPart,
} from "./inspector-controls";
