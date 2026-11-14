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
    XCTAssertEqual(day(Date(timeIntervalSince1970: 1_794_607_200)), today)
    XCTAssertEqual(
      day(Date(timeIntervalSince1970: 1_795_339_800)),
      "Your next free lesson opens on November 22, or subscribe to keep going.")
    XCTAssertNil(day(nil))
  }

  func testTheGateWithoutADaySaysNothingAboutOne() {
    let words = HelpLimit.freeLessonsUsed(opensAt: nil).lessonWords

    XCTAssertEqual(words.said, "You've used your free lessons")
  }
}
