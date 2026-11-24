use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use fontdrasil::coords::NormalizedLocation;
use fontdrasil::orchestration::{Access, Work};
use fontdrasil::types::{Axes, Tag};
use fontir::error::Error;
use fontir::ir::{
    DEFAULT_VENDOR_ID, FeatureSources, FeaturesSource, FilterScope, GlobalMetric,
    GlobalMetricsBuilder, GlyphOrder, NameBuilder, PreliminaryGdefCategories, StaticMetadata,
};
use fontir::orchestration::{Context, Flags, WorkId};
use shift_font::{Source, SourceList, StandardMetrics};
use write_fonts::types::NameId;

use super::axes::{normalized_source_location, to_ir_named_instances};
use super::source::ShiftSnapshot;
use super::stat::generated_stat_fea;
use crate::export::postscript_safe;

/// Establishes axes, global master locations, names, and preliminary glyph order.
///
/// Authored named instances lower from external locations; source names never
/// become products implicitly. The default source must be a master at the
/// normalized default location, and masters must occupy distinct locations.
#[derive(Debug)]
pub(super) struct StaticMetadataWork {
    snapshot: Arc<ShiftSnapshot>,
}

impl StaticMetadataWork {
    pub(super) fn new(snapshot: Arc<ShiftSnapshot>) -> Self {
        Self { snapshot }
    }
}

impl Work<Context, WorkId, Error> for StaticMetadataWork {
    fn id(&self) -> WorkId {
        WorkId::StaticMetadata
    }

    fn also_completes(&self) -> Vec<WorkId> {
        vec![
            WorkId::PreliminaryGlyphOrder,
            WorkId::PreliminaryGdefCategories,
        ]
    }

    fn exec(&self, context: &Context) -> Result<(), Error> {
        let metadata = &self.snapshot.metadata;
        let mut names = NameBuilder::default();
        let version_major = metadata.version_major.unwrap_or_default();
        let version_minor = metadata
            .version_minor
            .unwrap_or_default()
            .try_into()
            .unwrap_or_default();

        names.set_version(version_major, version_minor);
        names.add_if_present(NameId::COPYRIGHT_NOTICE, &metadata.copyright);
        names.add_if_present(NameId::TRADEMARK, &metadata.trademark);
        names.add_if_present(NameId::MANUFACTURER, &metadata.manufacturer);
        names.add_if_present(NameId::DESIGNER, &metadata.designer);
        names.add_if_present(NameId::DESCRIPTION, &metadata.description);
        names.add_if_present(NameId::VENDOR_URL, &metadata.manufacturer_url);
        names.add_if_present(NameId::DESIGNER_URL, &metadata.designer_url);
        names.add_if_present(NameId::LICENSE_DESCRIPTION, &metadata.license);
        names.add_if_present(NameId::LICENSE_URL, &metadata.license_url);
        names.add_if_present(NameId::TYPOGRAPHIC_FAMILY_NAME, &metadata.family_name);
        names.add_if_present(NameId::TYPOGRAPHIC_SUBFAMILY_NAME, &metadata.style_name);
        // A variable font names its instances' PostScript names after the
        // family, as fontmake builds with gftools write them.
        if !self.snapshot.ir_axes.is_empty()
            && let Some(family) = metadata.family_name.as_deref()
        {
            names.add(
                NameId::VARIATIONS_POSTSCRIPT_NAME_PREFIX,
                postscript_safe(family),
            );
        }
        let fontinfo = &self.snapshot.fontinfo;
        let vendor_id = fontinfo.vendor_id.as_deref().unwrap_or(DEFAULT_VENDOR_ID);

        let ir_axes = Axes::from(self.snapshot.ir_axes.clone());
        let global_locations = self.global_locations(&ir_axes)?;
        let named_instances =
            to_ir_named_instances(&self.snapshot.named_instances, &self.snapshot.axes)
                .map_err(|error| Error::InvalidEntry("Shift named instance", error.to_string()))?;
        // With VARC, glyph axes are hidden fvar axes the variable components
        // set; without it, fontc decomposes those components and drops them.
        let mut fvar_axes = self.snapshot.ir_axes.clone();
        if context.flags.contains(Flags::EMIT_VARC_TABLE) {
            fvar_axes.extend(self.snapshot.hidden_axes.fvar_axes());
        }
        let mut static_metadata = StaticMetadata::new(
            self.snapshot.units_per_em,
            names.build(vendor_id),
            fvar_axes,
            named_instances,
            global_locations,
            None,
            self.default_source()?.italic_angle().unwrap_or_default(),
            None,
            false,
        )?;
        static_metadata.glyph_axes = self.snapshot.hidden_axes.by_glyph_name();
        static_metadata
            .variations
            .clone_from(&self.snapshot.feature_variations);
        static_metadata.misc.version_major = version_major;
        static_metadata.misc.version_minor = version_minor;
        static_metadata.misc.selection_flags = fontinfo.selection_flags;
        static_metadata.misc.gasp.clone_from(&fontinfo.gasp);
        if let Ok(vendor) = Tag::new_checked(vendor_id.as_bytes()) {
            static_metadata.misc.vendor_id = vendor;
        }
        // A mirrored component beside unmirrored parts runs against them;
        // decomposed, fontc reverses what the mirror reversed.
        if !self.snapshot.mixed_mirror_glyphs.is_empty() {
            static_metadata.misc.decompose_components = Some(FilterScope::Include(
                self.snapshot
                    .mixed_mirror_glyphs
                    .iter()
                    .map(|name| name.as_str().into())
                    .collect(),
            ));
        }

        let mut glyph_order = GlyphOrder::new();
        for glyph in &self.snapshot.glyphs {
            glyph_order.insert(glyph.name().into());
        }

        context.preliminary_glyph_order.set(glyph_order);
        context
            .preliminary_gdef_categories
            .set(PreliminaryGdefCategories {
                categories: self
                    .snapshot
                    .gdef_classes
                    .iter()
                    .map(|(name, class)| (name.as_str().into(), *class))
                    .collect(),
                // Classes are already final: marks by category, bases and
                // ligatures inferred from anchors in `gdef_classes`.
                infer_from_anchors: false,
                // Shift excludes no glyphs from GDEF classes.
                excluded: Default::default(),
                mark_category_glyphs: self
                    .snapshot
                    .mark_category_glyphs
                    .iter()
                    .map(|name| name.as_str().into())
                    .collect(),
            });
        context.static_metadata.set(static_metadata);
        Ok(())
    }
}

impl StaticMetadataWork {
    fn default_source(&self) -> Result<&Source, Error> {
        self.snapshot
            .sources
            .source(self.snapshot.default_source_id)
            .ok_or_else(|| {
                Error::InvalidEntry(
                    "Shift default source",
                    "the default source does not exist".to_string(),
                )
            })
    }

    fn global_locations(&self, axes: &Axes) -> Result<HashSet<NormalizedLocation>, Error> {
        if axes.is_empty() {
            return Ok(HashSet::from([NormalizedLocation::default()]));
        }

        let mut locations = HashMap::new();
        let mut found_default_source = false;
        for source in self
            .snapshot
            .sources
            .iter()
            .filter(|source| source.is_master())
        {
            let location = normalized_source_location(source, &self.snapshot.axes, axes)?;
            if source.id() == self.snapshot.default_source_id {
                found_default_source = true;
                if !location.is_default() {
                    return Err(Error::InvalidEntry(
                        "Shift default source",
                        format!(
                            "'{}' must be at the default location, got {location:?}",
                            source.name()
                        ),
                    ));
                }
            }

            if let Some(existing) = locations.insert(location, source.name()) {
                return Err(Error::InvalidEntry(
                    "Shift source location",
                    format!(
                        "master sources '{}' and '{}' have the same normalized location",
                        existing,
                        source.name()
                    ),
                ));
            }
        }

        if !found_default_source {
            return Err(Error::InvalidEntry(
                "Shift default source",
                "the default source is not a master source".to_string(),
            ));
        }

        Ok(locations.into_keys().collect())
    }
}

/// Emits each master's standard source-local metrics at its normalized location.
///
/// Custom metric rows and overshoots remain Shift authoring data because OpenType
/// global metrics do not define a general-purpose representation for them.
#[derive(Debug)]
pub(super) struct GlobalMetricsWork {
    snapshot: Arc<ShiftSnapshot>,
}

impl GlobalMetricsWork {
    pub(super) fn new(snapshot: Arc<ShiftSnapshot>) -> Self {
        Self { snapshot }
    }
}

impl Work<Context, WorkId, Error> for GlobalMetricsWork {
    fn id(&self) -> WorkId {
        WorkId::GlobalMetrics
    }

    fn read_access(&self) -> Access<WorkId> {
        Access::Variant(WorkId::StaticMetadata)
    }

    fn exec(&self, context: &Context) -> Result<(), Error> {
        let metadata = context.static_metadata.get();
        let axes = &metadata.all_source_axes;
        let mut metrics = GlobalMetricsBuilder::new();

        for source in self
            .snapshot
            .sources
            .iter()
            .filter(|source| source.is_master())
        {
            let location = normalized_source_location(source, &self.snapshot.axes, axes)?;
            let standard = StandardMetrics::of(source, &self.snapshot.metric_definitions);

            metrics.set_if_some(GlobalMetric::Ascender, location.clone(), standard.ascender);
            metrics.set_if_some(
                GlobalMetric::Descender,
                location.clone(),
                standard.descender,
            );
            metrics.set_if_some(
                GlobalMetric::CapHeight,
                location.clone(),
                standard.cap_height,
            );
            metrics.set_if_some(GlobalMetric::XHeight, location.clone(), standard.x_height);
            metrics.set_if_some(
                GlobalMetric::HheaLineGap,
                location.clone(),
                source.line_gap(),
            );
            metrics.set_if_some(
                GlobalMetric::Os2TypoLineGap,
                location.clone(),
                source.line_gap(),
            );
            metrics.set_if_some(
                GlobalMetric::UnderlinePosition,
                location.clone(),
                source.underline_position(),
            );
            metrics.set_if_some(
                GlobalMetric::UnderlineThickness,
                location.clone(),
                source.underline_thickness(),
            );
            metrics.populate_defaults(
                &location,
                metadata.units_per_em,
                standard.x_height,
                standard.ascender,
                standard.descender,
                source.italic_angle(),
            );
        }

        context.global_metrics.set(metrics.build(&metadata.axes)?);
        Ok(())
    }
}

/// Combines authored feature text with `STAT` syntax generated from axis labels.
#[derive(Debug)]
pub(super) struct FeatureWork {
    snapshot: Arc<ShiftSnapshot>,
}

impl FeatureWork {
    pub(super) fn new(snapshot: Arc<ShiftSnapshot>) -> Self {
        Self { snapshot }
    }
}

impl Work<Context, WorkId, Error> for FeatureWork {
    fn id(&self) -> WorkId {
        WorkId::Features
    }

    fn exec(&self, context: &Context) -> Result<(), Error> {
        let authored = self.snapshot.features.fea_source().unwrap_or_default();
        let generated_stat = generated_stat_fea(&self.snapshot.axes)
            .map_err(|message| Error::InvalidEntry("Shift axis labels", message))?;

        let features = match generated_stat {
            Some(stat) if authored.trim().is_empty() => FeaturesSource::from_string(stat),
            Some(stat) => FeaturesSource::from_string(format!("{authored}\n\n{stat}")),
            None if authored.trim().is_empty() => FeaturesSource::empty(),
            None => FeaturesSource::from_string(authored.to_string()),
        };
        context.features.set(FeatureSources::single(features));
        Ok(())
    }
}

#[derive(Debug)]
pub(super) struct ColorPaletteWork;

impl Work<Context, WorkId, Error> for ColorPaletteWork {
    fn id(&self) -> WorkId {
        WorkId::ColorPalettes
    }

    fn exec(&self, _context: &Context) -> Result<(), Error> {
        Ok(())
    }
}

#[derive(Debug)]
pub(super) struct ColorGlyphsWork;

impl Work<Context, WorkId, Error> for ColorGlyphsWork {
    fn id(&self) -> WorkId {
        WorkId::PaintGraph
    }

    fn exec(&self, _context: &Context) -> Result<(), Error> {
        Ok(())
    }
}
