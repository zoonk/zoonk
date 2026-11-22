import XCTest

@testable import Zoonk

/// A change that moves lessons both ways leads with what it does overall: more time that funds a
/// mock exam can move a few lessons out while adding many more.
final class PlanChangeEffectTests: XCTestCase {
  private let exam = PlanChangeOptions(dateKind: .exam)

  private func effect(added: Int, removed: Int) throws -> PlanEffect {
    try JSONDecoder().decode(
      PlanEffect.self,
      from: Data(
        #"""
        {"areaEnds":null,"areaLessons":null,"endDateAfter":null,"endDateBefore":null,
        "lessonsAdded":\#(added),"lessonsAddedEstimated":null,"lessonsLeftOut":null,
        "lessonsRemoved":\#(removed),"nextMock":null,"phaseEnds":null,"topicsAdded":null,
        "topicsLeftOut":null,"unwrittenLeftOut":null,"weeklyEvents":null}
        """#.utf8))
  }

  private func consequence(added: Int, removed: Int) throws -> PlanChangeConsequence? {
    PlanChangeEffect.consequence(
      try effect(added: added, removed: removed), exam, today: "2027-01-04")
  }

  func testLeadsWithTheLessonsAddedOverallWhenMoreComeThanGo() throws {
    XCTAssertEqual(
      try consequence(added: 102, removed: 12),
      PlanChangeConsequence(
        key: "added", text: "You'll study 90 more lessons before your exam.", whole: false))
  }

  func testSaysFewerOnlyWhenMoreLessonsGoThanCome() throws {
    XCTAssertEqual(
      try consequence(added: 3, removed: 10),
      PlanChangeConsequence(
        key: "notInPlan", text: "You'll study 7 fewer lessons before your exam.", whole: false))
    XCTAssertEqual(
      try consequence(added: 0, removed: 10),
      PlanChangeConsequence(
        key: "notInPlan", text: "You'll study 10 fewer lessons before your exam.", whole: true))
    XCTAssertEqual(
      try consequence(added: 10, removed: 0),
      PlanChangeConsequence(
        key: "added", text: "You'll study 10 more lessons before your exam.", whole: true))
  }

  func testSaysNoLessonChangeWhenAsManyComeAsGo() throws {
    XCTAssertNil(try consequence(added: 5, removed: 5))
  }
}
