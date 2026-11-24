import * as React from "react";
import { MoveHorizontal } from "lucide-react";
import { cn } from "../../lib/utils";
import {
  NumberField,
  NumberFieldGroup,
  NumberFieldInput,
  NumberFieldScrubArea,
  NumberFieldScrubAreaCursor,
} from "../number-field";
import { Tooltip } from "../tooltip";
import { evaluateNumberExpression } from "./numberExpression";
import { formatScrubValue, settle } from "./scrubValue";
import type { ScrubSession } from "./scrubSession";
import { useScrubGesture } from "./useScrubGesture";

export interface ScrubInputProps {
  /** Names the field for assistive technology and its tooltip. */
  "aria-label": string;
  /** The value shown while the field is not being typed in; `null` shows `placeholder`. */
  value: number | null;
  /** Called with each committed value: typed, stepped with an arrow key, or scrubbed without a session. */
  onValueCommit?: (value: number) => void;
  /**
   * Opens a live preview when a scrub moves for the first time. Without it,
   * or when it returns null, the field previews only its own number and
   * commits once, on release, through `onValueCommit`.
   */
  onScrubStart?: () => ScrubSession | null;
  /** Text to edit instead of the value, such as a metrics key the value follows. */
  editText?: string | null;
  /**
   * Takes text starting `=`, or blank text in place of `editText`, as a key
   * rather than a number.
   *
   * @returns Why the text was refused, which the field then shows; null when it was taken.
   */
  onTextCommit?: (text: string) => string | null;
  /** Called when the field is emptied; without it, emptying keeps the value. */
  onClear?: () => void;
  /** Called as typing starts and ends, so a host can hold keyboard shortcuts meanwhile. */
  onEditingChange?: (editing: boolean) => void;
  /** A short label such as "W", or an icon; the field scrubs when dragged anywhere outside typing. */
  label?: React.ReactNode;
  labelPosition?: "start" | "end";
  /** Shown over the field while it is not being typed in, such as a linked key's chip. */
  adornment?: React.ReactNode;
  adornmentPosition?: "start" | "end" | "center";
  /** Text after the number, such as "x" for a factor or "°" for an angle. */
  suffix?: string;
  /** Shown greyed while `value` is null. */
  placeholder?: string;
  /** The step of a scrub pixel pair and an arrow key. */
  step?: number;
  /** The step while Alt is held. */
  smallStep?: number;
  /** The step while Shift is held. */
  largeStep?: number;
  /** The arrow-key step while Cmd or Ctrl is held. */
  accelStep?: number;
  min?: number;
  max?: number;
  /** Decimal places kept; 2 by default. */
  maximumFractionDigits?: number;
  /** What the tooltip says; the field's accessible name when omitted, none when false. */
  tooltip?: React.ReactNode | false;
  disabled?: boolean;
  className?: string;
  /** Classes for the input, such as `text-right` for a column of numbers. */
  inputClassName?: string;
  size?: "compact" | "md";
}

const INVALID_TEXT = "Type a number or a sum such as 600+20";

interface StepKeys {
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
}

/**
 * A numeric field you can type into or scrub: drag it sideways to change
 * the value, Shift for ten times the step, Alt for a tenth.
 *
 * @remarks
 * It wears the Visant registry's `@visant/scrub-input` design: a bordered
 * card, a mono uppercase label, a mono value, the border lit while
 * scrubbing, and, when `min` and `max` are both set, a hairline ruler at
 * the foot showing where the value sits in the range (on hover, focus and
 * scrub). The registry component itself cannot host this field's
 * behaviour (no mixed value, no unbounded range, one change per pixel
 * instead of a preview and one commit, no sums or `=H` keys), so only its
 * look is taken.
 *
 * Scrubbing uses Base UI's `NumberField.ScrubArea` (pointer lock with a
 * virtual cursor that wraps at the window's edge). Escape during a scrub
 * cancels it and restores the value. A click without a drag focuses the
 * field with its text selected.
 *
 * Typing accepts numbers and simple sums (`600+20`; `*2` or `/2` act on the
 * current value). Enter and blur commit, Escape reverts, arrow keys step by
 * `step`, Shift by `largeStep`, Alt by `smallStep`, Cmd or Ctrl by
 * `accelStep`. While the field is focused, key presses do not reach the
 * window, so editor shortcuts do not fire.
 */
export function ScrubInput({
  "aria-label": ariaLabel,
  value,
  onValueCommit,
  onScrubStart,
  editText = null,
  onTextCommit,
  onClear,
  onEditingChange,
  label,
  labelPosition = "start",
  adornment,
  adornmentPosition = "end",
  suffix,
  placeholder,
  step = 1,
  smallStep = 0.1,
  largeStep = 10,
  accelStep = 100,
  min,
  max,
  maximumFractionDigits = 2,
  tooltip,
  disabled = false,
  className,
  inputClassName,
  size = "compact",
}: ScrubInputProps) {
  const [editing, setEditing] = React.useState(false);
  const [text, setText] = React.useState("");
  const [refusal, setRefusal] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  // The text typing started from; committing it unchanged changes nothing.
  const baselineRef = React.useRef("");
  const revertRef = React.useRef(false);

  const format = (next: number) => formatScrubValue(next, maximumFractionDigits);

  React.useLayoutEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commitValue = (next: number) => {
    if (onValueCommit) onValueCommit(settle(next, maximumFractionDigits, min, max));
  };

  const beginEditing = () => {
    if (disabled) return;
    const initial = editText ?? (value === null ? "" : format(value));
    baselineRef.current = initial;
    revertRef.current = false;
    setText(initial);
    setRefusal(null);
    setEditing(true);
    if (onEditingChange) onEditingChange(true);
  };

  const commitText = (typed: string) => {
    const trimmed = typed.trim();
    if (trimmed === baselineRef.current.trim()) return;

    if (trimmed === "") {
      if (editText !== null && onTextCommit) {
        setRefusal(onTextCommit(""));
        return;
      }
      if (onClear) onClear();
      return;
    }

    if (trimmed.startsWith("=") && onTextCommit) {
      setRefusal(onTextCommit(trimmed));
      return;
    }

    const next = evaluateNumberExpression(trimmed, value);
    if (next === null) {
      setRefusal(INVALID_TEXT);
      return;
    }
    setRefusal(null);
    commitValue(next);
  };

  const endEditing = () => {
    if (!editing) return;
    if (!revertRef.current) commitText(text);
    setEditing(false);
    if (onEditingChange) onEditingChange(false);
  };

  const stepFor = (keys: StepKeys): number => {
    if (keys.altKey) return smallStep;
    if (keys.shiftKey) return largeStep;
    if (keys.metaKey || keys.ctrlKey) return accelStep;
    return step;
  };

  const stepBy = (direction: 1 | -1, keys: StepKeys) => {
    const base = editing ? evaluateNumberExpression(text, value) : value;
    if (base === null) return;

    const next = settle(base + direction * stepFor(keys), maximumFractionDigits, min, max);
    commitValue(next);
    if (!editing) return;

    const shown = format(next);
    baselineRef.current = shown;
    setText(shown);
  };

  const scrub = useScrubGesture({
    inputRef,
    onScrubStart,
    settle: (next) => settle(next, maximumFractionDigits, min, max),
    onCommit: commitValue,
    onClick: beginEditing,
  });

  const shownValue = scrub.value ?? value;
  const scrubbing = scrub.value !== null;
  const ruler = rangeRatio(shownValue, min, max);
  const linkedAtRest = editText !== null && !editing;
  let shownText = "";
  if (editing) shownText = text;
  else if (!linkedAtRest && shownValue !== null) shownText = `${format(shownValue)}${suffix ?? ""}`;

  const labelNode = label ? (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center font-mono text-xs uppercase leading-none tracking-widest text-secondary transition-colors",
        "group-hover/scrub:text-primary group-data-[scrubbing]/scrub:text-primary",
        labelPosition === "start" ? "pl-2" : "pr-2",
      )}
    >
      {label}
    </span>
  ) : null;
  const adornmentNode =
    adornment && !editing ? (
      <span
        className={cn(
          "pointer-events-none absolute inset-y-0 flex items-center",
          adornmentPosition === "start" && "left-1",
          adornmentPosition === "end" && "right-1",
          adornmentPosition === "center" && "left-1/2 -translate-x-1/2",
        )}
      >
        {adornment}
      </span>
    ) : null;

  const tooltipContent = refusal ?? (tooltip === undefined ? ariaLabel : tooltip);
  const showTooltip = tooltipContent !== false && !scrubbing;

  return (
    <Tooltip content={tooltipContent || ariaLabel} disabled={!showTooltip}>
      <NumberField
        className={cn("w-full", className)}
        value={shownValue}
        step={step}
        smallStep={smallStep}
        largeStep={largeStep}
        min={min}
        max={max}
        format={{ maximumFractionDigits, useGrouping: false }}
        disabled={disabled}
        onValueChange={(next, details) => {
          if (details.reason !== "scrub" || next === null) return;
          scrub.preview(next);
        }}
        onValueCommitted={(next, details) => {
          if (details.reason !== "scrub") return;
          scrub.end(next);
        }}
      >
        <NumberFieldGroup
          variant="scrub"
          data-scrubbing={scrubbing || undefined}
          className={cn(
            "group/field relative",
            size === "compact" ? "h-6" : "h-8",
            refusal && "ring-1 ring-error-ring",
          )}
        >
          <NumberFieldScrubArea
            className={cn(
              "group/scrub flex h-full w-full min-w-0 items-center text-ui",
              editing ? "cursor-text" : "cursor-ew-resize",
              "data-[disabled]:cursor-not-allowed",
            )}
            onPointerDown={(event) => {
              // While typing, a press places the caret instead of scrubbing.
              if (editing || disabled || event.button > 0) {
                event.preventBaseUIHandler();
                return;
              }
              // A mixed value has no number to scrub from; a press types instead.
              if (value === null) {
                event.preventBaseUIHandler();
                event.preventDefault();
                inputRef.current?.focus();
                return;
              }
              scrub.start(value);
            }}
          >
            {labelPosition === "start" && labelNode}
            <NumberFieldInput
              ref={inputRef}
              aria-label={ariaLabel}
              aria-invalid={refusal !== null || undefined}
              size={size}
              value={shownText}
              placeholder={linkedAtRest ? undefined : placeholder}
              className={cn(
                "font-mono tabular-nums",
                editing ? "cursor-text" : "cursor-[inherit]",
                labelNode && labelPosition === "start" && "pl-1.5",
                labelNode && labelPosition === "end" && "pr-1.5",
                inputClassName,
              )}
              onFocus={(event) => {
                event.preventBaseUIHandler();
                // A press that may become a scrub focuses the field first; typing waits for release.
                if (scrub.pressed()) return;
                beginEditing();
              }}
              onBlur={(event) => {
                event.preventBaseUIHandler();
                endEditing();
              }}
              onChange={(event) => {
                event.preventBaseUIHandler();
                setText(event.currentTarget.value);
              }}
              onPaste={(event) => event.preventBaseUIHandler()}
              onKeyDown={(event) => {
                event.preventBaseUIHandler();
                event.nativeEvent.stopImmediatePropagation();
                switch (event.key) {
                  case "Enter":
                    event.currentTarget.blur();
                    return;
                  case "Escape":
                    if (scrub.pressed()) {
                      scrub.cancel();
                      return;
                    }
                    revertRef.current = true;
                    event.currentTarget.blur();
                    return;
                  case "ArrowUp":
                  case "ArrowDown":
                    event.preventDefault();
                    stepBy(event.key === "ArrowUp" ? 1 : -1, event);
                    return;
                }
              }}
            />
            {labelPosition === "end" && labelNode}
            {adornmentNode}
            <NumberFieldScrubAreaCursor className="pointer-events-none z-50 drop-shadow-[0_1px_1px_rgb(0_0_0/0.4)]">
              <MoveHorizontal aria-hidden className="size-5 text-primary" strokeWidth={2.25} />
            </NumberFieldScrubAreaCursor>
          </NumberFieldScrubArea>
          {ruler === null ? null : (
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-x-0 bottom-0 h-px origin-left bg-accent opacity-0 transition-opacity duration-150 ease-out",
                "group-hover/field:opacity-100 group-focus-within/field:opacity-100 group-data-[scrubbing]/field:opacity-100",
              )}
              // Follows the hand with no transition: a transition here would be latency.
              style={{ transform: `scaleX(${ruler})` }}
            />
          )}
        </NumberFieldGroup>
      </NumberField>
    </Tooltip>
  );
}

/** Where `value` sits between `min` and `max`, 0 to 1; null without a finite range to measure against. */
function rangeRatio(value: number | null, min?: number, max?: number): number | null {
  if (value === null || min === undefined || max === undefined) return null;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;

  return (Math.min(max, Math.max(min, value)) - min) / (max - min);
}
