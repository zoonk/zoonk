import SwiftUI

enum MockLabels {
  static func title(number: Int) -> String {
    String(
      localized: "Mock exam \(number)", table: "Mock", comment: "A mock exam's name, by its number")
  }

  static func daySize(fullLength: Bool, day: Int?) -> String {
    switch (fullLength, day) {
    case (true, let day?):
      String(
        localized: "Day \(day)", table: "Mock",
        comment: "A mock exam of one whole day of an exam held over several days")
    case (false, let day?):
      String(
        localized: "Half of day \(day)", table: "Mock",
        comment: "A mock exam of half of one day of an exam held over several days")
    case (true, nil):
      String(localized: "The full exam", table: "Mock", comment: "A mock exam of the whole exam")
    case (false, nil):
      String(localized: "Half the exam", table: "Mock", comment: "A mock exam of half the exam")
    }
  }

  static func optionName(_ option: MockOption, severalDays: Bool) -> String {
    if option.kind == .area {
      return option.areas.first ?? option.area
        ?? String(localized: "One subject", table: "Mock", comment: "A one-subject mock")
    }

    let unpicked = option.leftOut.compactMap { $0.part == .choice ? $0.name : nil }

    if option.kind == .full, !unpicked.isEmpty {
      let names = unpicked.formatted(.list(type: .and))

      return severalDays
        ? String(
          localized: "Day \(option.day ?? 1), without \(names)", table: "Mock",
          comment:
            "A mock exam of one whole day, of an exam held over several days, without the tests the learner hasn't picked an option for yet"
        )
        : String(
          localized: "The full exam, without \(names)", table: "Mock",
          comment:
            "A mock exam of the whole exam without the tests the learner hasn't picked an option for yet"
        )
    }

    return daySize(
      fullLength: option.kind == .full, day: severalDays ? (option.day ?? 1) : nil)
  }

  /// What a mock exam leaves out, in Details. Numeric and short answers say nothing: they're
  /// asked as choices.
  static func leftOut(_ leftOut: MockLeftOut) -> String? {
    switch (leftOut.part, leftOut.name) {
    case (.choice, let name):
      String(
        localized: "\(name ?? "") isn't in it until you pick which one you take.", table: "Mock",
        comment:
          "The argument is a part of the exam, such as a specialty's own test, that the learner hasn't picked an option for yet"
      )
    case (.listening, let name?), (.speaking, let name?), (.practical, let name?),
      (.written, let name?):
      String(
        localized: "Not in mock exams yet: \(name).", table: "Mock",
        comment: "A part of the exam mock exams don't have yet")
    case (.listening, nil):
      String(
        localized: "Not in mock exams yet: listening.", table: "Mock",
        comment: "Listening, which mock exams don't have yet")
    case (.speaking, nil):
      String(
        localized: "Not in mock exams yet: speaking.", table: "Mock",
        comment: "Speaking, which mock exams don't have yet")
    case (.practical, nil):
      String(
        localized: "Not in mock exams yet: the practical test.", table: "Mock",
        comment: "The exam's practical test, which mock exams don't have")
    case (.written, nil):
      nil
    case (.numeric, _), (.shortAnswer, _):
      nil
    case (.writtenInFull, let name):
      String(
        localized: "\(name ?? "") is only in full mock exams.", table: "Mock",
        comment: "A written part only full mock exams ask")
    }
  }

  static func duration(minutes: Int) -> String {
    Duration.seconds(minutes * 60).formatted(.units(allowed: [.hours, .minutes], width: .narrow))
  }

  static func number(_ value: Double, locale: Locale = .autoupdatingCurrent) -> String {
    ActivityNumberFormat.format(value, digits: 2, locale: locale)
  }

  static func points(_ value: Double) -> String {
    let rounded = (value * 100).rounded() / 100

    return rounded == rounded.rounded()
      ? String(localized: "\(Int(rounded)) points", table: "Mock", comment: "A number of points")
      : String(
        localized: "\(number(rounded)) points", table: "Mock",
        comment: "A number of points with decimals, like 2.5 points")
  }

  static func points(_ value: Double, of total: Double) -> String {
    String(
      localized: "\(number(value)) of \(number(total))", table: "Mock",
      comment: "Points of a total, like '182 of 260'")
  }

  static func percent(_ value: Double, locale: Locale = .autoupdatingCurrent) -> String {
    ActivityNumberFormat.percent(value / 100, digits: 1, locale: locale)
  }

  /// A points minimum is its number alone: the sentence around it says it's points.
  static func minimum(_ minimum: PointsMinimum) -> String {
    minimum.unit == .percent ? percent(minimum.value) : number(minimum.value)
  }

  static func range(low: Double, high: Double) -> String {
    String(
      localized: "\(number(low.rounded()))–\(number(high.rounded()))", table: "Mock",
      comment: "An estimated score range, low to high")
  }
}

/// Says where a mock's size comes from whenever it isn't the notice, so a number is never made up.
struct MockSizeNote: View {
  let minutes: Int
  let questions: Int
  let source: MockSizeSource

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      if let edition = source.pastEdition, let url = URL(string: edition.url) {
        Link(destination: url) {
          let publisher = url.host(percentEncoded: false) ?? edition.url
          if let name = edition.edition {
            Text(
              "Questions per subject in the \(name), as counted by \(publisher).",
              tableName: "Mock", comment: "Where a mock's question counts come from")
          } else {
            Text(
              "Questions per subject in the latest exam, as counted by \(publisher).",
              tableName: "Mock", comment: "Where a mock's question counts come from")
          }
        }
      }

      ForEach(lines, id: \.self) { Text($0) }
    }
  }

  /// One line at most: the size the mock exam chose when the exam's own isn't stated.
  private var lines: [String] {
    guard source.questions != .notice || source.time != .notice else {
      return []
    }

    let time = MockLabels.duration(minutes: minutes)

    if source.material {
      return [
        String(
          localized:
            "Your material doesn't say the test's size, so this mock exam used \(questions) questions in \(time).",
          table: "Mock",
          comment:
            "A mock exam's size when the learner's material for a class test doesn't state it")
      ]
    }

    return [
      String(
        localized:
          "The official guide doesn't say the exam's size, so this mock exam used \(questions) questions in \(time).",
        table: "Mock", comment: "A mock exam's size when the exam's official guide doesn't state it"
      )
    ]
  }

}
