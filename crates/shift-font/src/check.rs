//! Font checks: problems in sources that make a font build, interpolate, or
//! kern differently from what the designer drew.
//!
//! Checks read an immutable [`Font`] and never change it. Each [`Finding`]
//! names a [`Check`] with a stable code, the glyph and source it concerns
//! when there is one, and a message written for a type designer.
//!
//! The editor runs [`Font::check_glyph`] on the glyph being edited; command-line
//! and CI callers run [`Font::check`] over a whole source.

use serde::Serialize;

use crate::{CoreResult, Font, GlyphId, LayerId, PointId, SourceId};

mod coverage;
mod craft;
mod designspace;
mod health;
mod kerning;
mod outline;
mod polygon;
mod roles;
mod swaps;

pub use coverage::Charset;
pub use craft::CraftThresholds;
pub use outline::OutlineThresholds;

/// Opt-in checks for one run.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct CheckOptions {
    /// Characters every master must map and draw.
    pub charset: Option<Charset>,
    /// Checks the font as monospaced against this cell width.
    pub monospace: Option<MonospaceCell>,
}

/// The width a monospace check expects every advance to have.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum MonospaceCell {
    /// One width for every master.
    Width(f64),
    /// Each master's most common advance.
    MostCommonAdvance,
}

impl MonospaceCell {
    /// The fixed width, when one was given.
    pub fn width(self) -> Option<f64> {
        match self {
            Self::Width(width) => Some(width),
            Self::MostCommonAdvance => None,
        }
    }
}

/// How much a finding matters.
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Severity {
    /// The font builds, but may not do what was intended.
    Warning,
    /// The font fails to build, or a glyph renders wrongly at some location.
    Error,
}

/// One kind of problem, with a stable code.
///
/// Codes group by subject: `D` axes and masters, `I` interpolation, `O`
/// outlines, `A` swaps and component conditions, `K` kerning, `C` character set, `M` monospace.
#[derive(Clone, Copy, Debug, Eq, Hash, Ord, PartialEq, PartialOrd, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Check {
    /// No master sits at the default location of every axis.
    NoDefaultMaster,
    /// Two masters sit at the same location.
    DuplicateMasterLocation,
    /// A master sits outside the range of an axis.
    MasterOutsideAxis,
    /// An axis mapping turns back on itself, so two values map to the same place.
    MappingNotMonotonic,
    /// An axis runs past its last master, so the font stops changing there.
    AxisBeyondMasters,
    /// A glyph has layers in some masters but none in the default master.
    MissingDefaultLayer,
    /// A master's layer doesn't match the default master's structure.
    IncompatibleMaster,
    /// A master uses components where another draws outlines, or different
    /// components; the decomposed outlines match.
    MixedComponents,
    /// A glyph with compatible layers in several masters can't be interpolated.
    NotInterpolatable,
    /// A contour starts at a different point in one master.
    WrongStartPoint,
    /// A contour runs the opposite direction in one master.
    WrongContourDirection,
    /// Two contours are in a different order in one master.
    WrongContourOrder,
    /// A contour turns inside out between two masters.
    ContourInsideOut,
    /// A contour of two or more points is open, so it won't fill.
    OpenContour,
    /// A closed contour has fewer than three points, so it draws nothing.
    DegenerateContour,
    /// A point's coordinate isn't a number.
    NonFinitePoint,
    /// An advance width is negative, not a number, or zero for a spacing glyph.
    InvalidAdvance,
    /// A contour lies wholly inside another and winds the same way, so it adds
    /// nothing: a hole drawn the wrong way, or a redundant shape.
    ContourDirection,
    /// An encoded glyph draws nothing in the default master.
    EmptyOutline,
    /// A curve bulges past its own ends horizontally or vertically with no
    /// point there, which hinting, rasterizing and interpolation all prefer.
    MissingExtreme,
    /// A point sits within two units of a vertical metric (baseline, x-height,
    /// cap height and so on) without sitting on it: almost aligned.
    PointOffMetric,
    /// A mirrored component sits beside parts that aren't mirrored, so its
    /// contours run the other way: kept as a composite, the overlap cancels
    /// into a hole. Export decomposes such a glyph, reversing what the mirror
    /// reversed; other compilers may not.
    MirroredComponent,
    /// A glyph can't be drawn, for example because of a component cycle.
    UnresolvedGlyph,
    /// A swap never wins anywhere on the font's axes: its condition
    /// holds nowhere in their ranges, or earlier swaps already apply
    /// wherever it does.
    NeverUsedSwap,
    /// A component carries a condition, which compiled fonts can't hold
    /// yet, so the font can't be exported.
    ComponentConditionNotExported,
    /// The font has swaps and its feature code writes its own `variation
    /// rvrn` block: compiled fonts apply only one `rvrn` record at a
    /// location, so where both hold, one of them is silently lost.
    SwapsBesideFeatureRvrn,
    /// A kerning group has no members, so its pairs do nothing.
    EmptyKerningGroup,
    /// A pair names a glyph or group that isn't in the font, or a group on the wrong side, so it never applies.
    UnresolvedKerning,
    /// The font doesn't map a character of the required character set.
    CharsetMissingGlyph,
    /// A required character's glyph has no layer in a master.
    CharsetMissingLayer,
    /// A glyph's advance differs from the monospace cell width.
    MonoWidthMismatch,
    /// A glyph's ink is wider than its monospace cell.
    MonoInkOverflow,
    /// Between two masters, a smooth point's handles leave a line: each master
    /// is smooth, but its handles keep different proportions.
    InterpolationKink,
    /// A point marked smooth whose handles don't line up, so the curve breaks.
    BrokenSmooth,
    /// A corner only a few degrees from smooth: a smooth point drawn slightly off.
    AlmostSmooth,
    /// A handle drawn onto its own point, or a curve whose handles both are.
    RetractedHandle,
    /// A segment too short to see in every master.
    ShortSegment,
    /// A line a hair off horizontal, vertical or the italic angle.
    NearAxisLine,
    /// A handle a hair off horizontal, vertical or the italic angle.
    NearAxisHandle,
    /// An on-curve point in the middle of a straight line in every master.
    RedundantPoint,
}

impl Check {
    /// Every check, in code order.
    pub const ALL: [Self; 40] = [
        Self::NoDefaultMaster,
        Self::DuplicateMasterLocation,
        Self::MasterOutsideAxis,
        Self::MappingNotMonotonic,
        Self::AxisBeyondMasters,
        Self::MissingDefaultLayer,
        Self::IncompatibleMaster,
        Self::MixedComponents,
        Self::NotInterpolatable,
        Self::WrongStartPoint,
        Self::WrongContourDirection,
        Self::WrongContourOrder,
        Self::ContourInsideOut,
        Self::OpenContour,
        Self::DegenerateContour,
        Self::NonFinitePoint,
        Self::InvalidAdvance,
        Self::ContourDirection,
        Self::EmptyOutline,
        Self::MissingExtreme,
        Self::PointOffMetric,
        Self::MirroredComponent,
        Self::UnresolvedGlyph,
        Self::NeverUsedSwap,
        Self::ComponentConditionNotExported,
        Self::SwapsBesideFeatureRvrn,
        Self::EmptyKerningGroup,
        Self::UnresolvedKerning,
        Self::CharsetMissingGlyph,
        Self::CharsetMissingLayer,
        Self::MonoWidthMismatch,
        Self::MonoInkOverflow,
        Self::InterpolationKink,
        Self::BrokenSmooth,
        Self::AlmostSmooth,
        Self::RetractedHandle,
        Self::ShortSegment,
        Self::NearAxisLine,
        Self::NearAxisHandle,
        Self::RedundantPoint,
    ];

    /// Returns the stable code, such as `D001`.
    pub fn code(self) -> &'static str {
        self.describe().0
    }

    /// Returns the kebab-case name, such as `wrong-start-point`.
    pub fn name(self) -> &'static str {
        self.describe().1
    }

    /// Returns how much a finding of this kind matters.
    pub fn severity(self) -> Severity {
        self.describe().2
    }

    fn describe(self) -> (&'static str, &'static str, Severity) {
        match self {
            Self::NoDefaultMaster => ("D001", "no-default-master", Severity::Error),
            Self::DuplicateMasterLocation => ("D002", "duplicate-master-location", Severity::Error),
            Self::MasterOutsideAxis => ("D003", "master-outside-axis", Severity::Error),
            Self::MappingNotMonotonic => ("D004", "mapping-not-monotonic", Severity::Error),
            Self::AxisBeyondMasters => ("D005", "axis-beyond-masters", Severity::Warning),
            Self::MissingDefaultLayer => ("I001", "missing-default-layer", Severity::Error),
            Self::IncompatibleMaster => ("I002", "incompatible-master", Severity::Error),
            Self::MixedComponents => ("I008", "mixed-components", Severity::Warning),
            Self::NotInterpolatable => ("I003", "not-interpolatable", Severity::Warning),
            Self::WrongStartPoint => ("I004", "wrong-start-point", Severity::Error),
            Self::WrongContourDirection => ("I005", "wrong-contour-direction", Severity::Error),
            Self::WrongContourOrder => ("I006", "wrong-contour-order", Severity::Error),
            Self::ContourInsideOut => ("I007", "contour-inside-out", Severity::Error),
            Self::OpenContour => ("O001", "open-contour", Severity::Warning),
            Self::DegenerateContour => ("O002", "degenerate-contour", Severity::Warning),
            Self::NonFinitePoint => ("O003", "non-finite-point", Severity::Error),
            Self::InvalidAdvance => ("O004", "invalid-advance", Severity::Error),
            Self::ContourDirection => ("O005", "contour-direction", Severity::Warning),
            Self::EmptyOutline => ("O006", "empty-outline", Severity::Error),
            Self::UnresolvedGlyph => ("O007", "unresolved-glyph", Severity::Error),
            Self::MissingExtreme => ("O008", "missing-extreme", Severity::Warning),
            Self::PointOffMetric => ("O009", "point-off-metric", Severity::Warning),
            Self::MirroredComponent => ("O010", "mirrored-component", Severity::Warning),
            Self::NeverUsedSwap => ("A001", "never-used-swap", Severity::Warning),
            Self::ComponentConditionNotExported => (
                "A002",
                "component-condition-not-exported",
                Severity::Warning,
            ),
            Self::SwapsBesideFeatureRvrn => {
                ("A003", "swaps-beside-feature-rvrn", Severity::Warning)
            }
            Self::EmptyKerningGroup => ("K001", "empty-kerning-group", Severity::Warning),
            Self::UnresolvedKerning => ("K002", "unresolved-kerning", Severity::Warning),
            Self::CharsetMissingGlyph => ("C001", "charset-missing-glyph", Severity::Error),
            Self::CharsetMissingLayer => ("C002", "charset-missing-layer", Severity::Error),
            Self::MonoWidthMismatch => ("M001", "mono-width-mismatch", Severity::Error),
            Self::MonoInkOverflow => ("M002", "mono-ink-overflow", Severity::Warning),
            Self::InterpolationKink => ("I009", "interpolation-kink", Severity::Warning),
            Self::BrokenSmooth => ("O011", "broken-smooth", Severity::Warning),
            Self::AlmostSmooth => ("O012", "almost-smooth", Severity::Warning),
            Self::RetractedHandle => ("O013", "retracted-handle", Severity::Warning),
            Self::ShortSegment => ("O014", "short-segment", Severity::Warning),
            Self::NearAxisLine => ("O015", "near-axis-line", Severity::Warning),
            Self::NearAxisHandle => ("O016", "near-axis-handle", Severity::Warning),
            Self::RedundantPoint => ("O017", "redundant-point", Severity::Warning),
        }
    }
}

/// One problem found in a font.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Finding {
    pub check: Check,
    /// The glyph concerned, when the problem is in one glyph.
    pub glyph: Option<GlyphId>,
    /// The master concerned, when the problem is in one master.
    pub source: Option<SourceId>,
    /// Zero-based contour index, when the problem is in one contour.
    pub contour: Option<usize>,
    /// The points the problem sits at, in every layer it concerns: what an
    /// editor marks on the layer it shows.
    pub points: Vec<PointId>,
    pub message: String,
    /// The edit that resolves the problem, when one can be computed.
    pub fix: Option<Fix>,
}

/// An edit that resolves a finding: points to move and points to remove, in
/// any of the glyph's layers. Applied together, as one step.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Fix {
    /// What the fix does, as a menu would say it: `Line up handles`.
    pub label: String,
    pub moves: Vec<PointMove>,
    /// Removed with the curve fitted across the gap, as Delete does.
    pub removals: Vec<PointRemoval>,
}

impl Fix {
    fn new(label: &str, moves: Vec<PointMove>) -> Self {
        Self {
            label: label.to_owned(),
            moves,
            removals: Vec::new(),
        }
    }

    fn removing(label: &str, removals: Vec<PointRemoval>) -> Self {
        Self {
            label: label.to_owned(),
            moves: Vec::new(),
            removals,
        }
    }
}

/// A point a [`Fix`] moves, to an absolute position in its layer.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PointMove {
    pub layer_id: LayerId,
    pub point_id: PointId,
    pub x: f64,
    pub y: f64,
}

/// A point a [`Fix`] removes from its layer.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PointRemoval {
    pub layer_id: LayerId,
    pub point_id: PointId,
}

impl Finding {
    fn font(check: Check, message: impl Into<String>) -> Self {
        Self {
            check,
            glyph: None,
            source: None,
            contour: None,
            points: Vec::new(),
            message: message.into(),
            fix: None,
        }
    }

    fn glyph(check: Check, glyph: GlyphId, message: impl Into<String>) -> Self {
        Self {
            glyph: Some(glyph),
            ..Self::font(check, message)
        }
    }

    fn in_source(mut self, source: SourceId) -> Self {
        self.source = Some(source);
        self
    }

    fn in_contour(mut self, contour: usize) -> Self {
        self.contour = Some(contour);
        self
    }

    fn at_points(mut self, points: Vec<PointId>) -> Self {
        self.points = points;
        self
    }

    fn with_fix(mut self, fix: Fix) -> Self {
        self.fix = Some(fix);
        self
    }
}

impl Font {
    /// Runs every check over the font.
    ///
    /// Findings come in a stable order: font-wide problems first, then glyphs in
    /// font order, then kerning and the opt-in checks.
    ///
    /// # Errors
    ///
    /// Returns an axis-mapping error when an authored mapping cannot compile.
    pub fn check(&self) -> CoreResult<Vec<Finding>> {
        self.check_with(&CheckOptions::default())
    }

    /// Runs every check over the font, plus the opt-in checks in `options`.
    ///
    /// # Errors
    ///
    /// Returns an axis-mapping error when an authored mapping cannot compile.
    pub fn check_with(&self, options: &CheckOptions) -> CoreResult<Vec<Finding>> {
        let mut findings = designspace::check(self)?;
        let thresholds = OutlineThresholds::default();
        for glyph in self.glyphs() {
            findings.extend(health::check(self, glyph));
            findings.extend(outline::check(self, glyph.id(), &thresholds)?);
            findings.extend(craft::check(self, glyph, &CraftThresholds::default()));
            findings.extend(self.never_used_swap_findings(glyph)?);
            findings.extend(glyph.component_condition_findings());
        }
        findings.extend(self.feature_rvrn_findings());
        findings.extend(kerning::check(self));
        if let Some(charset) = &options.charset {
            findings.extend(coverage::charset(self, charset));
        }
        if let Some(cell) = options.monospace {
            findings.extend(coverage::monospace(self, cell));
        }
        Ok(findings)
    }

    /// Runs the checks that concern one glyph.
    ///
    /// This is cheap enough to run after every edit of that glyph.
    ///
    /// # Errors
    ///
    /// Returns [`crate::CoreError::GlyphNotFound`] when `glyph_id` is not in the
    /// font, or an axis-mapping error when an authored mapping cannot compile.
    pub fn check_glyph(&self, glyph_id: GlyphId) -> CoreResult<Vec<Finding>> {
        let glyph = self.require_glyph(glyph_id)?;
        let mut findings = health::check(self, glyph);
        findings.extend(outline::check(
            self,
            glyph_id,
            &OutlineThresholds::default(),
        )?);
        findings.extend(craft::check(self, glyph, &CraftThresholds::default()));
        findings.extend(self.never_used_swap_findings(glyph)?);
        findings.extend(glyph.component_condition_findings());
        Ok(findings)
    }
}

#[cfg(test)]
mod tests;
