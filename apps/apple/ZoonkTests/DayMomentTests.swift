import XCTest

@testable import Zoonk

final class DayMomentTests: XCTestCase {
  func testJustDoneAreTheMissionsThisResultCompleted() throws {
    let moment = try missionMoment(completed: ["review", "practice"], paid: false)

    XCTAssertEqual(moment.justDone.map(\.kind), [.review], "practice isn't done yet")
    XCTAssertEqual(moment.left, 1)
    XCTAssertTrue(moment.isShown)
    XCTAssertFalse(moment.isPayoff)
  }

  func testAResultThatCompletedNothingHasNoMoment() throws {
    let moment = try missionMoment(completed: [], paid: false)

    XCTAssertFalse(moment.isShown)
  }

  func testTheTrackFillsEachJustDoneMissionFromTheStepBeforeIt() throws {
    let moment = try missionMoment(completed: ["fixMistake"], paid: false)
    let before = Dictionary(uniqueKeysWithValues: moment.before.map { ($0.kind, $0.done) })

    XCTAssertEqual(before[.fixMistake], 1, "two mistakes to fix, the second just now")
    XCTAssertEqual(before[.review], 1, "done earlier, it stays full")
    XCTAssertEqual(before[.practice], 0)
  }

  func testThePayoffIsEveryMissionDoneWithTheBonusPaid() throws {
    let moment = try missionMoment(completed: ["practice"], paid: true, allDone: true)

    XCTAssertTrue(moment.isPayoff)
    XCTAssertEqual(moment.left, 0)
  }

  private func missionMoment(
    completed: [String], paid: Bool, allDone: Bool = false
  ) throws -> DayResult.MissionMoment {
    let open = allDone ? "done" : "todo"
    let kinds = completed.map { "\"\($0)\"" }.joined(separator: ", ")
    let json = """
      {"completed": [\(kinds)], "fullMeal": {"bonus": 50, "paid": \(paid)},
       "missions": [
         \(mission("review", done: 1, total: 1, status: "done")),
         \(mission("fixMistake", done: 2, total: 2, status: "done")),
         \(mission("practice", done: allDone ? 1 : 0, total: 1, status: open))]}
      """
    return try JSONDecoder().decode(DayResult.MissionMoment.self, from: Data(json.utf8))
  }

  private func mission(_ kind: String, done: Int, total: Int, status: String) -> String {
    """
    {"detail": null, "done": \(done), "kind": "\(kind)", "minutes": null, "opens": null,
     "status": "\(status)", "total": \(total), "waitReason": null}
    """
  }
}
