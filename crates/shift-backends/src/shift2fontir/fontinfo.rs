//! The binary table values a UFO `fontinfo.plist` sets beyond what Shift
//! models: `OS/2` selection flags and vendor, and the `gasp` ranges. They
//! travel in the font's fontinfo remainder and are read as ufo2fontir (and
//! fontmake) read them.

use fontdrasil::types::Tag;
use shift_font::{LibData, LibValue};
use write_fonts::read::tables::gasp::GaspRangeBehavior;
use write_fonts::tables::gasp::GaspRange;
use write_fonts::tables::os2::SelectionFlags;

/// `OS/2` and `gasp` values a compile takes from the fontinfo remainder.
#[derive(Clone, Debug, PartialEq)]
pub(super) struct FontinfoTables {
    /// `OS/2.fsSelection`: the source's explicit bits with the style bits
    /// its style implies.
    pub selection_flags: SelectionFlags,
    /// `OS/2.achVendID`, when the source names one.
    pub vendor_id: Option<String>,
    /// `gasp` ranges, the source's own or one range asking every renderer
    /// to grid-fit and smooth at every size, as an unhinted font wants.
    pub gasp: Vec<GaspRange>,
}

impl FontinfoTables {
    /// Reads `fontinfo`, styling the default instance as `style_name`.
    ///
    /// `fsSelection` is `openTypeOS2Selection`'s bits (so `USE_TYPO_METRICS`
    /// survives) together with `BOLD`, `ITALIC` or `REGULAR` from
    /// `styleMapStyleName`, else from the preferred subfamily or style name
    /// when it is one of the four style-map styles, else `REGULAR`, as
    /// ufo2ft falls back.
    pub(super) fn read(fontinfo: &LibData, style_name: Option<&str>) -> Self {
        Self {
            selection_flags: explicit_selection(fontinfo) | implied_selection(fontinfo, style_name),
            vendor_id: fontinfo
                .get("openTypeOS2VendorID")
                .and_then(lib_string)
                .filter(|vendor| Tag::new_checked(vendor.as_bytes()).is_ok())
                .map(str::to_string),
            gasp: gasp_ranges(fontinfo).unwrap_or_else(unhinted_gasp),
        }
    }
}

fn lib_string(value: &LibValue) -> Option<&str> {
    match value {
        LibValue::String(text) => Some(text),
        _ => None,
    }
}

fn lib_integers(value: &LibValue) -> Option<Vec<i64>> {
    match value {
        LibValue::Array(items) => items.iter().map(LibValue::as_i64).collect(),
        _ => None,
    }
}

/// The bits `openTypeOS2Selection` lists; a malformed list sets none.
fn explicit_selection(fontinfo: &LibData) -> SelectionFlags {
    fontinfo
        .get("openTypeOS2Selection")
        .and_then(lib_integers)
        .unwrap_or_default()
        .into_iter()
        .filter_map(|bit| u32::try_from(bit).ok().filter(|bit| *bit < 16))
        .fold(SelectionFlags::empty(), |flags, bit| {
            flags | SelectionFlags::from_bits_truncate(1 << bit)
        })
}

fn implied_selection(fontinfo: &LibData, style_name: Option<&str>) -> SelectionFlags {
    let style = fontinfo
        .get("styleMapStyleName")
        .and_then(lib_string)
        .or_else(|| {
            fontinfo
                .get("openTypeNamePreferredSubfamilyName")
                .and_then(lib_string)
        })
        .or(style_name)
        .map(|style| style.trim().to_lowercase());
    match style.as_deref() {
        Some("bold") => SelectionFlags::BOLD,
        Some("italic") => SelectionFlags::ITALIC,
        Some("bold italic") => SelectionFlags::BOLD | SelectionFlags::ITALIC,
        _ => SelectionFlags::REGULAR,
    }
}

/// `openTypeGaspRangeRecords`, or `None` when the source sets none.
fn gasp_ranges(fontinfo: &LibData) -> Option<Vec<GaspRange>> {
    let LibValue::Array(records) = fontinfo.get("openTypeGaspRangeRecords")? else {
        return None;
    };
    let ranges: Vec<GaspRange> = records
        .iter()
        .filter_map(|record| {
            let LibValue::Dict(record) = record else {
                return None;
            };
            let max_ppem = u16::try_from(record.get("rangeMaxPPEM")?.as_i64()?).ok()?;
            let behavior = lib_integers(record.get("rangeGaspBehavior")?)?
                .into_iter()
                .filter_map(|bit| u32::try_from(bit).ok().filter(|bit| *bit < 16))
                .fold(0u16, |bits, bit| bits | (1 << bit));
            Some(GaspRange {
                range_max_ppem: max_ppem,
                range_gasp_behavior: GaspRangeBehavior::from_bits_truncate(behavior),
            })
        })
        .collect();
    (!ranges.is_empty()).then_some(ranges)
}

/// One range up to the largest size with every behavior on, as gftools gives
/// a font without hinting.
fn unhinted_gasp() -> Vec<GaspRange> {
    vec![GaspRange {
        range_max_ppem: u16::MAX,
        range_gasp_behavior: GaspRangeBehavior::GASP_GRIDFIT
            | GaspRangeBehavior::GASP_DOGRAY
            | GaspRangeBehavior::GASP_SYMMETRIC_GRIDFIT
            | GaspRangeBehavior::GASP_SYMMETRIC_SMOOTHING,
    }]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fontinfo(entries: Vec<(&str, LibValue)>) -> LibData {
        LibData::from_map(
            entries
                .into_iter()
                .map(|(key, value)| (key.to_string(), value)),
        )
    }

    #[test]
    fn use_typo_metrics_survives_beside_the_implied_regular_bit() {
        let info = fontinfo(vec![(
            "openTypeOS2Selection",
            LibValue::Array(vec![LibValue::Integer(7)]),
        )]);

        let tables = FontinfoTables::read(&info, Some("ExtraLight"));

        assert_eq!(
            tables.selection_flags,
            SelectionFlags::USE_TYPO_METRICS | SelectionFlags::REGULAR
        );
    }

    #[test]
    fn the_style_map_style_wins_over_the_style_name() {
        let info = fontinfo(vec![(
            "styleMapStyleName",
            LibValue::String("bold italic".to_string()),
        )]);

        let tables = FontinfoTables::read(&info, Some("Black Italic"));

        assert_eq!(
            tables.selection_flags,
            SelectionFlags::BOLD | SelectionFlags::ITALIC
        );
    }

    #[test]
    fn a_source_without_gasp_gets_one_smoothing_range() {
        let tables = FontinfoTables::read(&LibData::new(), None);

        assert_eq!(tables.gasp, unhinted_gasp());
        assert_eq!(tables.vendor_id, None);
    }

    #[test]
    fn the_sources_own_gasp_ranges_and_vendor_are_kept() {
        let range = |max: i64, bits: Vec<i64>| {
            LibValue::Dict(
                [
                    ("rangeMaxPPEM".to_string(), LibValue::Integer(max)),
                    (
                        "rangeGaspBehavior".to_string(),
                        LibValue::Array(bits.into_iter().map(LibValue::Integer).collect()),
                    ),
                ]
                .into(),
            )
        };
        let info = fontinfo(vec![
            (
                "openTypeGaspRangeRecords",
                LibValue::Array(vec![range(8, vec![1]), range(65535, vec![0, 1, 2, 3])]),
            ),
            ("openTypeOS2VendorID", LibValue::String("VSNT".to_string())),
        ]);

        let tables = FontinfoTables::read(&info, None);

        assert_eq!(tables.gasp.len(), 2);
        assert_eq!(tables.gasp[0].range_max_ppem, 8);
        assert_eq!(
            tables.gasp[0].range_gasp_behavior,
            GaspRangeBehavior::GASP_DOGRAY
        );
        assert_eq!(tables.vendor_id.as_deref(), Some("VSNT"));
    }
}
