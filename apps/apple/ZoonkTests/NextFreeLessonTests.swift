import XCTest

@testable import Zoonk

/// The day under used-up free lessons is the learner's own, whatever day it is in UTC.
final class NextFreeLessonTests: XCTestCase {
  /// Nov 13, 2026, 20:00 in São Paulo (23:00 UTC).
  private let now = Date(timeIntervalSince1970: 1_794_610_800)

  private var calendar: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "America/Sao_Paulo")!
    calendar.locale = Locale(identifier: "en_US")
    return calendar
  }

  private func day(_ opensAt: Date?) -> String? {
    HelpLimit.nextFreeLesson(opensAt, now: now, calendar: calendar).map { String(localized: $0) }
  }

  func testTheDayIsTheLearnersOwn() {
    let today = "Your next free lesson opens later today, or subscribe to keep going."
    let tomorrow = "Your next free lesson opens tomorrow, or subscribe to keep going."

    // 02:30 UTC on the 14th is still the 13th in São Paulo.
    XCTAssertEqual(day(Date(timeIntervalSince1970: 1_794_623_400)), today)
    XCTAssertEqual(day(Date(timeIntervalSince1970: 1_794_627_000)), tomorrow)
    XCTAssertEqual(
      day(Date(timeIntervalSince1970: 1_795_339_800)),
      "Your next free lesson opens on November 22, or subscribe to keep going.")
    XCTAssertNil(day(nil))
  }

  /// Seen on December 28, a day in January names its year.
  func testADayInAnotherYearNamesIt() throws {
    let lateDecember = try XCTUnwrap(
      calendar.date(from: DateComponents(year: 2026, month: 12, day: 28, hour: 10)))
    let january = try XCTUnwrap(
      calendar.date(from: DateComponents(year: 2027, month: 1, day: 4, hour: 9)))

    XCTAssertEqual(
      HelpLimit.nextFreeLesson(january, now: lateDecember, calendar: calendar)
        .map { String(localized: $0) },
      "Your next free lesson opens on January 4, 2027, or subscribe to keep going.")
  }

  func testAnOpenedLessonStopsPromisingADay() {
    let limit = HelpLimit.freeLessonsUsed(opensAt: Date(timeIntervalSince1970: 1_794_607_200))

    XCTAssertTrue(limit.freeLessonOpened(at: now))
    XCTAssertEqual(limit.lessonWords(now: now).said, "Your next free lesson is ready")
    XCTAssertNil(day(Date(timeIntervalSince1970: 1_794_607_200)))
  }

  /// The gate's one timer, stepped by hand: open at 23:59 with the lesson opening at noon.
  func testAGateLeftOpenAcrossMidnightFollowsTheDay() throws {
    let lateNight = try XCTUnwrap(
      calendar.date(from: DateComponents(year: 2026, month: 11, day: 13, hour: 23, minute: 59)))
    let noon = try XCTUnwrap(
      calendar.date(from: DateComponents(year: 2026, month: 11, day: 14, hour: 12)))
    let limit = HelpLimit.freeLessonsUsed(opensAt: noon)
    let wake = { (now: Date) in
      HelpLimit.nextWake(opensAt: noon, now: now, calendar: self.calendar)
    }
    let words = { (now: Date) in
      let words = limit.lessonWords(now: now, calendar: self.calendar)
      return [words.title, words.line].compactMap { $0.map { String(localized: $0) } }
    }

    XCTAssertEqual(
      words(lateNight),
      [
        "You've used your free lessons",
        "Your next free lesson opens tomorrow, or subscribe to keep going.",
      ])

    let midnight = try XCTUnwrap(wake(lateNight))
    XCTAssertEqual(midnight, calendar.startOfDay(for: noon))
    XCTAssertEqual(
      words(midnight),
      [
        "You've used your free lessons",
        "Your next free lesson opens later today, or subscribe to keep going.",
      ])

    let opening = try XCTUnwrap(wake(midnight))
    XCTAssertEqual(opening, noon)
    XCTAssertEqual(words(opening), ["Your next free lesson is ready"])
    XCTAssertNil(wake(opening))
  }

  /// The learner may still have lessons left, so a map's refusal never says they used them.
  func testAMapWhoseLessonsDontFitSaysWhenItFits() throws {
    let fits = try XCTUnwrap(
      calendar.date(from: DateComponents(year: 2026, month: 11, day: 22, hour: 9)))
    let dated = HelpLimit.freeLessonsUsed(opensAt: fits)
    let text = { (words: LimitWords) in
      [words.title, words.line].compactMap { $0.map { String(localized: $0) } }
    }

    XCTAssertEqual(
      text(dated.mapLessonsWords(now: now, calendar: calendar)),
      [
        "Not enough free lessons for this map yet",
        "You'll have enough on November 22, or subscribe to make it now.",
      ])
    XCTAssertEqual(
      text(dated.mapLessonsWords(now: fits, calendar: calendar)), ["You can make this map now"])
    XCTAssertEqual(
      text(HelpLimit.limitReached(period: .total, tier: .free).mapLessonsWords()),
      ["This map needs a subscription", "It writes more lessons than you get for free."])
  }

  func testNoLessonIsRefusedForTheMonth() {
    let words = HelpLimit.limitReached(period: .month, tier: .plus).lessonWords()

    XCTAssertEqual(words.title.map { String(localized: $0) }, "No more new lessons today")
    XCTAssertEqual(words.line.map { String(localized: $0) }, "More tomorrow.")
  }

  func testTheGateWithoutADaySaysNothingAboutOne() {
    let words = HelpLimit.freeLessonsUsed(opensAt: nil).lessonWords()

    XCTAssertEqual(words.said, "You've used your free lessons")
  }
}
