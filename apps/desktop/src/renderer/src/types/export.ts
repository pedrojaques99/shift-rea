import type { WorkspaceBinaryEncoding, WorkspaceExportFormat } from "@shared/workspace/lanes";

/**
 * What an Export row makes: a variable font binary, one static binary per
 * named instance, or editable sources.
 */
export type ExportTarget = (typeof EXPORT_TARGETS)[number];

/** Every Export target, in the order the target menu lists them. */
export const EXPORT_TARGETS = ["variable", "static", "ufo"] as const;

/**
 * The file format an Export row writes its target as: TrueType, OpenType
 * CFF (CFF2 when variable, built by fontmake) or WOFF2 for binaries, a designspace with one UFO per master or a single UFO of the
 * default source for sources.
 */
export type ExportOutput = (typeof EXPORT_OUTPUTS)[number];

/** Every Export output, as the bridge and the format menu name them. */
export const EXPORT_OUTPUTS = ["ttf", "otf", "woff2", "designspace", "ufo"] as const;

/** The outputs each target can be written as, the default first. */
export const outputsFor = {
  variable: ["ttf", "otf", "woff2"],
  static: ["ttf", "otf", "woff2"],
  ufo: ["designspace", "ufo"],
} as const satisfies Record<ExportTarget, readonly ExportOutput[]>;

/** One line of the Export section: a target written in one output. */
export interface ExportRow {
  readonly id: string;
  readonly target: ExportTarget;
  readonly output: ExportOutput;
  /** Whether TrueType binaries get ttfautohint's instructions; off when absent. */
  readonly hint?: boolean;
}

/** What one row asks the workspace to export. */
export interface ExportRowRequest {
  readonly format: WorkspaceExportFormat;
  readonly encodings: readonly WorkspaceBinaryEncoding[];
  readonly autohint: boolean;
}

/** The workspace export format and encodings that `row` writes. */
export function exportRequestFor(
  row: Pick<ExportRow, "target" | "output" | "hint">,
): ExportRowRequest {
  const autohint = canHint(row) && row.hint === true;
  switch (row.target) {
    case "variable":
      if (row.output === "otf") return { format: "otf", encodings: ["ttf"], autohint: false };

      return { format: "ttf", encodings: [binaryEncoding(row.output)], autohint };
    case "static":
      if (row.output === "otf")
        return { format: "static-otf", encodings: ["ttf"], autohint: false };

      return { format: "static-ttf", encodings: [binaryEncoding(row.output)], autohint };
    case "ufo":
      return {
        format: row.output === "ufo" ? "ufo" : "designspace",
        encodings: ["ttf"],
        autohint: false,
      };
  }
}

/**
 * Whether `row` writes TrueType binaries, which ttfautohint can hint. A
 * variable font stays unhinted even when asked; its static instances do not.
 */
export function canHint(row: Pick<ExportRow, "target" | "output">): boolean {
  return row.target !== "ufo" && row.output !== "otf";
}

/** Whether `output` is one of the outputs `target` can be written as. */
export function isOutputOf(target: ExportTarget, output: ExportOutput): boolean {
  const outputs: readonly ExportOutput[] = outputsFor[target];
  return outputs.includes(output);
}

function binaryEncoding(output: ExportOutput): WorkspaceBinaryEncoding {
  return output === "woff2" ? "woff2" : "ttf";
}
