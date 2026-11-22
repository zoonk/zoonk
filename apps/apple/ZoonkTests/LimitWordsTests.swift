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

  /// Once the day has come nothing ran out, so no title says it did; lessons and call time say
  /// they're back, as the web and Android do.
  func testTheDayThatCameStopsPromisingOne() {
    let passed = Date(timeIntervalSince1970: 1_794_607_200)

    XCTAssertEqual(lessons(passed), ["Your next free lesson is ready"])

    for tier in [LearnerTier.free, .plus] {
      XCTAssertEqual(
        text(HelpLimit.usedUp(tier: tier, availableAt: passed).words(.callTime, now: now)),
        ["Your call time is back", "You can try again now."])

      for kind in [HelpLimit.Kind.messages, .uploads, nil] {
        let words = HelpLimit.usedUp(tier: tier, availableAt: passed)
          .words(kind, now: now, calendar: calendar)

        XCTAssertNil(words.title, "\(tier) \(String(describing: kind))")
        XCTAssertEqual(text(words), ["You can try again now."])
      }
    }
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
}
