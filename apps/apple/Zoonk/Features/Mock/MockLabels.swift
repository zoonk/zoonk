import Foundation

/// The mock's words the runner, the result, the chooser and the exam page share.
enum MockLabels {
  /// "Mock exam 2".
  static func title(number: Int) -> String {
    String(
      localized: "Mock exam \(number)", table: "Mock", comment: "A mock exam's name, by its number")
  }

  /// A mock sits a whole exam day or half of one, the day named when the exam has several.
  static func daySize(fullLength: Bool, day: Int?) -> String {
    switch (fullLength, day) {
    case (true, let day?):
      String(
        localized: "A full exam day, day \(day)", table: "Mock",
        comment: "A mock of a whole exam day, of an exam of several days")
    case (false, let day?):
      String(
        localized: "Half an exam day, day \(day)", table: "Mock",
        comment: "A mock of half an exam day, of an exam of several days")
    case (true, nil):
      String(localized: "A full exam day", table: "Mock", comment: "A mock of a whole exam day")
    case (false, nil):
      String(localized: "Half an exam day", table: "Mock", comment: "A mock of half an exam day")
    }
  }

  /// What a mock sat, beside its number: the subject, a day or half of one for one taken any time,
  /// the starting point for one in onboarding; nil for the plan's own.
  static func shape(purpose: MockPurpose, shape: MockShape?) -> String? {
    if purpose == .placement {
      return String(
        localized: "Starting point", table: "Mock", comment: "A mock taken to place the learner")
    }

    guard let shape else {
      return nil
    }

    switch shape.kind {
    case .area: return shape.area
    case .full: return daySize(fullLength: true, day: nil)
    case .half: return daySize(fullLength: false, day: nil)
    }
  }

  /// A length as the clock gives it ("4h 30m").
  static func duration(minutes: Int) -> String {
    Duration.seconds(minutes * 60).formatted(.units(allowed: [.hours, .minutes], width: .narrow))
  }

  /// A score with up to two decimals ("10.75"), as partial credit and penalties leave them.
  static func number(_ value: Double) -> String {
    value.formatted(.number.precision(.fractionLength(0...2)))
  }

  /// An estimated range ("620–680").
  static func range(low: Double, high: Double) -> String {
    String(
      localized: "\(number(low.rounded()))–\(number(high.rounded()))", table: "Mock",
      comment: "An estimated score range, low to high")
  }
}
