import XCTest

@testable import Zoonk

/// Main's `groupSubjects`: the optional study the learner added sits under its own heading, last,
/// whether the exam's subjects come from its notice or from the plan's modules.
final class SyllabusGroupTests: XCTestCase {
  func testAPlansModulesAreOneGroupWithOptionalStudyAfterThem() throws {
    let syllabus = try syllabus(
      kind: "modules", subjects: [("Math", nil, false), ("Strategy", nil, true)])

    XCTAssertEqual(syllabus.subjectGroups.map(\.extra), [false, true])
    XCTAssertEqual(
      syllabus.subjectGroups.map { $0.subjects.map(\.name) }, [["Math"], ["Strategy"]])
  }

  func testANoticesUngroupedSubjectsLeadItsGroupsAndOptionalStudyComesLast() throws {
    let syllabus = try syllabus(
      kind: "notice",
      subjects: [
        ("Strategy", nil, true), ("Physics", "Day 2", false), ("Study skills", nil, false),
      ])

    XCTAssertEqual(syllabus.subjectGroups.map(\.name), [nil, "Day 2", nil])
    XCTAssertEqual(syllabus.subjectGroups.map(\.extra), [false, false, true])
  }

  private func syllabus(
    kind: String, subjects: [(name: String, group: String?, extra: Bool)]
  ) throws -> GoalSyllabus {
    let rows = subjects.enumerated().map { index, subject in
      """
      {"areas":[],"chapters":[],"displayWeight":null,"extra":\(subject.extra),
       "group":\(subject.group.map { "\"\($0)\"" } ?? "null"),"imageUrl":null,"key":"s\(index)",
       "lessonsDone":0,"lessonsKnown":0,"lessonsTotal":1,"mastery":null,"matrix":[],
       "name":"\(subject.name)","nextDate":null,"notPlannedReason":null,"preparation":null,
       "questions":null,"share":null,"sharedWith":[],"shortName":"\(subject.name)","source":"plan",
       "topicFrequencySource":null,"topics":[],"topicsKnown":null,"topicsStudied":null}
      """
    }

    return try JSONDecoder().decode(
      GoalSyllabus.self,
      from: Data(
        """
        {"courseWeights":null,"examDocument":"guide","fromMaterial":false,
         "goal":{"displayName":"Exam","id":"goal","kind":"exam","title":"Exam"},"hasNotice":false,
         "kind":"\(kind)","knownTopicsReturn":"practice","lessons":{"done":0,"known":0,"total":0},
         "noticeUrl":null,"passMarks":null,"questionsSource":null,"sharedExams":[],
         "subjects":[\(rows.joined(separator: ","))],"topicCount":0,"topicsMapped":false,
         "writtenPractice":null}
        """.utf8))
  }
}
