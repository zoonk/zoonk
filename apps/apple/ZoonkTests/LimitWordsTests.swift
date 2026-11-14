import XCTest

@testable import Zoonk

/// Every monthly cap reads the same: what ran out, then the day more comes back, by the learner's
/// own clock, whatever day it is in UTC.
final class LimitWordsTests: XCTestCase {
  /// Nov 13, 2026, 20:00 in São Paulo (23:00 UTC).
  private let now = Date(timeIntervalSince1970: 1_794_610_800)

  private var calendar: Calendar {
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = TimeZone(identifier: "America/Sao_Paulo")!
    calendar.locale = Locale(identifier: "en_US")
    return calendar
  }

  private func text(_ words: LimitWords) -> [String] {
    [words.title, words.line].compactMap { $0.map { String(localized: $0) } }
  }

  private func lessons(_ availableAt: Date?, now: Date? = nil) -> [String] {
    text(
      HelpLimit.usedUp(tier: .free, availableAt: availableAt)
        .words(.lessons, now: now ?? self.now, calendar: calendar))
  }

  func testTheDayIsTheLearnersOwn() {
    let title = "You've used your free lessons"

    // 02:30 UTC on the 14th is still the 13th in São Paulo.
    XCTAssertEqual(
      lessons(Date(timeIntervalSince1970: 1_794_623_400)),
      [title, "More later today, or subscribe to keep going."])
    XCTAssertEqual(
      lessons(Date(timeIntervalSince1970: 1_794_627_000)),
      [title, "More tomorrow, or subscribe to keep going."])
    XCTAssertEqual(
      lessons(Date(timeIntervalSince1970: 1_795_339_800)),
      [title, "More on November 22, or subscribe to keep going."])
    XCTAssertEqual(lessons(nil), [title])
  }

  /// Seen on December 28, a day in January names its year.
  func testADayInAnotherYearNamesIt() throws {
    let lateDecember = try XCTUnwrap(
      calendar.date(from: DateComponents(year: 2026, month: 12, day: 28, hour: 10)))
    let january = try XCTUnwrap(
      calendar.date(from: DateComponents(year: 2027, month: 1, day: 4, hour: 9)))

    XCTAssertEqual(
      lessons(january, now: lateDecember),
      ["You've used your free lessons", "More on January 4, 2027, or subscribe to keep going."])
  }

  /// The buddy's messages run out for a subscriber too, who's never offered a subscription.
  func testAnotherGateTakesTheSameDay() {
    let later = Date(timeIntervalSince1970: 1_795_339_800)
    let messages = { (tier: LearnerTier) in
      self.text(
        HelpLimit.usedUp(tier: tier, availableAt: later)
          .words(.messages, now: self.now, calendar: self.calendar))
    }

    XCTAssertEqual(
      messages(.free),
      ["You've used your messages", "More on November 22, or subscribe to keep going."])
    XCTAssertEqual(messages(.plus), ["You've used your messages", "More on November 22."])
    XCTAssertEqual(
      HelpLimit.usedUp(tier: .free, availableAt: later)
        .words(.goals, now: now, calendar: calendar).said,
      "You've started all the new goals you can. More on November 22, or subscribe to keep going.")
  }

  func testTheDayThatCameStopsPromisingOne() {
    let passed = Date(timeIntervalSince1970: 1_794_607_200)

    XCTAssertEqual(lessons(passed), ["Your next free lesson is ready"])
    XCTAssertEqual(
      text(
        HelpLimit.usedUp(tier: .free, availableAt: passed)
          .words(.messages, now: now, calendar: calendar)),
      ["You've used your messages", "You can try again now."])
  }

  func testADaysCapComesBackTomorrow() {
    XCTAssertEqual(
      text(HelpLimit.limitReached(period: .day, tier: .plus).words(.messages)),
      ["No more messages today", "More tomorrow."])
  }

  /// The gate's one timer, stepped by hand: open at 23:59 with the lesson opening at noon.
  func testAGateLeftOpenAcrossMidnightFollowsTheDay() throws {
    let lateNight = try XCTUnwrap(
      calendar.date(from: DateComponents(year: 2026, month: 11, day: 13, hour: 23, minute: 59)))
    let noon = try XCTUnwrap(
      calendar.date(from: DateComponents(year: 2026, month: 11, day: 14, hour: 12)))
    let wake = { (now: Date) in
      HelpLimit.nextWake(availableAt: noon, now: now, calendar: self.calendar)
    }

    XCTAssertEqual(
      lessons(noon, now: lateNight),
      ["You've used your free lessons", "More tomorrow, or subscribe to keep going."])

    let midnight = try XCTUnwrap(wake(lateNight))
    XCTAssertEqual(midnight, calendar.startOfDay(for: noon))
    XCTAssertEqual(
      lessons(noon, now: midnight),
      ["You've used your free lessons", "More later today, or subscribe to keep going."])

    let opening = try XCTUnwrap(wake(midnight))
    XCTAssertEqual(opening, noon)
    XCTAssertEqual(lessons(noon, now: opening), ["Your next free lesson is ready"])
    XCTAssertNil(wake(opening))
  }

  /// The learner may still have lessons left, so a map's refusal never says they used them.
  func testAMapWhoseLessonsDontFitSaysWhenItFits() throws {
    let fits = try XCTUnwrap(
      calendar.date(from: DateComponents(year: 2026, month: 11, day: 22, hour: 9)))
    let dated = HelpLimit.usedUp(tier: .free, availableAt: fits)

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
}
