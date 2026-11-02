extension Sequence<String> {
  /// Joins facts with “ · ”. A no-break space holds the dot to the fact before it, so a wrapped line
  /// never starts with it or leaves it alone.
  func joinedFacts() -> String {
    joined(separator: "\u{00A0}· ")
  }
}
