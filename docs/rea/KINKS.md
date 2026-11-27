# Kinks: find them, fix them, stop drawing them

## The case that started this

The `a` of Visant Sans, at Regular, point 48 (the join where the terminal's outer edge leaves the bowl).
It is a smooth point in every master and the angle between its handles is right in each one:

| master     | in handle | out handle | in : out | handles off straight |
|------------|-----------|------------|----------|----------------------|
| ExtraLight | 74        | 14         | 5.3      | 0.9°                 |
| ExtraBold  | 37        | 72         | 0.5      | 0.4°                 |
| Regular    | 58        | 36         | (interp.)| **17°**              |

Each master is fine and the instance between them is broken. The tangent turns about 30° from
ExtraLight to ExtraBold, and the ratio of handle lengths flips. Linear interpolation then pulls the
two handles out of line. This is an **interpolation kink**. Glyphs users catch it with mekkablue's
*Kink Finder* and fix it with *Dekink Masters*.

`font.check` misses it today: it reports 14 missing extremes for this glyph and nothing at that point.

The second thing in the screenshot is a 10-unit curve with 3-unit handles at the other end of the
cut (points 0–3). It is a **short segment**: harmless to the outline, noisy to edit, and easy to
grab by mistake.

## Rule that removes the kink

The handles of a smooth point stay in line at **every** location if, in every master, they are in
line **and** the ratio `in : out` is the same. Interpolation is linear, so equal ratios carry over.
A fix therefore only needs the handle lengths, never a different shape.

## Plan

Existing practice comes first, as house rules ask:

- the check vocabulary follows fontbakery's outline checks (`outline_jaggy_segments`,
  `outline_short_segments`, `outline_colinear_vectors`) and Glyphs' Red Arrows;
- the fix follows mekkablue's *Dekink Masters*.

Nothing new is invented. The work is putting these into the check engine Shift already has.

### 1. Checks (Rust, `crates/shift-font/src/check`)

`outline.rs` already compares master pairs and blends contours, which is everything these checks need.

| code | name | what | severity |
|------|------|------|----------|
| I0xx | `interpolation-kink` | Smooth point whose handles drift more than 2° out of line anywhere between two compatible masters (sampled at the existing `SAMPLES`). The message gives the worst angle and where it happens. | warning; error above 10° |
| O0xx | `almost-smooth` | Corner whose handles are within 3° of a line: meant smooth, drawn as a corner. | warning |
| O0xx | `short-segment` | Segment shorter than 1.5% of UPM (≈14 units at 960). | warning |
| O0xx | `short-handle` | Off-curve point closer than 2 units to its on-curve point, so it no longer steers the curve. | warning |

All thresholds sit in `ShiftConfig` so a project can tune them.

### 2. Fix (one intent, one undo step)

`dekinkPoint { glyph, point }` gives the point the same `in : out` ratio in every master. It
uses the geometric mean of the masters' ratios, keeps each master's tangent direction and moves
only the two handle lengths, so the point stays where it is. It also sets `smooth` wherever the
handles are in line. Variants:

- **Dekink point**: the selected point(s).
- **Dekink glyph**: every finding of `interpolation-kink` in the glyph.
- **Fix almost-smooth**: rotate the shorter handle onto the longer handle's line.

All of these are reachable from the right-click menu, the command palette, the agent
(`shift.edits.apply`) and `shift-cli fix`.

### 3. Showing it while drawing (editor)

- **Marker:** an amber marker on the canvas at each finding of the open glyph (the check runs on
  the glyph alone, which is cheap, after every edit has settled). Click it to select the point;
  the inspector then shows the message and a **Fix** button.
- **Live kink while dragging:** dragging a handle of a smooth point that is also edited in other
  masters shows the worst between-master kink next to the cursor (`17° at wght 400`).
  Holding **Alt** while dragging keeps the master ratio, which prevents the kink as you draw.
- **Glyph grid:** an amber dot on the cell of any glyph with outline findings, so the whole font
  can be scanned.

### 4. Prevention in this font's scripts

The batch scripts in `manrope-derivative/scripts` refit handles master by master, which can bake
in this kink. Two changes fix that:

- a `dekink` pass after every batch, so every batch ends with equal ratios;
- `validate.py` fails on any `interpolation-kink` above 2°.

## Order

1. Check `interpolation-kink`, with Rust tests built from the `a` numbers above.
2. `dekinkPoint` intent, then the menu and palette entry.
3. The three O-checks.
4. The canvas marker and the inspector Fix button.
5. The live readout while dragging and Alt to keep the ratio.
6. The `dekink` pass and the gate in the font's build.

## Status (2026-11-26)

Shipped in the fork:

- `crates/shift-font/src/check/craft.rs` holds the checks `I009 interpolation-kink`,
  `O011 broken-smooth`, `O012 almost-smooth`, `O013 retracted-handle`,
  `O014 short-segment`, `O015 near-axis-line`, `O016 near-axis-handle` and
  `O017 redundant-point`.
  - Every finding carries the points it sits at and a `Fix`: moves per layer, and
    removals across all masters.
  - Angles are judged against integer rounding (1/length).
  - Handles are judged only at real extremes.
  - Removals are offered only when every master agrees.
- **Dekink** keeps the on-curve point in every master, keeps each master's total
  handle length, and gives the handles their geometric-mean `in : out` ratio.
- **Bridge and agent:** `FontFinding`, and the agent's `font.check`, now carry
  `points` and `fix`.
- **Editor:**
  - `CraftReview` reviews the open glyph 350 ms after it settles, never during a
    gesture, and drops stale results.
  - `CraftMarkers` draws a thin amber ring on each flagged point. The pill naming
    the problem appears only on the selected or hovered point.
- **Commands:**
  - **F** fixes the focused point.
  - **Shift+F** fixes the whole glyph in every master, as one undo step.
  - The right-click menu offers *Fix: …* on a flagged point.
  - View › *Show Outline Issues* turns the markers off.

On the Visant Sans sources (Roman), the new checks report the following:

| check              | findings |
|--------------------|----------|
| near-axis-handle   | 187      |
| broken-smooth      | 77       |
| almost-smooth      | 52       |
| interpolation-kink | 41       |
| near-axis-line     | 26       |
| retracted-handle   | 11       |
| short-segment      | 11       |
| redundant-point    | 1        |

Most of these are inherited from Manrope: smooth flags lost at 1–2°, and lines 1 unit off.

Still open:

- `shift-cli check --fix`;
- the glyph-grid dot;
- the live kink readout while dragging, and Alt to keep the ratio;
- the dekink pass and the gate in the font build.

## Masters that change structure along an axis (2026-11-26)

"Fix all" on the Shift document broke ink traps. In the masters with Ink Traps 0, the traps are closed on purpose: their points are stacked and their handles sit on those points. The per-master checks read that as slips and "fixed" them.

Each master is now judged against its peers, the other masters with the same structure:

- A join with a side shorter than 2 units is collapsed and has no direction: it is skipped.
- A near-smooth join is skipped when the same point is a clear corner in another master.
- A retracted handle is skipped when the same handle stands clear in another master.
- A kink is judged per pair of masters, using only masters that are smooth at that point. The dekink fix evens out every master that is smooth there or marked smooth (a crooked staged Regular included), and leaves corners alone.

The panel lists the problems of the master being edited and the problems between masters, and folds the other masters behind one line.
