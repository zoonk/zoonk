import XCTest

@testable import Zoonk

final class PlanChapterWindowTests: XCTestCase {
  func testItStartsOneRowBeforeTheNextChapterSoTheNextOneStaysInSight() {
    XCTAssertEqual(
      planChapterWindow(states: [
        .done, .done, .done, .done, .done, .current, .upcoming, .upcoming, .upcoming,
      ]), 4..<8)
  }

  func testItFollowsTheChapterTheLearnerIsInWhenDoneAndOpenChaptersInterleave() {
    XCTAssertEqual(
      planChapterWindow(states: [
        .upcoming, .done, .upcoming, .done, .done, .upcoming, .current, .upcoming,
      ]), 4..<8)
  }

  func testItStartsAtTheTopWhenTheNextChapterIsTheFirst() {
    XCTAssertEqual(
      planChapterWindow(states: [.current, .upcoming, .upcoming, .upcoming, .upcoming]), 0..<4)
  }

  func testItFillsTheWindowBackFromTheEndNearThePhasesLastChapters() {
    XCTAssertEqual(
      planChapterWindow(states: [.done, .done, .done, .done, .done, .done, .current]), 3..<7)
  }

  func testItShowsTheFirstChaptersOfAFinishedPhaseAndEveryChapterOfAShortOne() {
    XCTAssertEqual(planChapterWindow(states: [.done, .done, .done, .done, .done]), 0..<4)
    XCTAssertEqual(planChapterWindow(states: [.done, .current]), 0..<2)
  }

  func testItStartsBeforeAnUpcomingChapterInAPhaseNotReachedYet() {
    XCTAssertEqual(planChapterWindow(states: [.upcoming, .upcoming]), 0..<2)
  }
}
