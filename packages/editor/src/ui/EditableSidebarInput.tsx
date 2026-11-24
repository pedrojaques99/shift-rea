import { ScrubInput, type ScrubSession } from "@shift/ui";
import type { ReactNode } from "react";
import { NUDGES_VALUES } from "../types/nudge";
import { useSidebarInputFocus } from "./SidebarInputFocus";

export interface EditableSidebarInputProps {
  ariaLabel: string;
  label?: string | ReactNode;
  labelPosition?: "left" | "right";
  /** Classes for the input, such as `text-right` for a column of numbers. */
  className?: string;
  /** Classes for the whole field, such as a fixed width where its row sizes to its content. */
  fieldClassName?: string;
  value?: number | null;
  icon?: ReactNode;
  iconPosition?: "left" | "right" | "center";
  onValueChange?: (value: number) => void;
  /** Opens a live preview for a scrub, committed as one undo step on release. */
  onScrubStart?: () => ScrubSession | null;
  disabled?: boolean;
  suffix?: string;
  defaultValue?: number;
  /**
   * The text to edit instead of the value, such as a metrics key the value
   * follows. Editing it back unchanged changes nothing.
   */
  keyText?: string | null;
  /**
   * Takes text starting `=`, or blank text in place of {@link keyText}, as a
   * key instead of a value.
   *
   * @returns Why the key was refused, which the field then shows; null when it was taken.
   */
  onKeyCommit?: (text: string) => string | null;
  /** What the tooltip says; the field's accessible name when omitted. */
  tooltip?: string;
  /** Shown in place of a null value, such as "Mixed" when a selection differs. */
  placeholder?: string;
  /** The scrub and arrow step; Shift steps ten times it, Alt a tenth. */
  step?: number;
  min?: number;
  max?: number;
}

const ICON_POSITION = { left: "start", right: "end", center: "center" } as const;

/**
 * A numeric sidebar field: drag it sideways to scrub, or click to type a
 * number, a sum such as `600+20` or `*2`, or, with {@link onKeyCommit}, a
 * key such as `=H`.
 *
 * @remarks
 * Scrubbing previews through `onScrubStart` and commits once on release;
 * Escape cancels it. Arrow keys step by 1, Shift by 10, Alt by 0.1 and Cmd
 * or Ctrl by 100. While typing, the host's {@link useSidebarInputFocus}
 * hooks hold editor shortcuts.
 */
export function EditableSidebarInput({
  ariaLabel,
  label,
  labelPosition = "left",
  className,
  fieldClassName,
  value,
  icon,
  iconPosition = "right",
  onValueChange,
  onScrubStart,
  disabled = false,
  suffix,
  defaultValue = 0,
  keyText = null,
  onKeyCommit,
  placeholder,
  tooltip,
  step = NUDGES_VALUES.small,
  min,
  max,
}: EditableSidebarInputProps) {
  const focus = useSidebarInputFocus();

  return (
    <ScrubInput
      aria-label={ariaLabel}
      value={value === undefined ? defaultValue : value}
      onValueCommit={onValueChange}
      onScrubStart={onScrubStart}
      editText={keyText}
      onTextCommit={onKeyCommit}
      onEditingChange={(editing) => {
        if (!focus) return;
        if (editing) focus.onEditStart();
        else focus.onEditEnd();
      }}
      label={label}
      labelPosition={labelPosition === "left" ? "start" : "end"}
      adornment={icon}
      adornmentPosition={ICON_POSITION[iconPosition]}
      suffix={suffix}
      placeholder={placeholder}
      tooltip={tooltip}
      step={step}
      smallStep={step / 10}
      largeStep={step * NUDGES_VALUES.medium}
      accelStep={step * NUDGES_VALUES.large}
      min={min}
      max={max}
      disabled={disabled}
      className={fieldClassName}
      inputClassName={className}
    />
  );
}
