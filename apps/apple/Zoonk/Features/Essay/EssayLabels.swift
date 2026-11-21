import Foundation

enum WritingLabels {
  /// Numbers read as main writes them in the app's language, whatever the device's region.
  private static let locale = Locale.courseLanguage

  /// A number of points: exactly the scale's `decimals` when known, else to one decimal at most.
  static func points(_ value: Double, decimals: Int? = nil) -> String {
    guard let decimals else {
      return ActivityNumberFormat.format(value, digits: 1, locale: locale)
    }

    return value.formatted(.number.precision(.fractionLength(decimals)).locale(locale))
  }

  /// A share, like "50%".
  static func share(_ value: Double) -> String {
    value.formatted(.percent.precision(.fractionLength(0)).locale(locale))
  }

  /// Without the scale's own decimals, both ends take one when either needs it.
  private static func decimals(_ range: WritingRange, scale: Int?) -> Int {
    scale ?? ([range.low, range.high].contains { Int((abs($0) * 10).rounded()) % 10 != 0 } ? 1 : 0)
  }

  /// 0.3 × 10 is 3.0000000000000004 in floating point, which must still round to 3.
  private static let floatSlack = 1e-9

  /// A headline's ends rounded outward, the low one down and the high one up, so it never claims
  /// more than its parts.
  static func roundedOutward(_ range: WritingRange, decimals: Int) -> WritingRange {
    let step = pow(10, Double(decimals))

    return WritingRange(
      high: (range.high * step - floatSlack).rounded(.up) / step + 0,
      low: (range.low * step + floatSlack).rounded(.down) / step + 0)
  }

  /// A range of points, one number when both ends read alike ("29.8", never "29.79–29.8"), both
  /// ends with the same decimals ("12.0–17.5", never "12–17.5"), joined by an en dash. A
  /// `headline` rounds outward.
  static func range(_ range: WritingRange, decimals scale: Int? = nil, headline: Bool = false)
    -> String
  {
    let decimals = decimals(range, scale: scale)
    let shown = headline ? roundedOutward(range, decimals: decimals) : range
    let low = points(shown.low, decimals: decimals)
    let high = points(shown.high, decimals: decimals)

    return low == high
      ? low
      : String(
        localized: "\(low)–\(high)", table: "Essay",
        comment: "A range of points, low to high, like 16–19")
  }

  /// What language errors take away: "−0.3 to −0.6", or one number when both ends read alike.
  static func deduction(_ range: WritingRange, decimals scale: Int? = nil) -> String {
    let decimals = decimals(range, scale: scale)
    let low = points(range.low, decimals: decimals)
    let high = points(range.high, decimals: decimals)

    if range.high <= 0 { return low }

    return low == high
      ? "−\(low)"
      : String(
        localized: "−\(low) to −\(high)", table: "Essay",
        comment: "Points language errors take off an answer, as a range, like '−0.3 to −0.6'")
  }

  static func range(_ range: WritingRange, of max: Double, decimals: Int? = nil) -> String {
    String(
      localized: "\(self.range(range, decimals: decimals)) of \(points(max))", table: "Essay",
      comment: "A range of points of a question's total, like '16–19 of 30'")
  }

  /// A count of language errors, which is often none.
  static func errors(_ count: Int) -> String {
    count == 0
      ? String(localized: "0 errors", table: "Essay", comment: "An answer with no language errors")
      : String(
        localized: "\(count) errors", table: "Essay", comment: "Language errors in an answer")
  }

  /// The screen's header: what kind of writing this is. The topic is the page's own title.
  static func header(_ unit: WritingPrompt.Unit?) -> String {
    unit == .drill
      ? String(localized: "Writing practice", table: "Essay")
      : String(localized: "Written answer", table: "Essay")
  }

  /// A writing task by the name a learner knows it, before its question is assigned: a drill as
  /// its own short exercise, a whole answer by its line limit when no other task shares it, else by
  /// its place in the test. Without a name from the server, the block's own title.
  static func taskTitle(unit: WritingPrompt.Unit?, task: WritingTaskName?, fallback: String?)
    -> String?
  {
    if unit == .drill {
      return String(
        localized: "Short writing exercise", table: "Essay",
        comment:
          "A few minutes of writing after a lesson, using what it just taught, such as one paragraph of an exam answer."
      )
    }

    guard let task else { return fallback }

    if task.distinctLines, let lines = task.lines {
      return String(
        localized: "Write the \(String(lines))-line question", table: "Essay",
        comment:
          "A whole answer of an exam's written test, named by its line limit, such as 30 lines.")
    }

    return task.total > 1
      ? String(localized: "Write question \(String(task.number))", table: "Essay")
      : String(localized: "Write the question", table: "Essay")
  }

  /// A written task that waits for an exam choice says which, on the row it limits; `task` names
  /// the one question that waits when others don't.
  static func choiceLine(_ choiceGroups: [String], task: String? = nil) -> String {
    let groups = choiceGroups.formatted(.list(type: .and).locale(locale))

    guard let task else {
      return String(
        localized: "Depends on your choice of \(groups)", table: "Essay",
        comment:
          "Under a written test or question whose question depends on an exam choice the learner hasn't made, such as which specialty they'll take. {groups} names the choices."
      )
    }

    return String(
      localized: "\(task) depends on your choice of \(groups)", table: "Essay",
      comment:
        "Under a written test where one question waits for an exam choice the learner hasn't made. {task} is the question, such as \"The 60-line question\"; {groups} names the choices."
    )
  }

  /// A task named where it labels something rather than asks for it, such as its points on the
  /// written test's page: "The 30-line question", "Question 2", or the notice's name without its
  /// place.
  static func taskName(_ task: WritingTaskName?, title: String) -> String {
    guard let task else { return title }

    if task.distinctLines, let lines = task.lines {
      return String(
        localized: "The \(String(lines))-line question", table: "Essay",
        comment:
          "One question of an exam's written test, named by its line limit, such as 30 lines.")
    }

    return task.total > 1
      ? String(localized: "Question \(String(task.number))", table: "Essay")
      : String(
        localized: "The question", table: "Essay",
        comment: "The only question of an exam's written test.")
  }

  /// The one line a row shows when the day's grading is used up, under the row it limits.
  static func gradingReturns(_ returnsOn: String) -> String {
    let today = PlanDate.today()

    return PlanDate.days(from: today, to: returnsOn) <= 1
      ? String(localized: "Back tomorrow: no more grading today", table: "Essay")
      : String(
        localized: "Back on \(PlanDate.longDay(returnsOn, today: today)): no more grading today",
        table: "Essay")
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

  /// "about 23 of 30 lines" ("0 of 30 lines" while empty), or the words written where the question has no line limit.
  static func lineCount(_ text: String, writing: WritingPrompt) -> (words: String, isOver: Bool) {
    guard let limit = writing.lines else {
      let words = WordCount.count(text)
      return (
        String(localized: "\(words) words", table: "Essay", comment: "An answer's word count"),
        false
      )
    }

    if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      return (String(localized: "0 of \(limit) lines", table: "Essay"), false)
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
            "The approximate line count of a written answer past its limit; the lines past it are ones the exam's graders won't read."
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
