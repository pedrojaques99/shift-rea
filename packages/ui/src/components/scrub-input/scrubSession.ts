/**
 * One drag on a scrubbable field, from press to release.
 *
 * @remarks
 * A scrub opens a session on its first step, previews every step after, and
 * ends with exactly one of {@link commit} or {@link cancel}, so the whole drag
 * is one undo step and nothing is persisted per pixel.
 */
export interface ScrubSession {
  /** Shows `value` live, without persisting it. */
  preview(value: number): void;
  /** Keeps `value`, the last one previewed, as one edit. */
  commit(value: number): void;
  /** Restores what the field held when the scrub began. */
  cancel(): void;
}
