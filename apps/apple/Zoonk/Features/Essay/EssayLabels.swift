import Foundation

enum WritingLabels {
  /// A number of points, to one decimal.
  static func points(_ value: Double) -> String {
    ActivityNumberFormat.format(value, digits: 1, locale: .autoupdatingCurrent)
  }

  /// A number of points with exactly `decimals` decimals.
  private static func points(_ value: Double, decimals: Int) -> String {
    value.formatted(.number.precision(.fractionLength(decimals)))
  }

  /// Both ends of a range take one decimal when either needs it.
  private static func decimals(_ range: WritingRange) -> Int {
    [range.low, range.high].contains { Int((abs($0) * 10).rounded()) % 10 != 0 } ? 1 : 0
  }

  /// A range of points, one number when both ends round alike ("29.8", never "29.79–29.8"), and
  /// both ends with the same decimals ("12.0–17.5", never "12–17.5").
  static func range(_ range: WritingRange) -> String {
    let decimals = decimals(range)
    let low = points(range.low, decimals: decimals)
    let high = points(range.high, decimals: decimals)

    return low == high
      ? low
      : String(
        localized: "\(low)–\(high)", table: "Essay",
        comment: "A range of points, low to high, like 16–19")
  }

  /// What language errors take away: "−0.3 to −0.6", or one number when both ends round alike.
  static func deduction(_ range: WritingRange) -> String {
    let decimals = decimals(range)
    let low = points(range.low, decimals: decimals)
    let high = points(range.high, decimals: decimals)

    if range.high <= 0 { return low }

    return low == high
      ? "−\(low)"
      : String(
        localized: "−\(low) to −\(high)", table: "Essay",
        comment: "Points language errors take off an answer, as a range, like '−0.3 to −0.6'")
  }

  static func range(_ range: WritingRange, of max: Double) -> String {
    String(
      localized: "\(self.range(range)) of \(points(max))", table: "Essay",
      comment: "A range of points of a question's total, like '16–19 of 30'")
  }

  /// A count of language errors, which is often none.
  static func errors(_ count: Int) -> String {
    count == 0
      ? String(localized: "0 errors", table: "Essay", comment: "An answer with no language errors")
      : String(
        localized: "\(count) errors", table: "Essay", comment: "Language errors in an answer")
  }

  static func header(_ writing: WritingPrompt) -> String {
    writing.unit == .drill
      ? String(localized: "Writing drill", table: "Essay", comment: "A short writing exercise")
      : String(localized: "Written answer", table: "Essay", comment: "An exam's written question")
  }

  static func level(_ level: WritingResult.Level) -> String {
    switch level {
    case .complete:
      String(
        localized: "Complete", table: "Essay", comment: "A criterion of a written answer fully met")
    case .strong:
      String(
        localized: "Good", table: "Essay", comment: "A criterion of a written answer mostly met")
    case .partial:
      String(
        localized: "Partly", table: "Essay", comment: "A criterion of a written answer half met")
    case .missing:
      String(
        localized: "Missing", table: "Essay", comment: "A criterion of a written answer not met")
    }
  }

  /// How many of a level meter's four cells each level fills.
  static func cells(_ level: WritingResult.Level) -> Int {
    switch level {
    case .complete: 4
    case .strong: 3
    case .partial: 2
    case .missing: 0
    }
  }

  /// "Up to 30 lines · 30 points · about 1 hr 10 min": the official clock without "about".
  static func facts(_ writing: WritingPrompt, pacing: WritingPacing?) -> [String] {
    var facts: [String] = []

    if let lines = writing.lines {
      facts.append(
        String(
          localized: "Up to \(lines) lines", table: "Essay",
          comment: "A written question's line limit"))
    }

    if let points = writing.points {
      facts.append(
        String(
          localized: "\(self.points(points)) points", table: "Essay",
          comment: "What a written question is worth"))
    }

    if let pacing {
      let time = studyDuration(minutes: pacing.minutes)
      facts.append(
        pacing.source == .official
          ? time
          : String(
            localized: "about \(time)", table: "Essay",
            comment: "An estimated time to write an answer"))
    }

    return facts
  }

  /// "about 23 of 30 lines", or the words written where the question has no line limit.
  static func lineCount(_ text: String, writing: WritingPrompt) -> (words: String, isOver: Bool) {
    guard let limit = writing.lines else {
      let words = WordCount.count(text)
      return (
        String(localized: "\(words) words", table: "Essay", comment: "An answer's word count"),
        false
      )
    }

    let used = WritingLines.count(
      text, charactersPerLine: writing.charactersPerLine, limit: limit
    ).estimatedLines

    return used > limit
      ? (
        String(
          localized: "about \(used) of \(limit) lines · \(used - limit) won't be read",
          table: "Essay",
          comment:
            "The approximate line count of a written answer past its limit; the lines past it are ones the exam board won't read."
        ),
        true
      )
      : (
        String(
          localized: "about \(used) of \(limit) lines", table: "Essay",
          comment: "An answer's estimated handwritten lines, of the question's limit"),
        false
      )
  }
}
