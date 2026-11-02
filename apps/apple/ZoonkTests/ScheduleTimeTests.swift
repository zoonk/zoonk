import XCTest

@testable import Zoonk

final class ScheduleTimeTests: XCTestCase {
  private typealias Line = ScheduleTime.Line

  private func everything(_ minutes: Int) -> TimeToCover.Suggested {
    .init(coveredShare: 1, everyTopic: true, kind: .everything, minutes: minutes, split: nil)
  }

  private func focus(_ minutes: Int, everyTopic: Bool) -> TimeToCover.Suggested {
    .init(coveredShare: 0.32, everyTopic: everyTopic, kind: .focus, minutes: minutes, split: nil)
  }

  private func found(
    suggested: TimeToCover.Suggested? = .init(
      coveredShare: 1, everyTopic: true, kind: .everything, minutes: 35, split: nil),
    recommendedMinutes: Int? = 35,
    pastDate: Bool = false
  ) -> TimeToCover {
    TimeToCover(
      fittingDate: nil, most: nil, pastDate: pastDate, readingNotice: false, ready: true,
      recommendedMinutes: recommendedMinutes, suggested: suggested, targetDate: "2028-10-29",
      targetDateNamedMonth: false)
  }

  private func everythingAt(_ minutes: Int) -> TimeToCover {
    found(suggested: everything(minutes), recommendedMinutes: minutes)
  }

  /// 240 minutes a day, which covers 32% in depth; nil when not even a whole day covers everything.
  private func focusAt(_ recommendedMinutes: Int?) -> TimeToCover {
    found(suggested: focus(240, everyTopic: false), recommendedMinutes: recommendedMinutes)
  }

  private var noSuggestion: TimeToCover { found(suggested: nil, recommendedMinutes: nil) }

  private var passed: TimeToCover { found(suggested: nil, recommendedMinutes: nil, pastDate: true) }

  private func line(found: TimeToCover?, minutes: Int? = 35) -> Line {
    ScheduleTime.line(
      advice: nil, askFailed: false, dated: true, findFailed: false, found: found, hasDays: true,
      minutes: minutes)
  }

  private func shown(
    first: TimeToCover?,
    found: TimeToCover?,
    picked: Int? = nil,
    settled: Bool = false
  ) -> Int? {
    ScheduleTime.shownMinutes(
      fallback: 60, first: first, found: found, picked: picked, settled: settled)
  }

  func testShowsNoTimeWhileTheFirstTimeADatedGoalNeedsIsWorkedOut() {
    XCTAssertNil(shown(first: nil, found: nil))
  }

  func testStartsOnTheSuggestionAndFollowsItAsTheDaysChange() {
    XCTAssertEqual(shown(first: found(), found: found()), 35)
    XCTAssertEqual(shown(first: found(), found: everythingAt(30)), 30)
  }

  func testKeepsTheFirstSuggestionWhenOtherDaysHaveNone() {
    XCTAssertEqual(shown(first: found(), found: noSuggestion), 35)
  }

  func testKeepsTheLearnersOwnTimeOverTheSuggestion() {
    XCTAssertEqual(shown(first: found(), found: found(), picked: 90), 90)
  }

  func testKeepsTheScreensOwnTimeWhenItStartedWithoutASuggestion() {
    XCTAssertEqual(shown(first: noSuggestion, found: noSuggestion), 60)
    XCTAssertEqual(shown(first: noSuggestion, found: found()), 60)
  }

  func testFallsBackToTheScreensOwnTimeWhenNoSuggestionComes() {
    XCTAssertEqual(shown(first: passed, found: passed), 60)
    XCTAssertEqual(shown(first: nil, found: nil, settled: true), 60)
  }

  func testPickingTheSuggestionBackFollowsItAgain() {
    XCTAssertNil(ScheduleTime.pickedMinutes(first: found(), found: found(), minutes: 35))
    XCTAssertEqual(ScheduleTime.pickedMinutes(first: found(), found: found(), minutes: 30), 30)
  }

  func testKeepsTheSuggestionAsTheLearnersOwnOnAScreenThatStartedWithoutOne() {
    XCTAssertEqual(ScheduleTime.pickedMinutes(first: noSuggestion, found: found(), minutes: 35), 35)
  }

  func testAsksAboutEveryTimeButTheSuggestedOne() {
    func asks(dated: Bool = true, found: TimeToCover?, fullCourse: Bool = false, minutes: Int? = 35)
      -> Bool
    {
      ScheduleTime.asksAboutTime(
        dated: dated, found: found, fullCourse: fullCourse, minutes: minutes)
    }

    XCTAssertFalse(asks(found: found()))
    XCTAssertTrue(asks(found: found(), minutes: 30))
    XCTAssertTrue(asks(found: found(), fullCourse: true))
    XCTAssertTrue(asks(dated: false, found: nil))
    XCTAssertFalse(asks(found: nil))
    XCTAssertFalse(asks(found: found(), minutes: nil))
    XCTAssertFalse(asks(found: passed))
  }

  func testOpensOnTheFocusSuggestionWhenCoveringEverythingTakesLonger() {
    XCTAssertEqual(shown(first: focusAt(805), found: focusAt(805)), 240)
  }

  func testWaitsForTheNewDaysSuggestionUnlessTheLearnerPickedATime() {
    let first = everythingAt(35)

    XCTAssertTrue(
      ScheduleTime.waitsForSuggestion(failed: false, first: first, found: nil, picked: nil))
    XCTAssertFalse(
      ScheduleTime.waitsForSuggestion(failed: false, first: first, found: nil, picked: 60))
    XCTAssertFalse(
      ScheduleTime.waitsForSuggestion(failed: true, first: first, found: nil, picked: nil))
    XCTAssertFalse(
      ScheduleTime.waitsForSuggestion(failed: false, first: first, found: first, picked: nil))
    XCTAssertFalse(
      ScheduleTime.waitsForSuggestion(
        failed: false, first: found(suggested: nil), found: nil, picked: nil))
  }

  func testWaitsToSaveWhileTheScreenWorksOutATimeTheLearnerDidntPick() {
    XCTAssertTrue(ScheduleTime.waitsToSave(line: .asking, picked: nil))
    XCTAssertTrue(ScheduleTime.waitsToSave(line: .working, picked: nil))
    XCTAssertFalse(ScheduleTime.waitsToSave(line: .asking, picked: 830))
    XCTAssertFalse(ScheduleTime.waitsToSave(line: .share(0.4), picked: nil))
    XCTAssertFalse(ScheduleTime.waitsToSave(line: .findFailed, picked: nil))
  }

  func testContinueWaitsWhileNewDaysSuggestionIsWorkedOutUnlessTheLearnerPickedATime() {
    let first = everythingAt(35)
    let minutes = shown(first: first, found: first)
    let pending = line(found: nil, minutes: minutes)

    XCTAssertEqual(minutes, 35, "the old suggestion stays on screen")
    XCTAssertFalse(
      ScheduleTime.canContinue(hasDays: true, minutes: minutes, line: pending, picked: nil))
    XCTAssertTrue(
      ScheduleTime.canContinue(
        hasDays: true, minutes: 60, line: line(found: nil, minutes: 60), picked: 60))
    XCTAssertTrue(
      ScheduleTime.canContinue(hasDays: true, minutes: 35, line: line(found: first), picked: nil))
    XCTAssertFalse(
      ScheduleTime.canContinue(hasDays: false, minutes: 35, line: .noDays, picked: 35))
  }

  func testKeepsTheLastAnswerInPlaceWhileNewDaysAreWorkedOut() {
    let settled = ScheduleTime.Answer(found: found(), line: .share(0.4))
    let working = ScheduleTime.Answer(found: nil, line: .working)
    let now = ScheduleTime.Answer(found: found(), line: .everything(suggested: true))

    XCTAssertEqual(ScheduleTime.shownAnswer(last: settled, now: working).answer, settled)
    XCTAssertTrue(ScheduleTime.shownAnswer(last: settled, now: working).updating)
    XCTAssertEqual(ScheduleTime.shownAnswer(last: working, now: working).answer, working)
    XCTAssertFalse(ScheduleTime.shownAnswer(last: working, now: working).updating)
    XCTAssertEqual(ScheduleTime.shownAnswer(last: settled, now: now).answer, now)
    XCTAssertFalse(ScheduleTime.shownAnswer(last: settled, now: now).updating)
  }

  func testKeepsAnExamsChoiceToStudyEverythingUntilTheTimeCoversItAll() {
    XCTAssertTrue(ScheduleTime.keepsFullCourse(checked: true, line: .asking))
    XCTAssertFalse(ScheduleTime.keepsFullCourse(checked: true, line: .everything(suggested: false)))
    XCTAssertFalse(ScheduleTime.keepsFullCourse(checked: false, line: .share(0.4)))
  }

  func testAsksAboutAWeekendTimeOfItsOwnOnlyWhereItDiffers() {
    XCTAssertEqual(
      ScheduleTime.studyWeek(days: [1, 6], minutes: 30, weekend: 30, fullCourse: false),
      ScheduleWeek(studyDays: [1, 6]))
    XCTAssertEqual(
      ScheduleTime.studyWeek(days: [1, 6], minutes: 30, weekend: 60, fullCourse: true),
      ScheduleWeek(studyDays: [1, 6], weekendMinutes: 60, fullCourse: true))
    XCTAssertEqual(
      ScheduleTime.findWeek(days: [0, 6], weekend: 30),
      ScheduleWeek(studyDays: [0, 6], weekendMinutes: 30))
  }

  private let ready = PlanReadiness(ready: true, readingNotice: false)
  private let building = PlanReadiness(ready: false, readingNotice: false)
  private let reading = PlanReadiness(ready: false, readingNotice: true)

  private func wait(
    opened: PlanReadiness, last: PlanReadiness? = nil, runEnded: Bool = false
  ) -> ScheduleTime.Wait? {
    ScheduleTime.wait(opened: opened, last: last, runEnded: runEnded)
  }

  func testOpensOnTheScreenTheOnboardingViewSays() {
    XCTAssertNil(wait(opened: ready))
    XCTAssertEqual(wait(opened: building), .building)
    XCTAssertEqual(wait(opened: reading), .readingNotice)
  }

  /// A run that ended long ago replays at once, while the plan may still owe placement.
  func testARunThatEndedWaitsForThePlansFirstAnswer() {
    XCTAssertEqual(wait(opened: building, runEnded: true), .building)
  }

  func testFollowsThePlansAnswersOnceOneCame() {
    XCTAssertNil(wait(opened: building, last: ready))
    XCTAssertEqual(wait(opened: ready, last: reading), .readingNotice)
    XCTAssertEqual(wait(opened: reading, last: building), .building)
  }

  func testAsksOnceTheRunEndedWhileThePlanStillWorksTheTimeOut() {
    XCTAssertNil(wait(opened: building, last: building, runEnded: true))
    XCTAssertEqual(wait(opened: building, last: reading, runEnded: true), .readingNotice)
  }
}
