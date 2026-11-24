import type { ReactNode } from "react";
import { ScrubInput, type ScrubSession } from "@shift/ui";
import { NUDGES_VALUES } from "@shift/editor/types";

interface SidebarNumberFieldProps {
  /** Names the field for assistive technology and its tooltip. */
  ariaLabel: string;
  /** The value shown while the field is not being typed in; `null` shows `placeholder`. */
  value: number | null;
  /** Called with each committed value: on Enter, on blur, on every arrow step, and once per scrub without `onScrubStart`. */
  onValueCommit: (value: number) => void;
  /** Opens a live preview for a scrub, committed as one undo step on release. */
  onScrubStart?: () => ScrubSession | null;
  /** Called when the field is emptied and committed; without it, emptying keeps the value. */
  onClear?: () => void;
  /** A short leading label such as "W", or an icon. */
  label?: ReactNode;
  /** Formats the value with a unit, such as degrees. */
  unit?: "degree";
  /** Text after the number, such as "x" for a factor. */
  suffix?: string;
  /** Shown greyed while `value` is `null`, such as what an unset value falls back to. */
  placeholder?: string;
  /** Classes for the input, such as `text-right` for a column of numbers. */
  inputClassName?: string;
  /** The scrub and arrow step; Shift steps ten times it, Alt a tenth. */
  step?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
}

/**
 * A numeric sidebar field: drag it sideways to scrub, or click to type.
 *
 * @remarks
 * Arrow keys and scrubbing step by 1, Shift by 10 and Alt by 0.1; Cmd or
 * Ctrl arrow steps by 100, matching canvas nudges. Typed sums such as
 * `600+20` or `*2` are worked out. Enter commits and leaves the field,
 * Escape leaves it, or cancels a scrub, without committing. While focused,
 * the sidebar keeps keyboard focus and editor shortcuts do not fire.
 */
export function SidebarNumberField({
  ariaLabel,
  value,
  onValueCommit,
  onScrubStart,
  onClear,
  label,
  unit,
  suffix,
  placeholder,
  inputClassName,
  step = NUDGES_VALUES.small,
  min,
  max,
  disabled = false,
}: SidebarNumberFieldProps) {
  return (
    <ScrubInput
      aria-label={ariaLabel}
      value={value}
      onValueCommit={onValueCommit}
      onScrubStart={onScrubStart}
      onClear={onClear}
      label={label}
      suffix={unit === "degree" ? "°" : suffix}
      placeholder={placeholder}
      inputClassName={inputClassName}
      step={step}
      smallStep={step / 10}
      largeStep={step * NUDGES_VALUES.medium}
      accelStep={step * NUDGES_VALUES.large}
      min={min}
      max={max}
      disabled={disabled}
    />
  );
}
