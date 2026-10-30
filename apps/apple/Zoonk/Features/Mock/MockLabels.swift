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

  static func duration(minutes: Int) -> String {
    Duration.seconds(minutes * 60).formatted(.units(allowed: [.hours, .minutes], width: .narrow))
  }

  static func number(_ value: Double) -> String {
    value.formatted(.number.precision(.fractionLength(0...2)))
  }

  static func range(low: Double, high: Double) -> String {
    String(
      localized: "\(number(low.rounded()))–\(number(high.rounded()))", table: "Mock",
      comment: "An estimated score range, low to high")
  }
}

/// Says where a mock's size comes from whenever it isn't the notice, so a number is never made up.
struct MockSizeNote: View {
  let document: ExamDocument
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

  private var lines: [String] {
    let notice = document == .notice
    let time = MockLabels.duration(minutes: minutes)

    if source.material {
      return [
        source.questions == .unstated || source.time == .unstated
          ? String(
            localized:
              "Your material doesn't say how long the test is. This mock asks \(questions) questions in \(time).",
            table: "Mock", comment: "A class test's size") : nil,
        source.formats == .even
          ? String(
            localized:
              "Your material doesn't say how many questions each format has, so they're split evenly.",
            table: "Mock", comment: "A class test's formats") : nil,
      ].compactMap { $0 }
    }

    let unstated =
      notice
      ? String(
        localized: "The notice doesn't say how many questions the exam has.", table: "Mock",
        comment: "The notice gives no question count")
      : String(
        localized: "The official guide doesn't say how many questions the exam has.",
        table: "Mock", comment: "The guide gives no question count")

    return [
      source.questions == .unstated
        ? "\(unstated) \(String(localized: "This mock asks \(questions) questions.", table: "Mock", comment: "The mock's own size"))"
        : nil,
      source.questions == .pastEdition
        ? "\(unstated) \(String(localized: "This mock asks \(questions) questions, as a past edition did.", table: "Mock", comment: "The mock's size from a past edition"))"
        : nil,
      source.subjects == .even
        ? (notice
          ? String(
            localized:
              "The notice doesn't say how many questions each subject has, so they're split evenly.",
            table: "Mock", comment: "Subjects split evenly")
          : String(
            localized:
              "The official guide doesn't say how many questions each part has, so they're split evenly.",
            table: "Mock", comment: "Parts split evenly")) : nil,
      source.formats == .even
        ? (notice
          ? String(
            localized:
              "The notice doesn't say how many questions each format has, so they're split evenly.",
            table: "Mock", comment: "Formats split evenly")
          : String(
            localized:
              "The official guide doesn't say how many questions each format has, so they're split evenly.",
            table: "Mock", comment: "Formats split evenly")) : nil,
      source.time == .unstated
        ? "\(notice ? String(localized: "The notice doesn't give the exam's time.", table: "Mock", comment: "No exam time in the notice") : String(localized: "The official guide doesn't give the exam's time.", table: "Mock", comment: "No exam time in the guide")) \(String(localized: "This mock gives \(time).", table: "Mock", comment: "The time limit this mock sets, since the exam's own time is unknown; the argument is a duration like '5 h'"))"
        : nil,
    ].compactMap { $0 }
  }
}
