import XCTest

@testable import Zoonk

final class ScheduleTimeTests: XCTestCase {
  private typealias Line = ScheduleTime.Line

  private func everything(_ minutes: Int, split: DaySplit? = nil) -> TimeToCover.Suggested {
    .init(coveredShare: 1, everyTopic: true, kind: .everything, minutes: minutes, split: split)
  }

  private func focus(_ minutes: Int, everyTopic: Bool) -> TimeToCover.Suggested {
    .init(coveredShare: 0.32, everyTopic: everyTopic, kind: .focus, minutes: minutes, split: nil)
  }

  private func found(
    suggested: TimeToCover.Suggested? = .init(
      coveredShare: 1, everyTopic: true, kind: .everything, minutes: 35, split: nil),
    recommendedMinutes: Int? = 35,
    most: MostCoverage? = nil,
    pastDate: Bool = false
  ) -> TimeToCover {
    TimeToCover(
      fittingDate: nil, most: most, pastDate: pastDate, ready: true,
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

  private func plateauAt(_ minutes: Int) -> TimeToCover {
    found(
      suggested: focus(240, everyTopic: false), recommendedMinutes: nil,
      most: MostCoverage(coveredShare: 0.99, minutes: minutes))
  }

  private var noSuggestion: TimeToCover { found(suggested: nil, recommendedMinutes: nil) }

  private var passed: TimeToCover { found(suggested: nil, recommendedMinutes: nil, pastDate: true) }

  private func advice(_ share: Double? = 0.48, endDate: String? = nil) -> TimeAdvice {
    TimeAdvice(
      coveredShare: share, endDate: endDate, fullCourseEndDate: nil, ready: true)
  }

  private func line(
    advice: TimeAdvice? = nil,
    askFailed: Bool = false,
    dated: Bool = true,
    findFailed: Bool = false,
    found: TimeToCover?,
    hasDays: Bool = true,
    minutes: Int? = 35
  ) -> Line {
    ScheduleTime.line(
      advice: advice, askFailed: askFailed, dated: dated, findFailed: findFailed, found: found,
      hasDays: hasDays, minutes: minutes)
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

  func testAsksForAStudyDayBeforeAnythingElse() {
    XCTAssertEqual(line(found: found(), hasDays: false), .noDays)
  }

  func testSaysWhyTheSuggestedTimeWithoutAskingThePlanAgain() {
    XCTAssertEqual(line(found: found()), .everything(suggested: true))
    XCTAssertEqual(
      line(found: focusAt(805), minutes: 240), .focus(coveredShare: 0.32, everyTopic: false))
  }

  func testSaysWhatThePlansOwnTimeCoversBeforeTheTimeQuestionAnswers() {
    XCTAssertEqual(line(advice: advice(0.29), found: nil, minutes: 120), .share(0.29))
  }

  func testSaysWhatAnotherTimeCoversOnceThePlanAnswersForIt() {
    XCTAssertEqual(line(found: found(), minutes: 15), .asking)
    XCTAssertEqual(line(advice: advice(), found: found(), minutes: 15), .share(0.48))
    XCTAssertEqual(
      line(advice: advice(1), found: found(), minutes: 60), .everything(suggested: false))
  }

  func testSaysTheTimeIsBeingWorkedOutOrThatItCouldntBe() {
    XCTAssertEqual(line(found: nil, minutes: nil), .working)
    XCTAssertEqual(line(findFailed: true, found: nil, minutes: 15), .findFailed)
    XCTAssertEqual(line(askFailed: true, found: found(), minutes: 15), .askFailed)
  }

  func testSaysADateThatHasPassedInsteadOfWhatAnyTimeCovers() {
    XCTAssertEqual(line(found: passed), .pastDate)
  }

  func testSaysWhenAnUndatedGoalFinishesAtTheTimePicked() {
    XCTAssertEqual(line(dated: false, found: nil, minutes: 15), .asking)
    XCTAssertEqual(
      line(advice: advice(nil, endDate: "2027-03-15"), dated: false, found: nil, minutes: 15),
      .finish(endDate: "2027-03-15"))
    XCTAssertEqual(line(advice: advice(nil), dated: false, found: nil, minutes: 15), .noFinish)
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

  func testSaysWhatEverythingTakesOnlyBesideAFocusSuggestion() {
    let short = Line.share(0.15)

    XCTAssertNil(ScheduleTime.fullTimeNote(found: found(), line: short, studiesEveryDay: true))
    XCTAssertNil(ScheduleTime.fullTimeNote(found: passed, line: short, studiesEveryDay: true))
    XCTAssertEqual(
      ScheduleTime.fullTimeNote(found: focusAt(805), line: short, studiesEveryDay: true),
      .takes(.init(coveredShare: 1, everything: true, minutes: 805), moreDays: false))
  }

  func testSaysMoreStudyDaysHelpWhileSomeAreLeftEvenWhenNoDayCoversItAll() {
    XCTAssertEqual(
      ScheduleTime.fullTimeNote(found: focusAt(nil), line: .share(0.15), studiesEveryDay: false),
      .takes(nil, moreDays: true))
  }

  func testSaysTheTimeShownIsMoreThanMostPeopleKeepUpOnceItCoversEverything() {
    XCTAssertEqual(
      ScheduleTime.fullTimeNote(
        found: focusAt(805), line: .everything(suggested: false), studiesEveryDay: true),
      .tooLong)
  }

  func testSaysWhatTheMostAnyTimeCoversTakesWithoutMoreStudyDaysWhenPartNeverFits() {
    XCTAssertEqual(
      ScheduleTime.fullTimeNote(found: plateauAt(480), line: .share(0.5), studiesEveryDay: false),
      .takes(.init(coveredShare: 0.99, everything: false, minutes: 480), moreDays: false))
    XCTAssertEqual(
      ScheduleTime.offer(found: plateauAt(480), line: .share(0.5), minutes: 240),
      .init(kind: .full, minutes: 480))
    XCTAssertEqual(
      ScheduleTime.offer(found: plateauAt(480), line: .share(0.3), minutes: 120),
      .init(kind: .focus, minutes: 240))
  }

  func testSaysNothingMoreOnceTheSuggestionAlreadyCoversTheMost() {
    let found = found(
      suggested: .init(
        coveredShare: 0.99, everyTopic: true, kind: .focus, minutes: 195, split: nil),
      recommendedMinutes: nil, most: MostCoverage(coveredShare: 0.99, minutes: 195))
    let line = line(found: found, minutes: 195)

    XCTAssertNil(ScheduleTime.fullTimeNote(found: found, line: line, studiesEveryDay: false))
    XCTAssertNil(ScheduleTime.offer(found: found, line: line, minutes: 195))
  }

  func testMarksOnlyATimeThatCoversEverythingAsCoveringEverything() {
    XCTAssertEqual(ScheduleTime.markedTimes(plateauAt(480)).full, nil)
    XCTAssertEqual(ScheduleTime.markedTimes(plateauAt(480)).suggested, 240)
    XCTAssertEqual(ScheduleTime.markedTimes(focusAt(805)).full, 805)
    XCTAssertEqual(ScheduleTime.markedTimes(found()).full, nil)
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

  func testSaysCoresSplitOfTheTimeShownWithoutWaitingForAnAnswerAboutIt() {
    let choices = [
      TimeChoice(minutes: 30, split: DaySplit(mine: 20, others: 1, rest: 10)),
      TimeChoice(minutes: 45, split: DaySplit(mine: 30, others: 1, rest: 15)),
    ]
    let split = DaySplit(mine: 25, others: 1, rest: 10)
    let suggested = found(suggested: everything(35, split: split))
    let later = found(suggested: everything(60))

    XCTAssertEqual(ScheduleTime.split(minutes: 45, choices: choices, answers: []), choices[1].split)
    XCTAssertEqual(
      ScheduleTime.split(minutes: 35, choices: choices, answers: [later, suggested]), split)
    XCTAssertNil(ScheduleTime.split(minutes: 50, choices: choices, answers: [suggested]))
    XCTAssertNil(ScheduleTime.split(minutes: nil, choices: choices, answers: [suggested]))
  }

  func testOffersTheSuggestionBackOnlyWhileAnotherTimeFallsShort() {
    let short = Line.share(0.48)

    XCTAssertNil(ScheduleTime.offer(found: found(), line: short, minutes: 35))
    XCTAssertEqual(
      ScheduleTime.offer(found: found(), line: short, minutes: 15),
      .init(kind: .everything, minutes: 35))
    XCTAssertNil(
      ScheduleTime.offer(
        found: everythingAt(240), line: .everything(suggested: false), minutes: 900))
  }

  func testOffersWhatCoversEverythingBesideAFocusAndTheFocusBesideAnyOtherTime() {
    let focus = line(found: focusAt(805), minutes: 240)

    XCTAssertEqual(
      ScheduleTime.offer(found: focusAt(805), line: focus, minutes: 240),
      .init(kind: .full, minutes: 805))
    XCTAssertEqual(
      ScheduleTime.offer(found: focusAt(805), line: .everything(suggested: false), minutes: 805),
      .init(kind: .focus, minutes: 240))
    XCTAssertEqual(
      ScheduleTime.offer(found: focusAt(805), line: .share(0.48), minutes: 120),
      .init(kind: .focus, minutes: 240))
    XCTAssertNil(ScheduleTime.offer(found: focusAt(nil), line: focus, minutes: 240))
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

  func testOffersCoresTimesWithTheTimesShown() {
    XCTAssertEqual(ScheduleTime.dailyTimes([15, 30, 45], with: 35, 30, nil), [15, 30, 35, 45])
  }

  func testOpensOnMondayToFridayUnlessTheGoalHasFewerDays() {
    XCTAssertEqual(ScheduleTime.startingDays([]), [1, 2, 3, 4, 5])
    XCTAssertEqual(ScheduleTime.startingDays(ScheduleTime.everyDay), [1, 2, 3, 4, 5])
    XCTAssertEqual(ScheduleTime.startingDays([6, 0]), [0, 6])
  }
}
