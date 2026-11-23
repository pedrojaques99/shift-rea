//! OpenType CFF and CFF2 export through fontmake.
//!
//! fontc writes TrueType outlines only, so PostScript-flavoured binaries come
//! from [fontmake](https://github.com/googlefonts/fontmake) (Apache-2.0), run
//! as an external program over the designspace this crate already writes.
//! fontmake is optional: the export says how to install it when it is missing.

use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::export::ExportError;

/// The environment variable that names the fontmake executable to run,
/// instead of finding `fontmake` on the search path.
pub const FONTMAKE_ENV: &str = "SHIFT_FONTMAKE";

/// What fontmake builds from the designspace.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum CffBuild {
    /// One CFF binary for a font without axes.
    Static,
    /// One variable CFF2 binary.
    Variable,
    /// One static CFF binary per named instance, into a directory.
    Instances,
}

/// Runs fontmake over `designspace` and leaves its binaries at `output`: a
/// file for [`CffBuild::Static`] and [`CffBuild::Variable`], a directory for
/// [`CffBuild::Instances`].
///
/// # Errors
///
/// Returns [`ExportError::FontmakeMissing`] when fontmake cannot be started,
/// [`ExportError::FontmakeFailed`] when it exits with an error, and
/// [`ExportError::Io`]-style errors when its output cannot be moved into place.
pub(crate) fn build(
    designspace: &Path,
    build: CffBuild,
    output: &Path,
    scratch: &Path,
) -> Result<(), ExportError> {
    run(&fontmake(), designspace, build, output, scratch)
}

/// [`build`] with the fontmake executable given.
fn run(
    program: &OsString,
    designspace: &Path,
    build: CffBuild,
    output: &Path,
    scratch: &Path,
) -> Result<(), ExportError> {
    let out_dir = scratch.join("fontmake-out");
    let mut command = Command::new(program);
    command.arg("-m").arg(designspace);
    match build {
        CffBuild::Static => {
            command.args(["-o", "otf", "--output-dir"]).arg(&out_dir);
        }
        CffBuild::Variable => {
            command
                .args(["-o", "variable-cff2", "--output-path"])
                .arg(output);
        }
        CffBuild::Instances => {
            command
                .args(["-i", "-o", "otf", "--output-dir"])
                .arg(output);
        }
    }

    let result = command
        .output()
        .map_err(|source| ExportError::FontmakeMissing {
            program: program.clone(),
            source,
        })?;
    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        let detail = stderr
            .lines()
            .rev()
            .find(|line| !line.trim().is_empty())
            .unwrap_or("fontmake exited without a message");
        return Err(ExportError::FontmakeFailed {
            detail: detail.trim().to_owned(),
        });
    }

    if build == CffBuild::Static {
        let built = first_with_extension(&out_dir, "otf")?;
        std::fs::rename(&built, output).map_err(|source| ExportError::CreateDirectory {
            path: output.to_path_buf(),
            source,
        })?;
    }
    Ok(())
}

/// The fontmake executable: `SHIFT_FONTMAKE` when set, else `fontmake`.
fn fontmake() -> OsString {
    std::env::var_os(FONTMAKE_ENV).unwrap_or_else(|| OsString::from("fontmake"))
}

/// The first file in `directory` with `extension`, in name order.
fn first_with_extension(directory: &Path, extension: &str) -> Result<PathBuf, ExportError> {
    let read = std::fs::read_dir(directory).map_err(|source| ExportError::CreateDirectory {
        path: directory.to_path_buf(),
        source,
    })?;
    let mut files = read
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.extension()
                .and_then(|ext| ext.to_str())
                .is_some_and(|ext| ext.eq_ignore_ascii_case(extension))
        })
        .collect::<Vec<_>>();
    files.sort();
    files
        .into_iter()
        .next()
        .ok_or_else(|| ExportError::FontmakeFailed {
            detail: format!("fontmake wrote no .{extension} file"),
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn says_how_to_install_fontmake_when_it_cannot_run() {
        let temp = tempfile::tempdir().unwrap();
        let missing = OsString::from(temp.path().join("no-such-fontmake"));

        let error = run(
            &missing,
            &temp.path().join("source.designspace"),
            CffBuild::Variable,
            &temp.path().join("Out.otf"),
            temp.path(),
        )
        .unwrap_err();

        assert!(matches!(error, ExportError::FontmakeMissing { .. }));
        assert!(error.to_string().contains("pip install fontmake"));
    }
}
