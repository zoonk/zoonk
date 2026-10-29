import XCTest

@testable import Zoonk

final class SyllabusSummaryTests: XCTestCase {
  func testAPlanOfModulesNamesHowManyAndTheFirstTwo() throws {
    let syllabus = try fixture(
      kind: "modules", topicsMapped: false,
      subjects: [subject("Shares and companies"), subject("Trading"), subject("Risk")])

    XCTAssertEqual(
      syllabusSummary(syllabus, dailyMinutes: 15), "3 modules · Shares and companies · Trading")
  }

  func testAnExamNoticeSaysWhatFitsWhenItsTopicsAreMapped() throws {
    let syllabus = try fixture(
      kind: "notice", topicsMapped: true,
      subjects: [
        subject("Math", topics: [topic("Fractions", status: "toStudy")]),
        subject(
          "Physics", topics: [topic("Waves", status: "notPlanned", notPlannedReason: "time")]),
      ])

    XCTAssertEqual(
      syllabusSummary(syllabus, dailyMinutes: 30),
      "2 subjects from the notice · 1 of 2 topics don't fit in 30 min a day")
  }

  private func subject(_ name: String, topics: [String] = []) -> String {
    """
    {"chapters":[],"key":"\(name)","lessonsDone":0,"lessonsKnown":0,"lessonsTotal":0,
    "name":"\(name)","nextDate":null,"notPlannedReason":null,"preparation":null,"questions":null,
    "shortName":"\(name)","source":"notice","topics":[\(topics.joined(separator: ","))]}
    """
  }

  private func topic(_ name: String, status: String, notPlannedReason: String? = nil) -> String {
    """
    {"chapters":[],"frequency":null,"heading":null,"name":"\(name)",
    "notPlannedReason":\(notPlannedReason.map { "\"\($0)\"" } ?? "null"),"status":"\(status)"}
    """
  }

  private func fixture(kind: String, topicsMapped: Bool, subjects: [String]) throws
    -> GoalSyllabus
  {
    let topicCount = subjects.joined().components(separatedBy: "\"status\"").count - 1
    let json = """
      {"examDocument":"notice","fromMaterial":false,"goal":{"kind":"exam"},"kind":"\(kind)",
      "lessons":{"done":0,"known":0,"total":0},"subjects":[\(subjects.joined(separator: ","))],
      "topicCount":\(topicCount),"topicsMapped":\(topicsMapped)}
      """
    return try JSONDecoder().decode(GoalSyllabus.self, from: Data(json.utf8))
  }
}
