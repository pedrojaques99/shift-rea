import * as React from "react";
import { Slider as BaseSlider } from "@base-ui/react/slider";
import { cn } from "../../lib/utils";

type SliderRootProps = React.ComponentProps<typeof BaseSlider.Root<number>>;

export interface SliderProps extends Omit<
  SliderRootProps,
  "value" | "defaultValue" | "onValueChange" | "onValueCommitted"
> {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  /** Called once a drag, key press, or reset settles on a value. */
  onValueCommitted?: (value: number) => void;
  /**
   * The value a double-click on the slider returns to, such as an axis's
   * default; double-clicking does nothing without it.
   */
  resetValue?: number;
  trackClassName?: string;
  indicatorClassName?: string;
  thumbClassName?: string;
}

/**
 * A horizontal slider over Base UI's: arrow keys step by `step`, Shift by
 * ten steps, Home and End jump to the ends, and a double-click returns to
 * `resetValue` when there is one.
 */
export function Slider({
  "aria-label": ariaLabel,
  className,
  trackClassName,
  indicatorClassName,
  thumbClassName,
  onValueChange,
  onValueCommitted,
  resetValue,
  disabled,
  ...props
}: SliderProps) {
  const reset = (event: React.MouseEvent) => {
    if (resetValue === undefined || disabled) return;
    event.preventDefault();
    if (onValueChange) onValueChange(resetValue);
    if (onValueCommitted) onValueCommitted(resetValue);
  };

  return (
    <BaseSlider.Root
      className={cn(
        "group/slider relative flex w-full touch-none select-none items-center",
        "data-[disabled]:opacity-50",
        className,
      )}
      thumbAlignment="center"
      disabled={disabled}
      onValueChange={onValueChange ? (value) => onValueChange(value as number) : undefined}
      onValueCommitted={onValueCommitted ? (value) => onValueCommitted(value as number) : undefined}
      onDoubleClick={reset}
      {...props}
    >
      <BaseSlider.Control className="flex h-4 w-full cursor-pointer items-center px-1.75 group-data-[disabled]/slider:cursor-not-allowed">
        <BaseSlider.Track
          className={cn("relative h-1.5 w-full rounded-full bg-control-muted", trackClassName)}
        >
          <BaseSlider.Indicator
            className={cn("absolute h-full rounded-full bg-accent", indicatorClassName)}
          />
          <BaseSlider.Thumb
            aria-label={ariaLabel}
            className={cn(
              "size-3.5 rounded-full border-2 border-primary bg-surface shadow-sm",
              "transition-shadow duration-150 ease-out",
              "group-hover/slider:shadow-md group-data-[dragging]/slider:ring-2 group-data-[dragging]/slider:ring-accent/40",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
              thumbClassName,
            )}
          />
        </BaseSlider.Track>
      </BaseSlider.Control>
    </BaseSlider.Root>
  );
}
