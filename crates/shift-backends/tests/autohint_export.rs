//! TrueType hinting at export, by ttfautohint.
//!
//! ttfautohint is an optional external program, so the hinting test runs only
//! when `SHIFT_TTFAUTOHINT` names it; without it, it says so and passes.

use shift_backends::autohint::TTFAUTOHINT_ENV;
use shift_backends::export::{ExportFormat, FontExportRequest};
use shift_backends::{BinaryEncoding, BinaryEncodings, FontExporter};
use shift_font::test_support::sample_variable_font;
use skrifa::{FontRef, Tag};

fn has_table(bytes: &[u8], tag: [u8; 4]) -> bool {
    FontRef::new(bytes)
        .unwrap()
        .table_data(Tag::new(&tag))
        .is_some()
}

#[test]
fn static_instances_carry_ttfautohint_instructions_and_the_variable_font_stays_unhinted() {
    if std::env::var_os(TTFAUTOHINT_ENV).is_none() {
        eprintln!("skipped: set {TTFAUTOHINT_ENV} to run ttfautohint");
        return;
    }
    let font = sample_variable_font();
    let encodings = BinaryEncodings::new([BinaryEncoding::Ttf]).unwrap();
    let exporter = FontExporter::new().with_autohint(true);
    let temp = tempfile::tempdir().unwrap();

    let statics = temp.path().join("static");
    exporter
        .export_with(
            &font,
            FontExportRequest {
                path: statics.clone(),
                format: ExportFormat::StaticTtf,
            },
            &encodings,
        )
        .unwrap();
    let variable = temp.path().join("Sample[wght].ttf");
    exporter
        .export_with(
            &font,
            FontExportRequest {
                path: variable.clone(),
                format: ExportFormat::Ttf,
            },
            &encodings,
        )
        .unwrap();

    let hinted: Vec<_> = std::fs::read_dir(&statics)
        .unwrap()
        .map(|entry| std::fs::read(entry.unwrap().path()).unwrap())
        .collect();
    assert!(!hinted.is_empty());
    for bytes in &hinted {
        assert!(
            has_table(bytes, *b"fpgm"),
            "a hinted static font has a font program"
        );
    }
    let variable = std::fs::read(variable).unwrap();
    assert!(has_table(&variable, *b"fvar"));
    assert!(
        !has_table(&variable, *b"fpgm"),
        "ttfautohint can't hint variable fonts"
    );
}
