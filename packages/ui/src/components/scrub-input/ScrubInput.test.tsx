import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ScrubInput } from "./ScrubInput";
import type { ScrubSession } from "./scrubSession";

afterEach(cleanup);

/** What a field did: the values it committed and what its scrub sessions saw. */
interface Outcome {
  commits: number[];
  previews: number[];
  sessionCommits: number[];
  cancels: number;
  texts: string[];
}

function Field({
  initial,
  outcome,
  withSession = false,
  editText = null,
}: {
  initial: number;
  outcome: Outcome;
  withSession?: boolean;
  editText?: string | null;
}) {
  const [value, setValue] = useState(initial);
  const session = (): ScrubSession => ({
    preview: (next) => outcome.previews.push(next),
    commit: (next) => {
      outcome.sessionCommits.push(next);
      setValue(next);
    },
    cancel: () => {
      outcome.cancels += 1;
    },
  });

  return (
    <ScrubInput
      aria-label="Width"
      label="W"
      value={value}
      editText={editText}
      onTextCommit={(text) => {
        outcome.texts.push(text);
        return text === "=nope" ? "No glyph named nope" : null;
      }}
      onValueCommit={(next) => {
        outcome.commits.push(next);
        setValue(next);
      }}
      onScrubStart={withSession ? session : undefined}
    />
  );
}

function setup(options: { withSession?: boolean; editText?: string | null } = {}) {
  const outcome: Outcome = { commits: [], previews: [], sessionCommits: [], cancels: 0, texts: [] };
  render(<Field initial={300} outcome={outcome} {...options} />);
  const input = screen.getByLabelText("Width") as HTMLInputElement;
  return { outcome, input };
}

function type(input: HTMLInputElement, text: string) {
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: text } });
}

/** A pointer event with the relative movement scrubbing reads under pointer lock. */
function pointer(type: string, init: { movementX?: number; shiftKey?: boolean; altKey?: boolean }) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    shiftKey: init.shiftKey ?? false,
    altKey: init.altKey ?? false,
  });
  Object.defineProperty(event, "movementX", { value: init.movementX ?? 0 });
  Object.defineProperty(event, "movementY", { value: 0 });
  Object.defineProperty(event, "pointerType", { value: "mouse" });
  return event;
}

async function pressLabel() {
  const label = screen.getByText("W");
  await act(async () => {
    fireEvent.pointerDown(label, { button: 0, pointerType: "mouse", clientX: 5, clientY: 5 });
  });
}

async function drag(
  steps: number,
  movementX: number,
  keys: { shiftKey?: boolean; altKey?: boolean } = {},
) {
  for (let i = 0; i < steps; i++) {
    await act(async () => {
      window.dispatchEvent(pointer("pointermove", { movementX, ...keys }));
    });
  }
}

async function release() {
  await act(async () => {
    window.dispatchEvent(pointer("pointerup", {}));
  });
}

describe("ScrubInput typing", () => {
  it("commits a typed sum on Enter", () => {
    const { outcome, input } = setup();

    type(input, "600+20");
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.blur(input);

    expect(outcome.commits).toEqual([620]);
    expect(input.value).toBe("620");
  });

  it("applies a leading operator to the current value", () => {
    const { outcome, input } = setup();

    type(input, "*2");
    fireEvent.blur(input);
    type(input, "/4");
    fireEvent.blur(input);

    expect(outcome.commits).toEqual([600, 150]);
  });

  it("reverts on Escape without committing", () => {
    const { outcome, input } = setup();

    type(input, "999");
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);

    expect(outcome.commits).toEqual([]);
    expect(input.value).toBe("300");
  });

  it("refuses text that is not a number and keeps the value", () => {
    const { outcome, input } = setup();

    type(input, "abc");
    fireEvent.blur(input);

    expect(outcome.commits).toEqual([]);
    expect(input.value).toBe("300");
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("steps with arrow keys: 1, Shift 10, Alt 0.1", () => {
    const { outcome, input } = setup();

    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    fireEvent.keyDown(input, { key: "ArrowUp", shiftKey: true });
    fireEvent.keyDown(input, { key: "ArrowDown", altKey: true });

    expect(outcome.commits).toEqual([301, 311, 310.9]);
    expect(input.value).toBe("310.9");
  });

  it("passes keys such as =H on, and shows a refused key's reason", () => {
    const { outcome, input } = setup({ editText: "=H" });

    fireEvent.focus(input);
    expect(input.value).toBe("=H");
    fireEvent.change(input, { target: { value: "=nope" } });
    fireEvent.blur(input);

    expect(outcome.texts).toEqual(["=nope"]);
    expect(outcome.commits).toEqual([]);
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("leaves an unchanged key alone", () => {
    const { outcome, input } = setup({ editText: "=H" });

    fireEvent.focus(input);
    fireEvent.blur(input);

    expect(outcome.texts).toEqual([]);
  });
});

describe("ScrubInput scrubbing", () => {
  it("previews every step and commits once on release", async () => {
    const { outcome, input } = setup({ withSession: true });

    await pressLabel();
    // A step per pixel moved, as Base UI's scrub area reads it.
    await drag(5, 2);
    expect(input.value).toBe("310");
    await release();

    expect(outcome.previews).toEqual([302, 304, 306, 308, 310]);
    expect(outcome.sessionCommits).toEqual([310]);
    expect(outcome.commits).toEqual([]);
    expect(input.value).toBe("310");
  });

  it("steps ten times with Shift and a tenth with Alt", async () => {
    const { outcome } = setup({ withSession: true });

    await pressLabel();
    await drag(2, 2, { shiftKey: true });
    await drag(1, 2, { altKey: true });
    await release();

    expect(outcome.sessionCommits).toEqual([340.2]);
  });

  it("cancels on Escape and restores the value", async () => {
    const { outcome, input } = setup({ withSession: true });

    await pressLabel();
    await drag(3, 2);
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    await drag(3, 2);
    await release();

    expect(outcome.cancels).toBe(1);
    expect(outcome.sessionCommits).toEqual([]);
    expect(outcome.commits).toEqual([]);
    expect(input.value).toBe("300");
  });

  it("commits once on release without a session", async () => {
    const { outcome, input } = setup();

    await pressLabel();
    await drag(4, 2);
    await release();

    expect(outcome.commits).toEqual([308]);
    expect(input.value).toBe("308");
  });

  it("starts typing when pressed without a drag", async () => {
    const { outcome, input } = setup();

    await pressLabel();
    await release();

    expect(outcome.commits).toEqual([]);
    fireEvent.change(input, { target: { value: "42" } });
    fireEvent.blur(input);
    expect(outcome.commits).toEqual([42]);
  });
});
