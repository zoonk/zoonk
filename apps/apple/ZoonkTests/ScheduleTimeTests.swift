import XCTest

@testable import Zoonk

final class ScheduleTimeTests: XCTestCase {
  private typealias Line = ScheduleTime.Line

  private func found(
    suggested: TimeToCover.Suggested? = .init(kind: .everything, minutes: 35, split: nil),
    recommendedMinutes: Int? = 35,
    pastDate: Bool = false
  ) -> TimeToCover {
    TimeToCover(
      pastDate: pastDate, ready: true, recommendedMinutes: recommendedMinutes,
      suggested: suggested, targetDate: "2028-10-29", targetDateNamedMonth: false)
  }

  private func everythingAt(_ minutes: Int) -> TimeToCover {
    found(
      suggested: .init(kind: .everything, minutes: minutes, split: nil),
      recommendedMinutes: minutes)
  }

  private func everyTopicAt(_ minutes: Int) -> TimeToCover {
    found(
      suggested: .init(kind: .everyTopic, minutes: minutes, split: nil), recommendedMinutes: nil)
  }

  private var tooClose: TimeToCover { found(suggested: nil, recommendedMinutes: nil) }

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
    XCTAssertEqual(shown(first: found(), found: tooClose), 35)
  }

  func testKeepsTheLearnersOwnTimeOverTheSuggestion() {
    XCTAssertEqual(shown(first: found(), found: found(), picked: 90), 90)
  }

  func testKeepsTheScreensOwnTimeWhenItStartedWithoutASuggestion() {
    XCTAssertEqual(shown(first: tooClose, found: tooClose), 60)
    XCTAssertEqual(shown(first: tooClose, found: found()), 60)
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
    XCTAssertEqual(ScheduleTime.pickedMinutes(first: tooClose, found: found(), minutes: 35), 35)
  }

  func testAsksForAStudyDayBeforeAnythingElse() {
    XCTAssertEqual(line(found: found(), hasDays: false), .noDays)
  }

  func testSaysWhyTheSuggestedTimeWithoutAskingThePlanAgain() {
    XCTAssertEqual(line(found: found()), .everything(suggested: true))
    XCTAssertEqual(line(found: everyTopicAt(45), minutes: 45), .everyTopic)
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

  func testSaysWhyOnlyWhenNotEvenAWholeDayCoversEverything() {
    let short = Line.share(0.15)

    func why(_ found: TimeToCover, line: Line = short) -> ScheduleTime.TooClose? {
      ScheduleTime.tooClose(found: found, line: line, studiesEveryDay: true)
    }

    XCTAssertNil(why(found()))
    XCTAssertNil(why(passed))
    XCTAssertEqual(why(tooClose), .date)
    XCTAssertEqual(why(everyTopicAt(45)), .date)
    XCTAssertNil(why(tooClose, line: .everything(suggested: false)))
  }

  func testOpensOnTheTimeThatReachesEveryTopicWhenNoDayHoldsEverything() {
    let longest = everyTopicAt(600)

    XCTAssertEqual(
      ScheduleTime.shownMinutes(
        fallback: 30, first: longest, found: longest, picked: nil, settled: false),
      600)
    XCTAssertEqual(
      ScheduleTime.tooClose(found: longest, line: .everyTopic, studiesEveryDay: false), .days)
  }

  func testBlamesTheDaysUntilEveryDayIsAStudyDay() {
    let fewerDays = ScheduleTime.tooClose(
      found: tooClose, line: .share(0.15), studiesEveryDay: false)

    XCTAssertEqual(fewerDays, .days)
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
    let suggested = found(suggested: .init(kind: .everything, minutes: 35, split: split))
    let later = found(suggested: .init(kind: .everything, minutes: 60, split: nil))

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
      .init(kind: .everything, minutes: 35, split: nil))
    XCTAssertNil(
      ScheduleTime.offer(
        found: everyTopicAt(240), line: .everything(suggested: false), minutes: 900)
    )
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

  func testOffersEachQuarterHourToFourHoursThenEachHalfHourWithTheTimesShown() {
    let times = ScheduleTime.dailyTimes(with: 35, 240, nil)

    XCTAssertEqual(Array(times.prefix(4)), [15, 30, 35, 45])
    XCTAssertEqual(times.filter { (240...300).contains($0) }, [240, 270, 300])
    XCTAssertEqual(times.last, 1440)
  }

  func testOffersCoresTimesWithTheTimesShown() {
    let choices = [15, 30, 45].map { TimeChoice(minutes: $0, split: nil) }

    XCTAssertEqual(ScheduleTime.dailyTimes(choices, with: 35, 30, nil), [15, 30, 35, 45])
  }

  func testOpensOnMondayToFridayUnlessTheGoalHasFewerDays() {
    XCTAssertEqual(ScheduleTime.startingDays([]), [1, 2, 3, 4, 5])
    XCTAssertEqual(ScheduleTime.startingDays(ScheduleTime.everyDay), [1, 2, 3, 4, 5])
    XCTAssertEqual(ScheduleTime.startingDays([6, 0]), [0, 6])
  }
}
