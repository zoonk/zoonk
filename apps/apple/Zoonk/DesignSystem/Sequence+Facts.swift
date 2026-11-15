extension Sequence<String> {
  /// Joins facts with “ · ”. A no-break space holds the dot to the fact before it, so a wrapped line
  /// never starts with it or leaves it alone, and a fact that leads with its number ("23 short
  /// lessons") keeps to one line, so the number never parts from its noun.
  func joinedFacts() -> String {
    map(\.asFact).joined(separator: "\u{00A0}· ")
  }
}

extension String {
  fileprivate var asFact: String {
    guard let lead = first, lead.isNumber || lead == "~" else { return self }

    return replacing(" ", with: "\u{00A0}")
  }
}
