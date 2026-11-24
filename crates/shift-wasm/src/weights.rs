//! Standard weight names, for the editor's style labels.

use wasm_bindgen::prelude::*;

/// The standard weight-class name of a `wght` user value (400 → "Regular");
/// empty between the standard weights.
#[wasm_bindgen(js_name = standardWeightName)]
pub fn standard_weight_name(value: f64) -> String {
    shift_font::weight_class::standard_weight_name(value)
        .unwrap_or_default()
        .to_owned()
}
