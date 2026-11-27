//! Craft checks: what a type designer's review catches in outlines that
//! compile and interpolate, but read as unfinished.
//!
//! The vocabulary follows established tools rather than inventing one:
//! fontbakery's outline checks (`outline_jaggy_segments`,
//! `outline_short_segments`, `outline_colinear_vectors`,
//! `outline_semi_vertical`), Glyphs' Red Arrows, and mekkablue's Kink Finder
//! and Dekink Masters.
//!
//! Every finding comes with the [`Fix`] that resolves it, computed here so the
//! editor, the command line and the agent apply the same edit:
//!
//! - fixes that move points are per master and keep on-curve points where the
//!   designer put them; only handles turn or change length, except where a
//!   line is levelled;
//! - fixes that remove points are offered only when the condition holds in
//!   every compatible master, and remove the matching point in all of them,
//!   so the glyph stays compatible.
//!
//! Angles are judged against what integer coordinates can draw: a handle
//! 14 units long can't point closer than about 4° to a given direction, so
//! nothing within that rounding is reported.

use kurbo::Vec2;

use crate::{Contour, Font, Glyph, GlyphLayer, PointId, Source};

use super::{Check, Finding, Fix, PointMove, PointRemoval};

/// Tolerances for the craft checks.
#[derive(Clone, Debug, PartialEq)]
pub struct CraftThresholds {
    /// A corner whose handles are within this many degrees of a line reads as
    /// a smooth point drawn slightly wrong.
    pub almost_smooth_degrees: f64,
    /// A line or handle within this many degrees of horizontal or vertical
    /// (or the master's italic angle) was meant to sit on it.
    pub near_axis_degrees: f64,
    /// An interpolated smooth point is reported when its handles leave a line
    /// by this many degrees more than they do in the masters.
    pub kink_degrees: f64,
    /// A segment shorter than this fraction of the em is a stray.
    pub short_segment_em: f64,
    /// Lines and handles shorter than this fraction of the em are too short
    /// to judge their angle.
    pub min_axis_length_em: f64,
    /// A handle closer than this to its on-curve point, in units, is retracted.
    pub retracted_handle_units: f64,
}

impl Default for CraftThresholds {
    fn default() -> Self {
        Self {
            almost_smooth_degrees: 3.0,
            near_axis_degrees: 1.5,
            kink_degrees: 1.5,
            short_segment_em: 0.005,
            min_axis_length_em: 0.02,
            retracted_handle_units: 0.5,
        }
    }
}

/// Runs the craft checks on `glyph`.
pub(super) fn check(font: &Font, glyph: &Glyph, thresholds: &CraftThresholds) -> Vec<Finding> {
    let part = glyph.name().starts_with('_') && glyph.unicodes().is_empty();
    if part || font.lib().skipped_export_glyphs().contains(glyph.name()) {
        return Vec::new();
    }
    let upm = font.metrics().units_per_em;
    let masters = font.masters_with_layers(glyph).collect::<Vec<_>>();
    let compatible = compatible_masters(&masters);

    let shapes = masters
        .iter()
        .map(|(_, layer)| shape(layer))
        .collect::<Vec<_>>();
    let mut findings = Vec::new();
    for (index, (source, layer)) in masters.iter().enumerate() {
        // The same drawing in the other masters, point for point: what tells a
        // slip from a design that changes along an axis, such as an ink trap
        // closed to a stack of points in one master and open in another.
        let peers = masters
            .iter()
            .zip(&shapes)
            .enumerate()
            .filter(|(other, (_, other_shape))| *other != index && **other_shape == shapes[index])
            .map(|(_, ((_, peer), _))| *peer)
            .collect::<Vec<_>>();
        let craft = LayerCraft {
            glyph,
            source,
            layer,
            peers,
            upm,
            thresholds,
        };
        findings.extend(craft.joins());
        findings.extend(craft.handles());
        findings.extend(craft.lines());
    }
    if !compatible.is_empty() {
        let glyph_craft = GlyphCraft {
            glyph,
            masters: &compatible,
            upm,
            thresholds,
        };
        findings.extend(glyph_craft.kinks());
        findings.extend(glyph_craft.removable());
    }
    findings
}

/// A layer's structure: per contour, whether it is closed and which points
/// are on the curve. Two layers with the same shape interpolate point for point.
fn shape(layer: &GlyphLayer) -> Vec<(bool, Vec<bool>)> {
    layer
        .contours_iter()
        .map(|contour| {
            (
                contour.is_closed(),
                contour
                    .points()
                    .iter()
                    .map(crate::Point::is_on_curve)
                    .collect::<Vec<_>>(),
            )
        })
        .collect()
}

/// The masters whose layers share the first one's contours, point for point:
/// the ones a fix that removes points, or a kink between two masters, concerns.
fn compatible_masters<'a>(
    masters: &[(&'a Source, &'a GlyphLayer)],
) -> Vec<(&'a Source, &'a GlyphLayer)> {
    let Some((_, first)) = masters.first() else {
        return Vec::new();
    };
    let reference = shape(first);
    if reference.is_empty() {
        return Vec::new();
    }
    let compatible = masters
        .iter()
        .filter(|(_, layer)| shape(layer) == reference)
        .copied()
        .collect::<Vec<_>>();
    if compatible.len() == masters.len() {
        compatible
    } else {
        // An incompatible master already fails the interpolation checks; a
        // structural fix on the rest would only widen the gap.
        Vec::new()
    }
}

/// The two directions that meet at an on-curve point.
#[derive(Clone, Copy, Debug)]
struct Join {
    /// From the incoming neighbour to the point.
    incoming: Vec2,
    /// From the point to the outgoing neighbour.
    outgoing: Vec2,
    /// Whether each side is a handle (`true`) or a line (`false`).
    incoming_handle: bool,
    outgoing_handle: bool,
    previous: usize,
    next: usize,
}

impl Join {
    /// The join at `index` of a closed contour, when at least one side is a
    /// handle and neither side has zero length.
    fn at(contour: &Contour, index: usize) -> Option<Self> {
        let points = contour.points();
        let count = points.len();
        if !contour.is_closed() || count < 3 || !points[index].is_on_curve() {
            return None;
        }
        let previous = (index + count - 1) % count;
        let next = (index + 1) % count;
        let here = points[index].position();
        let incoming = here - points[previous].position();
        let outgoing = points[next].position() - here;
        let incoming_handle = !points[previous].is_on_curve();
        let outgoing_handle = !points[next].is_on_curve();
        (incoming.hypot() > 0.0 && outgoing.hypot() > 0.0).then_some(Self {
            incoming,
            outgoing,
            incoming_handle,
            outgoing_handle,
            previous,
            next,
        })
    }

    fn has_handle(&self) -> bool {
        self.incoming_handle || self.outgoing_handle
    }

    /// How far the two sides turn from a straight line, in degrees.
    fn deviation(&self) -> f64 {
        angle_between(self.incoming, self.outgoing)
    }

    /// What integer coordinates can draw: the deviation rounding alone could cause.
    fn rounding(&self) -> f64 {
        rounding(self.incoming.hypot()) + rounding(self.outgoing.hypot())
    }
}

/// The angle from `a` to `b`, in degrees, from 0 (same direction) to 180.
fn angle_between(a: Vec2, b: Vec2) -> f64 {
    libm::atan2(a.cross(b), a.dot(b)).abs().to_degrees()
}

/// The largest error in a direction drawn with integer coordinates over `length`.
fn rounding(length: f64) -> f64 {
    if length <= 0.0 {
        return 180.0;
    }
    libm::atan(1.0 / length).to_degrees()
}

fn unit(vector: Vec2) -> Vec2 {
    let length = vector.hypot();
    if length > 0.0 {
        vector / length
    } else {
        vector
    }
}

fn rounded(point: kurbo::Point) -> (f64, f64) {
    (point.x.round(), point.y.round())
}

/// The vertical direction of a master: straight up, or leaning by its italic angle.
fn upright(source: &Source) -> Vec2 {
    let angle = source.italic_angle().unwrap_or(0.0);
    unit(Vec2::new(-libm::tan(angle.to_radians()), 1.0))
}

/// One glyph's layer in one master, as the craft checks read it.
struct LayerCraft<'a> {
    glyph: &'a Glyph,
    source: &'a Source,
    layer: &'a GlyphLayer,
    /// The glyph's other masters with the same structure.
    peers: Vec<&'a GlyphLayer>,
    upm: f64,
    thresholds: &'a CraftThresholds,
}

impl LayerCraft<'_> {
    /// The joins at the same point in the other masters.
    fn peer_joins(&self, contour: usize, at: usize) -> Vec<Join> {
        self.peers
            .iter()
            .filter_map(|peer| Join::at(peer.contours_iter().nth(contour)?, at))
            .collect()
    }

    /// Whether the point at `at` is a corner, plainly, in another master: then
    /// a near-smooth join here is that corner closing along an axis.
    fn corner_elsewhere(&self, contour: usize, at: usize) -> bool {
        self.peer_joins(contour, at)
            .iter()
            .any(|join| join.deviation() > self.thresholds.almost_smooth_degrees)
    }

    /// Whether the point at `at` is smooth in most of the other masters that
    /// draw it at all (collapsed ones say nothing): a corner here is then a
    /// smooth point drawn crooked in this master.
    fn smooth_in_most(&self, contour: usize, at: usize) -> bool {
        let joins = self
            .peer_joins(contour, at)
            .into_iter()
            .filter(|join| !Self::collapsed(join))
            .collect::<Vec<_>>();
        let smooth = joins
            .iter()
            .filter(|join| join.deviation() <= self.thresholds.almost_smooth_degrees)
            .count();
        smooth >= 2 && smooth * 2 > joins.len()
    }

    /// Whether the off-curve point at `handle` stands clear of its on-curve
    /// point `at` in another master: a handle retracted here is then a
    /// structure collapsed in this master on purpose, as a closed ink trap.
    fn opens_elsewhere(&self, contour: usize, at: usize, handle: usize) -> bool {
        self.peers.iter().any(|peer| {
            peer.contours_iter().nth(contour).is_some_and(|c| {
                let points = c.points();
                points[handle].position().distance(points[at].position()) > COLLAPSED_UNITS
            })
        })
    }

    /// Whether any part of the join at `at` is collapsed here: a side too short
    /// to have a direction, as the points stacked in a closed ink trap.
    fn collapsed(join: &Join) -> bool {
        join.incoming.hypot() < COLLAPSED_UNITS || join.outgoing.hypot() < COLLAPSED_UNITS
    }

    fn at(&self, check: Check, contour: usize, point: PointId, message: &str) -> Finding {
        Finding::glyph(
            check,
            self.glyph.id(),
            format!(
                "'{}' in '{}' {message}",
                self.glyph.name(),
                self.source.name()
            ),
        )
        .in_source(self.source.id())
        .in_contour(contour)
        .at_points(vec![point])
    }

    fn moves(&self, moves: Vec<(PointId, kurbo::Point)>) -> Vec<PointMove> {
        moves
            .into_iter()
            .map(|(point_id, position)| {
                let (x, y) = rounded(position);
                PointMove {
                    layer_id: self.layer.id(),
                    point_id,
                    x,
                    y,
                }
            })
            .collect()
    }

    /// Smooth points whose handles don't line up, and corners that almost do.
    fn joins(&self) -> Vec<Finding> {
        let mut findings = Vec::new();
        for (index, contour) in self.layer.contours_iter().enumerate() {
            let points = contour.points();
            for (at, point) in points.iter().enumerate() {
                let Some(join) = Join::at(contour, at) else {
                    continue;
                };
                if !join.has_handle() || Self::collapsed(&join) {
                    continue;
                }
                let deviation = join.deviation();
                if deviation <= join.rounding() {
                    continue;
                }
                if deviation <= self.thresholds.almost_smooth_degrees
                    && self.corner_elsewhere(index, at)
                    && !self.smooth_in_most(index, at)
                {
                    continue;
                }
                let smooth_elsewhere = self.smooth_in_most(index, at);
                let check = if point.is_smooth() || smooth_elsewhere {
                    Check::BrokenSmooth
                } else if deviation <= self.thresholds.almost_smooth_degrees {
                    Check::AlmostSmooth
                } else {
                    continue;
                };
                let what = match check {
                    Check::BrokenSmooth if !point.is_smooth() => format!(
                        "has a {deviation:.1}° corner in contour {} where the other masters are smooth, so the curve breaks between them",
                        index + 1
                    ),
                    Check::BrokenSmooth => format!(
                        "has a smooth point in contour {} whose handles turn {deviation:.1}° off a line, so the curve breaks there",
                        index + 1
                    ),
                    _ => format!(
                        "has a corner in contour {} only {deviation:.1}° from smooth: it reads as a smooth point drawn slightly off",
                        index + 1
                    ),
                };
                let fix = Fix::new("Line up handles", self.moves(align(contour, at, &join)));
                findings.push(self.at(check, index, point.id(), &what).with_fix(fix));
            }
        }
        findings
    }

    /// Handles drawn onto their own point, and handles a hair off the axis.
    fn handles(&self) -> Vec<Finding> {
        let mut findings = Vec::new();
        let near = self.thresholds.near_axis_degrees;
        let min_length = self.thresholds.min_axis_length_em * self.upm;
        let upright = upright(self.source);
        for (index, contour) in self.layer.contours_iter().enumerate() {
            let points = contour.points();
            let count = points.len();
            if !contour.is_closed() || count < 3 {
                continue;
            }
            for at in 0..count {
                let point = &points[at];
                if !point.is_on_curve() {
                    continue;
                }
                for step in [count - 1, 1] {
                    let handle_at = (at + step) % count;
                    let handle = &points[handle_at];
                    if handle.is_on_curve() {
                        continue;
                    }
                    let vector = handle.position() - point.position();
                    let length = vector.hypot();

                    // A retracted handle: the curve leaves its point with no direction.
                    if length <= self.thresholds.retracted_handle_units {
                        if self.opens_elsewhere(index, at, handle_at) {
                            continue;
                        }
                        let far_at = (handle_at + step) % count;
                        let far = &points[far_at];
                        let far_retracted = !far.is_on_curve()
                            && far
                                .position()
                                .distance(points[(far_at + step) % count].position())
                                <= self.thresholds.retracted_handle_units;
                        if far.is_on_curve() || far_retracted {
                            // Both handles retracted: a line drawn as a curve,
                            // which `removable` handles across masters.
                            continue;
                        }
                        let target = point.position() + (far.position() - point.position()) / 3.0;
                        let fix =
                            Fix::new("Pull handle out", self.moves(vec![(handle.id(), target)]));
                        findings.push(
                            self.at(
                                Check::RetractedHandle,
                                index,
                                point.id(),
                                &format!(
                                    "has a handle in contour {} drawn onto its own point, which hides a corner and steers interpolation badly",
                                    index + 1
                                ),
                            )
                            .with_fix(fix),
                        );
                        continue;
                    }

                    if length < min_length {
                        continue;
                    }
                    let Some((axis, off)) = near_axis(vector, upright) else {
                        continue;
                    };
                    if off <= rounding(length) || off > near {
                        continue;
                    }
                    // Only an extreme wants its handles on the axis: elsewhere a
                    // tangent a degree off is the design, not a slip.
                    if !is_extreme(points, at, axis) {
                        continue;
                    }
                    // Turning one handle of a smooth point turns its twin with it.
                    let mut moves = vec![(handle.id(), point.position() + axis * length)];
                    let twin = &points[(at + count - step) % count];
                    let twin_vector = twin.position() - point.position();
                    if twin_vector.hypot() > 0.0
                        && angle_between(-vector, twin_vector)
                            <= self.thresholds.almost_smooth_degrees
                    {
                        if twin.is_on_curve() {
                            // A line on the other side sets the direction; leave it.
                            continue;
                        }
                        moves.push((twin.id(), point.position() - axis * twin_vector.hypot()));
                    }
                    let fix = Fix::new("Straighten handle", self.moves(moves));
                    findings.push(
                        self.at(
                            Check::NearAxisHandle,
                            index,
                            point.id(),
                            &format!(
                                "has a handle in contour {} {off:.1}° off {}, a hair from where extremes and hinting want it",
                                index + 1,
                                axis_name(axis, upright)
                            ),
                        )
                        .with_fix(fix),
                    );
                }
            }
        }
        findings
    }

    /// Lines a hair off horizontal or vertical.
    fn lines(&self) -> Vec<Finding> {
        let mut findings = Vec::new();
        let near = self.thresholds.near_axis_degrees;
        let min_length = self.thresholds.min_axis_length_em * self.upm;
        let upright = upright(self.source);
        for (index, contour) in self.layer.contours_iter().enumerate() {
            let points = contour.points();
            let count = points.len();
            if !contour.is_closed() || count < 3 {
                continue;
            }
            for at in 0..count {
                let next_at = (at + 1) % count;
                let (start, end) = (&points[at], &points[next_at]);
                if !start.is_on_curve() || !end.is_on_curve() {
                    continue;
                }
                let vector = end.position() - start.position();
                let length = vector.hypot();
                if length < min_length {
                    continue;
                }
                let Some((axis, off)) = near_axis(vector, upright) else {
                    continue;
                };
                if off <= rounding(length) || off > near {
                    continue;
                }
                // Turn the line about its middle onto the axis, carrying each
                // end's handles with it.
                let middle = start.position().midpoint(end.position());
                let half = axis * (vector.dot(axis) / 2.0);
                let targets = [(at, middle - half), (next_at, middle + half)];
                let mut moves = Vec::new();
                for (point_at, target) in targets {
                    let delta = target - points[point_at].position();
                    moves.push((points[point_at].id(), target));
                    for side in [(point_at + count - 1) % count, (point_at + 1) % count] {
                        if !points[side].is_on_curve() {
                            moves.push((points[side].id(), points[side].position() + delta));
                        }
                    }
                }
                let fix = Fix::new("Straighten line", self.moves(moves));
                findings.push(
                    self.at(
                        Check::NearAxisLine,
                        index,
                        start.id(),
                        &format!(
                            "has a line in contour {} {off:.1}° off {}: meant straight, drawn a hair off",
                            index + 1,
                            axis_name(axis, upright)
                        ),
                    )
                    .at_points(vec![start.id(), end.id()])
                    .with_fix(fix),
                );
            }
        }
        findings
    }
}

/// Whether the on-curve point at `at` is where the contour turns back across
/// `axis`: the on-curve points before and after it both lie on the same side
/// of the line through it along `axis`.
fn is_extreme(points: &[crate::Point], at: usize, axis: Vec2) -> bool {
    let count = points.len();
    let here = points[at].position();
    let normal = Vec2::new(-axis.y, axis.x);
    let side = |step: usize| {
        let mut k = (at + step) % count;
        while !points[k].is_on_curve() && k != at {
            k = (k + step) % count;
        }
        (points[k].position() - here).dot(normal)
    };
    let (before, after) = (side(count - 1), side(1));
    before * after > 0.0
}

/// The axis `vector` runs nearest to, as a unit vector pointing its way, and
/// how many degrees it is off: horizontal, or the master's upright.
fn near_axis(vector: Vec2, upright: Vec2) -> Option<(Vec2, f64)> {
    let horizontal = Vec2::new(1.0, 0.0);
    [horizontal, upright]
        .into_iter()
        .map(|axis| {
            let axis = if vector.dot(axis) < 0.0 { -axis } else { axis };
            (axis, angle_between(vector, axis))
        })
        .min_by(|a, b| a.1.total_cmp(&b.1))
}

fn axis_name(axis: Vec2, upright: Vec2) -> &'static str {
    if axis.y.abs() < 1e-9 {
        "horizontal"
    } else if upright.x.abs() > 1e-9 {
        "the italic angle"
    } else {
        "vertical"
    }
}

/// Moves that line up the handles at `at` without moving the point: a line
/// on one side sets the direction; two handles turn onto the line between
/// their tips, each keeping its length.
fn align(contour: &Contour, at: usize, join: &Join) -> Vec<(PointId, kurbo::Point)> {
    let points = contour.points();
    let here = points[at].position();
    let direction = match (join.incoming_handle, join.outgoing_handle) {
        (false, true) => unit(join.incoming),
        (true, false) => unit(join.outgoing),
        _ => unit(points[join.next].position() - points[join.previous].position()),
    };
    let mut moves = Vec::new();
    if join.incoming_handle {
        moves.push((
            points[join.previous].id(),
            here - direction * join.incoming.hypot(),
        ));
    }
    if join.outgoing_handle {
        moves.push((
            points[join.next].id(),
            here + direction * join.outgoing.hypot(),
        ));
    }
    moves
}

/// One glyph across its compatible masters.
struct GlyphCraft<'a> {
    glyph: &'a Glyph,
    masters: &'a [(&'a Source, &'a GlyphLayer)],
    upm: f64,
    thresholds: &'a CraftThresholds,
}

/// Shorter than this, in units, a handle or segment has no reliable direction:
/// a stack of points, as an ink trap closed in one master.
const COLLAPSED_UNITS: f64 = 2.0;

/// Fractions of the way between two masters where kinks are sampled.
const SAMPLES: [f64; 5] = [0.1, 0.25, 0.5, 0.75, 0.9];

impl GlyphCraft<'_> {
    fn point_ids(&self, contour: usize, at: usize) -> Vec<PointId> {
        self.masters
            .iter()
            .filter_map(|(_, layer)| {
                layer
                    .contours_iter()
                    .nth(contour)
                    .map(|c| c.points()[at].id())
            })
            .collect()
    }

    /// Smooth points that stay smooth in every master but break between them,
    /// because their handles keep different proportions.
    fn kinks(&self) -> Vec<Finding> {
        let mut findings = Vec::new();
        if self.masters.len() < 2 {
            return findings;
        }
        let layers = self
            .masters
            .iter()
            .map(|(_, layer)| layer.contours_iter().collect::<Vec<_>>())
            .collect::<Vec<_>>();
        let Some(first) = layers.first() else {
            return findings;
        };
        for (index, contour) in first.iter().enumerate() {
            for at in 0..contour.points().len() {
                let joins = layers
                    .iter()
                    .map(|contours| Join::at(contours[index], at))
                    .collect::<Option<Vec<_>>>();
                let Some(joins) = joins else { continue };
                if !joins[0].has_handle() {
                    continue;
                }
                // A kink needs two masters smooth there; a deliberate corner
                // can't kink. A master already broken there (a smooth point
                // baked crooked, as an instance staged as a master) is left out
                // of the pairs and evened out by the fix.
                let smooth = joins
                    .iter()
                    .map(|join| join.deviation() <= self.thresholds.almost_smooth_degrees)
                    .collect::<Vec<_>>();
                let mut worst: Option<(f64, usize, usize, f64)> = None;
                for a in 0..joins.len() {
                    for b in a + 1..joins.len() {
                        if !(smooth[a] && smooth[b]) {
                            continue;
                        }
                        let ends = joins[a].deviation().max(joins[b].deviation());
                        for t in SAMPLES {
                            let blended = blend(&joins[a], &joins[b], t);
                            let excess = blended.deviation() - ends;
                            if worst.is_none_or(|(w, ..)| excess > w) {
                                worst = Some((excess, a, b, t));
                            }
                        }
                    }
                }
                let Some((excess, a, b, t)) = worst else {
                    continue;
                };
                if excess < self.thresholds.kink_degrees {
                    continue;
                }
                let fix = Fix::new(
                    "Even out handles in every master",
                    self.dekink(&layers, index, at),
                );
                findings.push(
                    Finding::glyph(
                        Check::InterpolationKink,
                        self.glyph.id(),
                        format!(
                            "'{}' kinks by {excess:.0}° at a smooth point of contour {} between '{}' and '{}' ({:.0}% of the way): each master is smooth, but its handles keep different proportions",
                            self.glyph.name(),
                            index + 1,
                            self.masters[a].0.name(),
                            self.masters[b].0.name(),
                            t * 100.0
                        ),
                    )
                    .in_contour(index)
                    .at_points(self.point_ids(index, at))
                    .with_fix(fix),
                );
            }
        }
        findings
    }

    /// Gives the point at `at` the same proportion of handle lengths in every
    /// master (their geometric mean), keeping each master's point in place,
    /// its handle directions in line, and its total handle length.
    fn dekink(&self, layers: &[Vec<&Contour>], index: usize, at: usize) -> Vec<PointMove> {
        // Every master where the point is meant smooth: smooth within the
        // tolerance, or marked smooth however crooked it is drawn. A master
        // that draws a corner there keeps it.
        let meant = |contours: &Vec<&Contour>| {
            let join = Join::at(contours[index], at)?;
            (join.deviation() <= self.thresholds.almost_smooth_degrees
                || contours[index].points()[at].is_smooth())
            .then_some(join)
        };
        let chosen = self
            .masters
            .iter()
            .zip(layers)
            .filter_map(|(master, contours)| Some((*master, contours, meant(contours)?)))
            .collect::<Vec<_>>();
        let joins = chosen.iter().map(|(_, _, join)| *join).collect::<Vec<_>>();
        // The target `in : out` is chosen so every master only shortens a
        // handle, never lengthens one: a longer handle can push the curve past
        // its extreme or into a bump. Two handles: the geometric mean, each
        // master shortening whichever side is too long. A line on one side
        // fixes that side, so the target is the one every handle can reach
        // by shortening.
        let ratios = joins
            .iter()
            .map(|join| join.incoming.hypot() / join.outgoing.hypot())
            .collect::<Vec<_>>();
        let target = match (joins[0].incoming_handle, joins[0].outgoing_handle) {
            (false, true) => ratios.iter().copied().fold(f64::MIN, f64::max),
            (true, false) => ratios.iter().copied().fold(f64::MAX, f64::min),
            _ => (ratios.iter().map(|r| r.ln()).sum::<f64>() / ratios.len() as f64).exp(),
        };

        let mut moves = Vec::new();
        for ((_, layer), contours, join) in &chosen {
            let contour = contours[index];
            let points = contour.points();
            let here = points[at].position();
            let direction = match (join.incoming_handle, join.outgoing_handle) {
                (false, true) => unit(join.incoming),
                (true, false) => unit(join.outgoing),
                _ => unit(points[join.next].position() - points[join.previous].position()),
            };
            let mut push = |point: &crate::Point, position: kurbo::Point| {
                let (x, y) = rounded(position);
                moves.push(PointMove {
                    layer_id: layer.id(),
                    point_id: point.id(),
                    x,
                    y,
                });
            };
            match (join.incoming_handle, join.outgoing_handle) {
                (true, true) => {
                    let (incoming, outgoing) = (join.incoming.hypot(), join.outgoing.hypot());
                    let (incoming, outgoing) = if incoming / outgoing > target {
                        (outgoing * target, outgoing)
                    } else {
                        (incoming, incoming / target)
                    };
                    push(&points[join.previous], here - direction * incoming);
                    push(&points[join.next], here + direction * outgoing);
                }
                // A line sets one side: the handle takes the target share of the line's length.
                (false, true) => {
                    push(
                        &points[join.next],
                        here + direction * (join.incoming.hypot() / target),
                    );
                }
                (true, false) => {
                    push(
                        &points[join.previous],
                        here - direction * (join.outgoing.hypot() * target),
                    );
                }
                (false, false) => {}
            }
        }
        moves
    }

    /// Points every master can do without: on-curve points in the middle of a
    /// straight line, segments too short to see, and curves whose handles sit
    /// on their points.
    fn removable(&self) -> Vec<Finding> {
        let mut findings = Vec::new();
        let layers = self
            .masters
            .iter()
            .map(|(source, layer)| (*source, *layer, layer.contours_iter().collect::<Vec<_>>()))
            .collect::<Vec<_>>();
        let Some((_, _, first)) = layers.first() else {
            return findings;
        };
        let short = self.thresholds.short_segment_em * self.upm;
        let retracted = self.thresholds.retracted_handle_units;
        for (index, contour) in first.iter().enumerate() {
            let count = contour.points().len();
            if !contour.is_closed() || count < 4 {
                continue;
            }
            let on_curves = contour.points().iter().filter(|p| p.is_on_curve()).count();
            for at in 0..count {
                let every = |test: &dyn Fn(&[crate::Point]) -> bool| {
                    layers
                        .iter()
                        .all(|(_, _, contours)| test(contours[index].points()))
                };
                let previous = (at + count - 1) % count;
                let next = (at + 1) % count;

                // A point in the middle of a straight line.
                let redundant = on_curves > 3
                    && every(&|points| {
                        let (a, p, b) = (&points[previous], &points[at], &points[next]);
                        if !(a.is_on_curve() && p.is_on_curve() && b.is_on_curve()) {
                            return false;
                        }
                        let (incoming, outgoing) =
                            (p.position() - a.position(), b.position() - p.position());
                        let (l1, l2) = (incoming.hypot(), outgoing.hypot());
                        l1 > 0.0
                            && l2 > 0.0
                            && angle_between(incoming, outgoing) <= rounding(l1).min(rounding(l2))
                    });
                if redundant {
                    findings.push(self.removal(
                        &layers,
                        Check::RedundantPoint,
                        index,
                        at,
                        &[at],
                        format!(
                            "'{}' has a point in contour {} in the middle of a straight line in every master; it does nothing",
                            self.glyph.name(),
                            index + 1
                        ),
                        "Remove point",
                    ));
                    continue;
                }

                if !contour.points()[at].is_on_curve() {
                    continue;
                }
                // The segment from this on-curve point to the next one.
                let mut end = next;
                let mut handles = Vec::new();
                while !contour.points()[end].is_on_curve() {
                    handles.push(end);
                    end = (end + 1) % count;
                    if end == at {
                        break;
                    }
                }
                if end == at {
                    continue;
                }

                // A curve whose handles both sit on their points: a line drawn as a curve.
                if handles.len() == 2
                    && every(&|points| {
                        points[handles[0]]
                            .position()
                            .distance(points[at].position())
                            <= retracted
                            && points[handles[1]]
                                .position()
                                .distance(points[end].position())
                                <= retracted
                    })
                {
                    findings.push(self.removal(
                        &layers,
                        Check::RetractedHandle,
                        index,
                        at,
                        &handles,
                        format!(
                            "'{}' has a curve in contour {} whose handles sit on its points in every master: a line drawn as a curve",
                            self.glyph.name(),
                            index + 1
                        ),
                        "Make it a line",
                    ));
                    continue;
                }

                // A segment too short to see, in every master.
                if on_curves > 3
                    && every(&|points| {
                        points[at].position().distance(points[end].position()) < short
                    })
                {
                    let mut gone = handles.clone();
                    gone.push(end);
                    findings.push(self.removal(
                        &layers,
                        Check::ShortSegment,
                        index,
                        at,
                        &gone,
                        format!(
                            "'{}' has a segment in contour {} shorter than {short:.0} units in every master; it draws nothing you can see and catches the pointer",
                            self.glyph.name(),
                            index + 1
                        ),
                        "Remove segment",
                    ));
                }
            }
        }
        findings
    }

    #[allow(
        clippy::too_many_arguments,
        reason = "one call site builds every removal"
    )]
    fn removal(
        &self,
        layers: &[(&Source, &GlyphLayer, Vec<&Contour>)],
        check: Check,
        index: usize,
        at: usize,
        remove: &[usize],
        message: String,
        label: &str,
    ) -> Finding {
        let deletes = layers
            .iter()
            .flat_map(|(_, layer, contours)| {
                remove.iter().map(|&k| PointRemoval {
                    layer_id: layer.id(),
                    point_id: contours[index].points()[k].id(),
                })
            })
            .collect();
        Finding::glyph(check, self.glyph.id(), message)
            .in_contour(index)
            .at_points(self.point_ids(index, at))
            .with_fix(Fix::removing(label, deletes))
    }
}

/// The join `t` of the way from `a` to `b`.
fn blend(a: &Join, b: &Join, t: f64) -> Join {
    Join {
        incoming: a.incoming + (b.incoming - a.incoming) * t,
        outgoing: a.outgoing + (b.outgoing - a.outgoing) * t,
        ..*a
    }
}

#[cfg(test)]
mod tests {
    use crate::test_support::sample_variable_font;
    use crate::{Contour, Font, GlyphId, PointType};

    use super::super::{Check, Finding};

    type Spec<'a> = &'a [(f64, f64, bool, bool)];

    /// A contour from `(x, y, on_curve, smooth)` points.
    fn contour(points: Spec<'_>) -> Contour {
        let mut contour = Contour::new();
        for &(x, y, on, smooth) in points {
            let kind = if on {
                PointType::OnCurve
            } else {
                PointType::OffCurve
            };
            contour.add_point(x, y, kind, smooth);
        }
        contour.close();
        contour
    }

    /// The sample font with glyph `A` drawn as `specs`, one per master that has a layer.
    fn font_with(specs: &[Spec<'_>]) -> (Font, GlyphId) {
        let mut font = sample_variable_font();
        let glyph_id = font.glyph_id_by_name("A").unwrap();
        let order = font
            .sources()
            .iter()
            .map(crate::Source::id)
            .collect::<Vec<_>>();
        let mut glyph = font.pop_glyph(glyph_id).unwrap();
        let mut layer_ids = glyph
            .layers()
            .values()
            .filter_map(|layer| Some((layer.source_id()?, layer.id())))
            .collect::<Vec<_>>();
        layer_ids.sort_by_key(|(source, _)| order.iter().position(|s| s == source));
        assert_eq!(layer_ids.len(), specs.len(), "one spec per master layer");
        for ((_, layer_id), spec) in layer_ids.into_iter().zip(specs) {
            let layer = glyph.layer_mut(layer_id).unwrap();
            layer.clear_contours();
            layer.add_contour(contour(spec));
        }
        font.insert_glyph(glyph).unwrap();
        (font, glyph_id)
    }

    fn findings(font: &Font, glyph_id: GlyphId, check: Check) -> Vec<Finding> {
        font.check_glyph(glyph_id)
            .unwrap()
            .into_iter()
            .filter(|finding| finding.check == check)
            .collect()
    }

    /// Applies a finding's fix the way the editor does.
    fn apply(font: &mut Font, glyph_id: GlyphId, finding: &Finding) {
        let fix = finding.fix.as_ref().expect("the finding carries a fix");
        let mut glyph = font.pop_glyph(glyph_id).unwrap();
        for step in &fix.moves {
            let layer = glyph.layer_mut(step.layer_id).unwrap();
            let point = layer
                .contours_iter_mut()
                .find_map(|contour| contour.get_point_mut(&step.point_id))
                .unwrap();
            point.set_position(step.x, step.y);
        }
        for removal in &fix.removals {
            glyph
                .layer_mut(removal.layer_id)
                .unwrap()
                .delete_points(
                    std::slice::from_ref(&removal.point_id),
                    crate::DeleteMode::Fit,
                )
                .unwrap();
        }
        font.insert_glyph(glyph).unwrap();
    }

    fn position(font: &Font, glyph_id: GlyphId, master: usize, index: usize) -> (f64, f64) {
        let glyph = font.glyph(glyph_id).unwrap();
        let layer = font.masters_with_layers(glyph).nth(master).unwrap().1;
        let point = &layer.contours_iter().next().unwrap().points()[index];
        (point.x(), point.y())
    }

    /// The join at the end of the terminal of Visant Sans' a: smooth in
    /// ExtraLight (in 74, out 14) and ExtraBold (in 37, out 72), 15 degrees off at Regular.
    const A_LIGHT: Spec<'static> = &[
        (0.0, 0.0, true, false),
        (40.0, 200.0, false, false),
        (132.0, 526.0, false, false),
        (86.0, 468.0, true, true),
        (77.0, 457.0, false, false),
        (30.0, 300.0, false, false),
        (0.0, 250.0, true, false),
    ];
    const A_BOLD: Spec<'static> = &[
        (0.0, 0.0, true, false),
        (60.0, 220.0, false, false),
        (197.0, 548.0, false, false),
        (163.0, 534.0, true, true),
        (96.0, 507.0, false, false),
        (40.0, 320.0, false, false),
        (0.0, 280.0, true, false),
    ];

    #[test]
    fn finds_the_kink_between_masters_that_are_each_smooth() {
        let (font, glyph_id) = font_with(&[A_LIGHT, A_BOLD]);
        let kinks = findings(&font, glyph_id, Check::InterpolationKink);
        assert_eq!(kinks.len(), 1, "{kinks:#?}");
        assert!(
            kinks[0].message.contains("kinks by"),
            "{}",
            kinks[0].message
        );
        assert_eq!(kinks[0].points.len(), 2, "the point in both masters");
        assert!(findings(&font, glyph_id, Check::BrokenSmooth).is_empty());
    }

    #[test]
    fn dekinking_evens_out_the_handles_and_keeps_the_points() {
        let (mut font, glyph_id) = font_with(&[A_LIGHT, A_BOLD]);
        let kink = findings(&font, glyph_id, Check::InterpolationKink).remove(0);
        apply(&mut font, glyph_id, &kink);

        assert!(findings(&font, glyph_id, Check::InterpolationKink).is_empty());
        assert_eq!(position(&font, glyph_id, 0, 3), (86.0, 468.0));
        assert_eq!(position(&font, glyph_id, 1, 3), (163.0, 534.0));
        let ratio = |master| {
            let (p, a, b) = (
                position(&font, glyph_id, master, 3),
                position(&font, glyph_id, master, 2),
                position(&font, glyph_id, master, 4),
            );
            libm::hypot(p.0 - a.0, p.1 - a.1) / libm::hypot(b.0 - p.0, b.1 - p.1)
        };
        assert!(
            (ratio(0) - ratio(1)).abs() < 0.1,
            "{} vs {}",
            ratio(0),
            ratio(1)
        );
    }

    #[test]
    fn a_corner_almost_smooth_is_lined_up_without_moving_the_point() {
        // Handles 2 degrees off a line at (200, 200), long enough to tell from rounding.
        let spec: Spec<'_> = &[
            (0.0, 0.0, true, false),
            (100.0, 100.0, false, false),
            (100.0, 200.0, false, false),
            (200.0, 200.0, true, false),
            (300.0, 203.0, false, false),
            (300.0, 100.0, false, false),
            (400.0, 0.0, true, false),
        ];
        let (mut font, glyph_id) = font_with(&[spec, spec]);
        let found = findings(&font, glyph_id, Check::AlmostSmooth);
        assert_eq!(found.len(), 2, "one per master: {found:#?}");
        apply(&mut font, glyph_id, &found[0]);
        assert_eq!(position(&font, glyph_id, 0, 3), (200.0, 200.0));
        assert_eq!(findings(&font, glyph_id, Check::AlmostSmooth).len(), 1);
    }

    #[test]
    fn a_line_a_hair_off_horizontal_is_levelled() {
        let spec: Spec<'_> = &[
            (0.0, 0.0, true, false),
            (400.0, 3.0, true, false),
            (400.0, 600.0, true, false),
            (0.0, 600.0, true, false),
        ];
        let (mut font, glyph_id) = font_with(&[spec, spec]);
        let found = findings(&font, glyph_id, Check::NearAxisLine);
        assert_eq!(found.len(), 2, "{found:#?}");
        apply(&mut font, glyph_id, &found[0]);
        let (a, b) = (
            position(&font, glyph_id, 0, 0),
            position(&font, glyph_id, 0, 1),
        );
        assert!((a.1 - b.1).abs() < f64::EPSILON, "level after the fix");
    }

    #[test]
    fn a_point_in_the_middle_of_a_line_goes_only_when_every_master_agrees() {
        let straight: Spec<'_> = &[
            (0.0, 0.0, true, false),
            (200.0, 0.0, true, false),
            (400.0, 0.0, true, false),
            (400.0, 600.0, true, false),
            (0.0, 600.0, true, false),
        ];
        let bent: Spec<'_> = &[
            (0.0, 0.0, true, false),
            (200.0, 40.0, true, false),
            (400.0, 0.0, true, false),
            (400.0, 600.0, true, false),
            (0.0, 600.0, true, false),
        ];
        let (font, glyph_id) = font_with(&[straight, bent]);
        assert!(findings(&font, glyph_id, Check::RedundantPoint).is_empty());

        let (mut font, glyph_id) = font_with(&[straight, straight]);
        let found = findings(&font, glyph_id, Check::RedundantPoint);
        assert_eq!(found.len(), 1);
        assert_eq!(
            found[0].fix.as_ref().unwrap().removals.len(),
            2,
            "one per master"
        );
        apply(&mut font, glyph_id, &found[0]);
        assert!(findings(&font, glyph_id, Check::RedundantPoint).is_empty());
    }

    #[test]
    fn a_tilted_handle_away_from_an_extreme_is_the_design() {
        // The tangent at (200, 300) is 1 degree off vertical, but the curve keeps
        // going right across it: an inflection, not an extreme.
        let spec: Spec<'_> = &[
            (100.0, 0.0, true, false),
            (150.0, 100.0, false, false),
            (198.0, 200.0, false, false),
            (200.0, 300.0, true, true),
            (202.0, 400.0, false, false),
            (250.0, 500.0, false, false),
            (300.0, 600.0, true, false),
            (0.0, 600.0, true, false),
        ];
        let (font, glyph_id) = font_with(&[spec, spec]);
        assert!(findings(&font, glyph_id, Check::NearAxisHandle).is_empty());
    }

    #[test]
    fn an_ink_trap_closed_in_one_master_is_the_design() {
        // A handle on its point and a near-smooth corner in the closed master
        // that open into a clear trap in the other: no slip to report.
        let closed: Spec<'_> = &[
            (0.0, 0.0, true, false),
            (300.0, 0.0, true, false),
            (300.0, 0.0, false, false),
            (300.0, 200.0, false, false),
            (300.0, 400.0, true, false),
            (0.0, 400.0, true, false),
        ];
        let open: Spec<'_> = &[
            (0.0, 0.0, true, false),
            (300.0, 0.0, true, false),
            (340.0, 60.0, false, false),
            (300.0, 200.0, false, false),
            (300.0, 400.0, true, false),
            (0.0, 400.0, true, false),
        ];
        let (font, glyph_id) = font_with(&[closed, open]);
        for check in [
            Check::RetractedHandle,
            Check::AlmostSmooth,
            Check::BrokenSmooth,
        ] {
            assert!(findings(&font, glyph_id, check).is_empty(), "{check:?}");
        }
    }

    #[test]
    fn making_a_corner_smooth_lines_up_its_handles_and_keeps_the_point() {
        let spec: Spec<'_> = &[
            (0.0, 0.0, true, false),
            (100.0, 100.0, false, false),
            (100.0, 200.0, false, false),
            (200.0, 200.0, true, false),
            (300.0, 260.0, false, false),
            (300.0, 100.0, false, false),
            (400.0, 0.0, true, false),
        ];
        let (mut font, glyph_id) = font_with(&[spec, spec]);
        let mut glyph = font.pop_glyph(glyph_id).unwrap();
        let layer_id = *glyph.layers().keys().next().unwrap();
        let layer = glyph.layer_mut(layer_id).unwrap();
        let point_id = layer.contours_iter().next().unwrap().points()[3].id();
        assert!(layer.toggle_smooth(&point_id).unwrap());
        let points = layer.contours_iter().next().unwrap().points().to_vec();
        font.insert_glyph(glyph).unwrap();

        let (before, here, after) = (
            points[2].position(),
            points[3].position(),
            points[4].position(),
        );
        assert_eq!((here.x, here.y), (200.0, 200.0));
        let (incoming, outgoing) = (here - before, after - here);
        assert!(incoming.cross(outgoing).abs() < 1e-6, "handles in line");
        assert!(
            (incoming.hypot() - 100.0).abs() < 1e-6,
            "incoming keeps its length"
        );
        assert!((outgoing.hypot() - (100.0f64 * 100.0 + 60.0 * 60.0).sqrt()).abs() < 1e-6);
    }

    #[test]
    fn dekinking_never_lengthens_a_handle() {
        let (font, glyph_id) = font_with(&[A_LIGHT, A_BOLD]);
        let kink = findings(&font, glyph_id, Check::InterpolationKink).remove(0);
        let glyph = font.glyph(glyph_id).unwrap();
        for step in &kink.fix.unwrap().moves {
            let layer = glyph.layer(step.layer_id).unwrap();
            let contour = layer.contours_iter().next().unwrap();
            let at = contour.point_index(&step.point_id).unwrap();
            let point = contour.points()[at].position();
            let anchor = contour.points()[3].position();
            let before = point.distance(anchor);
            let after = kurbo::Point::new(step.x, step.y).distance(anchor);
            assert!(
                after <= before + 1.0,
                "handle grew from {before} to {after}"
            );
        }
    }

    #[test]
    fn rounding_a_square_corner_draws_a_quarter_circle() {
        let square: Spec<'_> = &[
            (0.0, 0.0, true, false),
            (400.0, 0.0, true, false),
            (400.0, 400.0, true, false),
            (0.0, 400.0, true, false),
        ];
        let (mut font, glyph_id) = font_with(&[square, square]);
        let mut glyph = font.pop_glyph(glyph_id).unwrap();
        let layer_id = *glyph.layers().keys().next().unwrap();
        let layer = glyph.layer_mut(layer_id).unwrap();
        let corner = layer.contours_iter().next().unwrap().points()[1].id();
        let end = crate::PointId::new();
        assert!(layer.round_corner(&corner, 40.0, end.clone()).unwrap());
        let points = layer.contours_iter().next().unwrap().points().to_vec();
        font.insert_glyph(glyph).unwrap();

        let at = |k: usize| (points[k].x().round(), points[k].y().round());
        assert_eq!(
            points.len(),
            7,
            "the corner became an arc: one point, two handles"
        );
        assert_eq!(at(1), (360.0, 0.0), "the arc starts 40 before the corner");
        assert_eq!(at(4), (400.0, 40.0), "and ends 40 after it");
        assert_eq!(points[4].id(), end);
        // A quarter circle's handles are 0.5523 of its radius.
        assert!((points[2].x() - (360.0 + 40.0 * 0.5523)).abs() < 0.05);
        assert!((points[3].y() - (40.0 - 40.0 * 0.5523)).abs() < 0.05);
        assert!(points[1].is_smooth() && points[4].is_smooth());

        // A smooth point is no corner: nothing changes.
        let mut glyph = font.pop_glyph(glyph_id).unwrap();
        let layer = glyph.layer_mut(layer_id).unwrap();
        let smooth = layer.contours_iter().next().unwrap().points()[1].id();
        assert!(
            !layer
                .round_corner(&smooth, 40.0, crate::PointId::new())
                .unwrap()
        );
        font.insert_glyph(glyph).unwrap();
    }
}
