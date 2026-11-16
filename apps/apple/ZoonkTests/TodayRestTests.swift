import XCTest

@testable import Zoonk

/// What Today offers when core says its goal isn't active (main's `TodayGoalPaused`): a paused goal
/// by name with Resume, a finished one with a new goal, and a goal gone from the learner's goals
/// (archived) the start of a goal, never "paused" with nothing to resume.
final class TodayRestTests: XCTestCase {
  func testAPausedGoalIsNamedAndResumed() {
    let paused = goal(.paused)

    XCTAssertEqual(TodayRest(activeGoalID: "g1", goals: [paused]), .paused(paused))
  }

  func testAFinishedGoalLeadsToANewOne() {
    let finished = goal(.completed)

    XCTAssertEqual(TodayRest(activeGoalID: "g1", goals: [finished]), .finished(finished))
  }

  func testAGoalNoLongerAmongTheLearnersGoalsStartsAGoal() {
    XCTAssertEqual(TodayRest(activeGoalID: "g1", goals: [goal(.paused, id: "g2")]), .startGoal)
    XCTAssertEqual(TodayRest(activeGoalID: nil, goals: []), .startGoal)
  }

  private func goal(_ status: LearnerGoal.Status, id: String = "g1") -> LearnerGoal {
    LearnerGoal(
      dailyMinutes: 15, id: id, kind: .learn, language: "en", status: status, targetDate: nil,
      displayName: "Spanish", title: "Spanish")
  }
}
