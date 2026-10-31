import XCTest

@testable import Zoonk

final class PlanEffectLinesTests: XCTestCase {
  private func effect(
    added: Int = 0, removed: Int = 0, estimated: Bool? = nil, endBefore: String? = nil,
    endAfter: String? = nil, nextMock: PlanEffect.Move<String>? = nil,
    phaseEnds: [PlanEffect.NamedMove]? = nil
  ) -> PlanEffect {
    PlanEffect(
      areaEnds: nil, areaLessons: nil, endDateAfter: endAfter, endDateBefore: endBefore,
      lessonsAdded: added, lessonsAddedEstimated: estimated, lessonsLeftOut: nil,
      lessonsRemoved: removed, nextMock: nextMock, phaseEnds: phaseEnds, topicsAdded: nil,
      topicsLeftOut: nil, unwrittenLeftOut: nil, weeklyEvents: nil)
  }

  private func kinds(_ lines: [PlanEffectLine]) -> [PlanEffectLine.Kind] {
    lines.map(\.kind)
  }

  func testNoEffectHasNoLines() {
    XCTAssertEqual(PlanEffectLines.lines(nil, today: "2026-10-30"), [])
    XCTAssertEqual(PlanEffectLines.lines(effect(), today: "2026-10-30"), [])
  }

  func testLessonsLeftOutComeBeforeLessonsAddedAsBadThenGoodNews() {
    let lines = PlanEffectLines.lines(effect(added: 4, removed: 2), today: "2026-10-30")

    XCTAssertEqual(kinds(lines), [.removed, .added])
    XCTAssertEqual(lines.map(\.tone), [.bad, .good])
  }

  func testAnEndMovingByADayBesideLessonsReadsAsRoundingAndIsHidden() {
    let rounding = effect(added: 3, endBefore: "2026-12-01", endAfter: "2026-12-02")
    let moved = effect(added: 3, endBefore: "2026-12-01", endAfter: "2026-12-09")
    let alone = effect(endBefore: "2026-12-01", endAfter: "2026-12-02")

    XCTAssertEqual(kinds(PlanEffectLines.lines(rounding, today: "2026-10-30")), [.added])
    XCTAssertEqual(
      kinds(PlanEffectLines.lines(moved, today: "2026-10-30")), [.added, .removed, .added])
    XCTAssertEqual(kinds(PlanEffectLines.lines(alone, today: "2026-10-30")), [.removed, .added])
  }

  func testMovesThatStayOnTheSameDayAddNothing() {
    let same = effect(
      nextMock: .init(after: "2026-11-08", before: "2026-11-08"),
      phaseEnds: [.init(after: "2026-11-20", before: "2026-11-20", name: "Basics")])
    let moved = effect(
      nextMock: .init(after: "2026-11-08", before: "2026-11-01"),
      phaseEnds: [.init(after: "2026-11-27", before: "2026-11-20", name: "Basics")])

    XCTAssertEqual(PlanEffectLines.lines(same, today: "2026-10-30"), [])
    XCTAssertEqual(
      kinds(PlanEffectLines.lines(moved, today: "2026-10-30")),
      [.removed, .added, .removed, .added])
  }

  func testTopicsDropTheNoticesItemNumbers() {
    XCTAssertEqual(planTopicWords("12 Noções de probabilidade"), "Noções de probabilidade")
    XCTAssertEqual(planTopicWords("5.7. Funções"), "Funções")
    XCTAssertEqual(planTopicWords("H18 - Identify the main idea"), "Identify the main idea")
    XCTAssertEqual(planTopicWords("2026 in numbers"), "2026 in numbers")
  }
}
