//! TrueType hinting through ttfautohint.
//!
//! [ttfautohint](https://freetype.org/ttfautohint/) (FreeType License) runs as
//! an optional external program over a compiled TrueType binary, adding the
//! instructions that keep stems crisp at small sizes on screens that use them.

use std::ffi::OsString;
use std::io::Write;
use std::process::{Command, Stdio};

use crate::export::ExportError;

/// The environment variable that holds the command running ttfautohint, as a
/// JSON array of the executable and its leading arguments (for example
/// `["python", "-m", "ttfautohint"]`); `ttfautohint` on the search path otherwise.
pub const TTFAUTOHINT_ENV: &str = "SHIFT_TTFAUTOHINT";

/// Returns `ttf` with ttfautohint's instructions added.
///
/// # Errors
///
/// Returns [`ExportError::AutohintMissing`] when ttfautohint cannot be started
/// and [`ExportError::AutohintFailed`] when it rejects the font.
pub(crate) fn autohint(ttf: &[u8]) -> Result<Vec<u8>, ExportError> {
    let command = ttfautohint_command();
    match run(&command, ttf, &[]) {
        // A font still missing the characters ttfautohint measures its script
        // by (a draft without `o`, say) is hinted as symbols, as it advises.
        Err(ExportError::AutohintFailed { detail }) if detail.contains("--symbol") => {
            run(&command, ttf, &["--symbol"])
        }
        result => result,
    }
}

fn run(command: &[OsString], ttf: &[u8], extra: &[&str]) -> Result<Vec<u8>, ExportError> {
    let program = command
        .first()
        .cloned()
        .unwrap_or_else(|| "ttfautohint".into());
    let mut child = Command::new(&program)
        .args(&command[1.min(command.len())..])
        // With no file arguments, ttfautohint reads the font from standard input
        // and writes the hinted font to standard output.
        .arg("--no-info")
        .args(extra)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|source| ExportError::AutohintMissing {
            program: program.clone(),
            source,
        })?;
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(ttf)
            .map_err(|source| ExportError::AutohintMissing {
                program: program.clone(),
                source,
            })?;
    }
    let output = child
        .wait_with_output()
        .map_err(|source| ExportError::AutohintMissing { program, source })?;
    if !output.status.success() || output.stdout.is_empty() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(ExportError::AutohintFailed {
            detail: stderr.split_whitespace().collect::<Vec<_>>().join(" "),
        });
    }
    Ok(output.stdout)
}

fn ttfautohint_command() -> Vec<OsString> {
    std::env::var(TTFAUTOHINT_ENV)
        .ok()
        .map(|value| parse_command(&value))
        .filter(|command| !command.is_empty())
        .unwrap_or_else(|| vec![OsString::from("ttfautohint")])
}

/// Reads a command written as a JSON array of strings, or as a bare path.
fn parse_command(value: &str) -> Vec<OsString> {
    let trimmed = value.trim();
    let Some(inner) = trimmed
        .strip_prefix('[')
        .and_then(|rest| rest.strip_suffix(']'))
    else {
        return vec![OsString::from(trimmed)];
    };
    inner
        .split(',')
        .map(|part| part.trim().trim_matches('"').replace("\\\\", "\\"))
        .filter(|part| !part.is_empty())
        .map(OsString::from)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_the_command_as_a_json_array_or_a_path() {
        assert_eq!(
            parse_command(r#"["python", "-m", "ttfautohint"]"#),
            ["python", "-m", "ttfautohint"].map(OsString::from)
        );
        assert_eq!(
            parse_command("ttfautohint"),
            [OsString::from("ttfautohint")]
        );
    }

    #[test]
    fn says_ttfautohint_is_missing_when_it_cannot_run() {
        let temp = tempfile::tempdir().unwrap();
        let missing = vec![OsString::from(temp.path().join("no-such-ttfautohint"))];

        let error = run(&missing, b"not a font", &[]).unwrap_err();

        assert!(matches!(error, ExportError::AutohintMissing { .. }));
        assert!(error.to_string().contains("ttfautohint"));
    }
}
