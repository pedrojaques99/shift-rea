import { evaluateNumberExpression, formatScrubValue } from "@shift/ui";

/** An axis value as the sidebar shows it: up to two decimals, a point, no grouping. */
export const formatAxisValue = (value: number): string => formatScrubValue(value, 2);

/**
 * Reads what was typed into an axis slider, as the sidebar's number fields
 * do: a number or a sum such as `400+50`; `*2` acts on the current value.
 *
 * @returns NaN for text that is not a number, which the slider ignores.
 */
export const parseAxisText = (text: string, current: number): number =>
  evaluateNumberExpression(text.replace(",", "."), current) ?? Number.NaN;
