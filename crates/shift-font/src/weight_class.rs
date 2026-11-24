//! The standard weight-class names, by `wght` user value, as OpenType's
//! `usWeightClass` table and most type families name them.

/// The nine standard weights, from Thin at 100 to Black at 900.
pub const STANDARD_WEIGHTS: [(f64, &str); 9] = [
    (100.0, "Thin"),
    (200.0, "ExtraLight"),
    (300.0, "Light"),
    (400.0, "Regular"),
    (500.0, "Medium"),
    (600.0, "SemiBold"),
    (700.0, "Bold"),
    (800.0, "ExtraBold"),
    (900.0, "Black"),
];

/// The standard name of a `wght` user value, or `None` between the standard weights.
pub fn standard_weight_name(value: f64) -> Option<&'static str> {
    STANDARD_WEIGHTS
        .iter()
        .find(|(weight, _)| (weight - value).abs() < f64::EPSILON)
        .map(|(_, name)| *name)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_the_standard_weights_and_nothing_between() {
        assert_eq!(standard_weight_name(400.0), Some("Regular"));
        assert_eq!(standard_weight_name(800.0), Some("ExtraBold"));
        assert_eq!(standard_weight_name(450.0), None);
    }
}
