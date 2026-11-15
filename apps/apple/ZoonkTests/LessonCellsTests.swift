import XCTest

@testable import Zoonk

/// Main's `lesson-cells.test.ts`, its property run on a seeded generator.
final class LessonCellsTests: XCTestCase {
  private typealias State = LessonCells.State

  func testDrawsOneCellPerLessonStudiedKnownTodayThenTheRest() {
    XCTAssertEqual(
      LessonCells.of(studied: 2, known: 1, today: 2, total: 6),
      [.studied, .studied, .known, .today, .today, .rest])
  }

  func testKeepsOneCellPerLessonUpTo30() {
    XCTAssertEqual(LessonCells.of(studied: 6, known: 0, today: 2, total: 30).count, 30)
  }

  func testGivesLargerPlansWholeCellsEachStateTheLegendNamesAtLeastOne() {
    let cells = LessonCells.of(studied: 10, known: 4, today: 3, total: 227)

    XCTAssertEqual(cells.count, 29)
    XCTAssertEqual(Array(cells.prefix(4)), [.studied, .known, .today, .rest])
  }

  func testRoundsAStatesCellsToItsShareOfThePlan() {
    let cells = LessonCells.of(studied: 40, known: 0, today: 20, total: 300)

    XCTAssertEqual(cells.filter { $0 == .studied }.count, 4)
    XCTAssertEqual(cells.filter { $0 == .today }.count, 2)
  }

  func testKeepsAFewStudiedLessonsVisibleInALongPlan() {
    let cells = LessonCells.of(studied: 4, known: 0, today: 0, total: 300)

    XCTAssertEqual(cells.first, .studied)
    XCTAssertEqual(cells.filter { $0 == .studied }.count, 1)
  }

  func testKeepsTodaysCellWhenTheRestOfALongPlanIsDone() {
    let cells = LessonCells.of(studied: 88, known: 1, today: 1, total: 90)

    XCTAssertEqual(cells.filter { $0 == .studied }.count, 28)
    XCTAssertEqual(cells.filter { $0 == .known }.count, 1)
    XCTAssertEqual(cells.filter { $0 == .today }.count, 1)
  }

  func testGivesEveryStateWithLessonsACellInOrderAndNoneToAStateWithout() {
    var random = SeededRandom(seed: 0x5EED)

    for _ in 0..<2_000 {
      let lessons = (0..<4).map { _ in Int.random(in: 0...1000, using: &random) }
      let total = lessons.reduce(0, +)
      let cells = LessonCells.of(
        studied: lessons[0], known: lessons[1], today: lessons[2], total: total)
      let size = max(1, (total + 29) / 30)

      XCTAssertEqual(cells.count, total == 0 ? 0 : (total + size - 1) / size, "\(lessons)")
      XCTAssertLessThanOrEqual(cells.count, 30)
      XCTAssertEqual(cells, cells.sorted { $0.rawValue < $1.rawValue }, "\(lessons)")

      for state in State.allCases {
        XCTAssertEqual(
          cells.contains(state), lessons[state.rawValue] > 0, "\(state) in \(lessons)")
      }
    }
  }

  func testDrawsNothingForAPlanWithoutLessons() {
    XCTAssertEqual(LessonCells.of(studied: 0, known: 0, today: 0, total: 0), [])
  }
}

/// A fixed sequence, so a failure can be run again.
private struct SeededRandom: RandomNumberGenerator {
  var state: UInt64

  init(seed: UInt64) {
    state = seed
  }

  mutating func next() -> UInt64 {
    state = state &* 6_364_136_223_846_793_005 &+ 1_442_695_040_888_963_407
    return state
  }
}
