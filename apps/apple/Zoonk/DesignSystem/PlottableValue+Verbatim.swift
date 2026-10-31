import Charts

extension PlottableValue {
  /// A label that only tells marks apart. Swift Charts reads a literal label as a localization key.
  static func value(verbatim label: String, _ value: Value) -> Self {
    .value(label, value)
  }
}
