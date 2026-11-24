import type { Point2D } from "@shift/geo";
import type { ScreenCanvas } from "../Canvas";

/** Colours and font of a value pill. */
export interface ValuePillStyle {
  readonly fill: string;
  readonly text: string;
  readonly font: string;
}

const HEIGHT_PX = 16;
const PADDING_PX = 5;

/**
 * Draws `text` in a small rounded pill in screen pixels.
 *
 * @param at - Screen position of the pill's centre, or of its top-left corner when `anchor` is "corner".
 */
export function drawValuePill(
  screen: ScreenCanvas,
  at: Point2D,
  text: string,
  style: ValuePillStyle,
  anchor: "centre" | "corner" = "centre",
): void {
  const ctx = screen.ctx;
  ctx.save();
  ctx.font = style.font;
  const width = Math.ceil(ctx.measureText(text).width) + PADDING_PX * 2;
  const left = Math.round(anchor === "centre" ? at.x - width / 2 : at.x);
  const top = Math.round(anchor === "centre" ? at.y - HEIGHT_PX / 2 : at.y);

  ctx.beginPath();
  ctx.roundRect(left, top, width, HEIGHT_PX, HEIGHT_PX / 2);
  ctx.fillStyle = style.fill;
  ctx.fill();
  ctx.fillStyle = style.text;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, left + width / 2, top + HEIGHT_PX / 2);
  ctx.restore();
}

/**
 * A font-unit value as the editor shows it: at most one decimal, a true minus
 * sign, and no negative zero.
 */
export function formatUnits(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return "0";

  const digits = Number.isInteger(rounded)
    ? String(Math.abs(rounded))
    : Math.abs(rounded).toFixed(1);
  return rounded < 0 ? `−${digits}` : digits;
}
