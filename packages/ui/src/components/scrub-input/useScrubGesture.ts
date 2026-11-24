import * as React from "react";
import type { ScrubSession } from "./scrubSession";

export interface ScrubGestureOptions {
  readonly inputRef: React.RefObject<HTMLInputElement | null>;
  /** Opens a live preview on the first step; null previews only the field's own number. */
  readonly onScrubStart?: () => ScrubSession | null;
  /** Rounds and clamps a scrubbed value as the field keeps it. */
  readonly settle: (value: number) => number;
  /** Commits a scrub that had no session. */
  readonly onCommit: (value: number) => void;
  /** Runs when a press ends without a drag. */
  readonly onClick: () => void;
}

export interface ScrubGesture {
  /** The value being scrubbed to, or null outside a drag. */
  readonly value: number | null;
  /** Whether a press, which may become a scrub, is down. */
  pressed(): boolean;
  /** Begins a press from `start`, the field's value. */
  start(start: number): void;
  /** Shows a scrub step. */
  preview(value: number): void;
  /** Ends the press: a click, a committed scrub, or a cancelled one. */
  end(value: number | null): void;
  /** Cancels the scrub and restores the value it started from. */
  cancel(): void;
}

interface Press {
  readonly start: number;
  session: ScrubSession | null;
  moved: boolean;
  cancelled: boolean;
  releasing: boolean;
  detach: () => void;
}

/**
 * The press-drag-release cycle behind a scrubbable field, over the steps
 * Base UI's `NumberField.ScrubArea` reports.
 *
 * @remarks
 * Escape cancels a drag, and so does losing pointer lock before release,
 * since Chromium leaves pointer lock on Escape, sometimes without a key event.
 * Unmounting mid-drag cancels its preview.
 */
export function useScrubGesture(options: ScrubGestureOptions): ScrubGesture {
  const [value, setValue] = React.useState<number | null>(null);
  const pressRef = React.useRef<Press | null>(null);
  const optionsRef = React.useRef(options);
  optionsRef.current = options;

  React.useEffect(
    () => () => {
      const press = pressRef.current;
      if (!press) return;
      press.detach();
      if (!press.cancelled) press.session?.cancel();
    },
    [],
  );

  const cancel = () => {
    const press = pressRef.current;
    if (!press || press.cancelled) return;

    press.cancelled = true;
    if (press.session) press.session.cancel();
    setValue(null);
  };

  const start = (startValue: number) => {
    const win = optionsRef.current.inputRef.current?.ownerDocument.defaultView;
    if (!win) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      cancel();
    };
    const onPointerLockChange = () => {
      const press = pressRef.current;
      if (!press || press.releasing || !press.moved) return;
      if (win.document.pointerLockElement === null) cancel();
    };
    const onPointerUp = () => {
      if (pressRef.current) pressRef.current.releasing = true;
    };

    win.addEventListener("keydown", onKeyDown, true);
    win.document.addEventListener("pointerlockchange", onPointerLockChange);
    win.addEventListener("pointerup", onPointerUp, true);
    pressRef.current = {
      start: startValue,
      session: null,
      moved: false,
      cancelled: false,
      releasing: false,
      detach: () => {
        win.removeEventListener("keydown", onKeyDown, true);
        win.document.removeEventListener("pointerlockchange", onPointerLockChange);
        win.removeEventListener("pointerup", onPointerUp, true);
      },
    };
  };

  const preview = (next: number) => {
    const press = pressRef.current;
    if (!press || press.cancelled) return;

    const settled = optionsRef.current.settle(next);
    if (!press.moved) {
      press.moved = true;
      const { onScrubStart } = optionsRef.current;
      press.session = onScrubStart ? onScrubStart() : null;
    }
    setValue(settled);
    if (press.session) press.session.preview(settled);
  };

  const end = (next: number | null) => {
    const press = pressRef.current;
    if (!press) return;

    pressRef.current = null;
    press.detach();
    if (!press.moved) {
      // A click: type into the field, which the press already focused.
      if (!press.cancelled) optionsRef.current.onClick();
      return;
    }

    setValue(null);
    optionsRef.current.inputRef.current?.blur();
    if (press.cancelled) return;

    const settled = optionsRef.current.settle(next ?? press.start);
    if (press.session) {
      press.session.commit(settled);
      return;
    }
    if (settled !== press.start) optionsRef.current.onCommit(settled);
  };

  return { value, pressed: () => pressRef.current !== null, start, preview, end, cancel };
}
