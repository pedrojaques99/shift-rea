//! CFF and CFF2 exports, built by fontmake from the designspace Shift writes.
//!
//! fontmake is an optional external program, so these tests run only when
//! `SHIFT_FONTMAKE` names it; without it they say so and pass. The
//! missing-program error is tested beside the runner, in `export_cff`.

use shift_backends::export::{ExportFormat, FontExportRequest};
use shift_backends::export_cff::FONTMAKE_ENV;
use shift_backends::{BinaryEncoding, BinaryEncodings, ExportError, FontExporter};
use shift_font::test_support::sample_variable_font;
use skrifa::raw::TableProvider;
use skrifa::{FontRef, MetadataProvider};

fn fontmake_available() -> bool {
    let available = std::env::var_os(FONTMAKE_ENV).is_some();
    if !available {
        eprintln!("skipped: set {FONTMAKE_ENV} to fontmake's path to build CFF fonts");
    }
    available
}

fn export(format: ExportFormat, path: std::path::PathBuf) -> Result<(), ExportError> {
    let font = sample_variable_font();
    let request = FontExportRequest { path, format };
    FontExporter::default()
        .export_with(
            &font,
            request,
            &BinaryEncodings::new([BinaryEncoding::Ttf]).unwrap(),
        )
        .map(|_| ())
}

#[test]
fn a_variable_font_exports_as_one_cff2_binary_with_its_axes() {
    if !fontmake_available() {
        return;
    }
    let temp = tempfile::tempdir().unwrap();
    let path = temp.path().join("Sample[wght].otf");

    export(ExportFormat::Otf, path.clone()).unwrap();

    let bytes = std::fs::read(&path).unwrap();
    let font = FontRef::new(&bytes).unwrap();
    assert!(font.cff2().is_ok(), "a variable OTF carries CFF2 outlines");
    assert!(font.glyf().is_err(), "and no TrueType outlines");
    assert!(!font.axes().is_empty());
    assert!(font.charmap().map('A').is_some());
}

#[test]
fn static_instances_export_as_cff_binaries_into_a_directory() {
    if !fontmake_available() {
        return;
    }
    let temp = tempfile::tempdir().unwrap();
    let directory = temp.path().join("static");

    export(ExportFormat::StaticOtf, directory.clone()).unwrap();

    let binaries: Vec<_> = std::fs::read_dir(&directory)
        .unwrap()
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|ext| ext == "otf"))
        .collect();
    assert!(!binaries.is_empty());
    for path in binaries {
        let bytes = std::fs::read(&path).unwrap();
        let font = FontRef::new(&bytes).unwrap();
        assert!(
            font.cff().is_ok(),
            "{} carries CFF outlines",
            path.display()
        );
    }
    let leftovers = std::fs::read_dir(&directory)
        .unwrap()
        .filter_map(Result::ok)
        .any(|entry| {
            entry
                .file_name()
                .to_string_lossy()
                .starts_with(".shift-cff-")
        });
    assert!(!leftovers, "the scratch designspace is cleaned up");
}
