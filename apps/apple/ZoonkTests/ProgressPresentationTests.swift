import Foundation
import SwiftUI
import XCTest

@testable import Zoonk

final class ProgressPresentationTests: XCTestCase {
  func testLearningTimeUsesMainsCompactUnits() {
    let locale = Locale(identifier: "en_US")
    let expectations = [
      (seconds: 0, label: "0 min"),
      (seconds: 30, label: "30 sec"),
      (seconds: 60, label: "1 min"),
      (seconds: 89, label: "1 min"),
      (seconds: 3_599, label: "1 hr"),
      (seconds: 3_660, label: "1 hr 1 min"),
    ]

    for expectation in expectations {
      XCTAssertEqual(
        progressLearningTime(expectation.seconds, locale: locale).replacingOccurrences(
          of: "\u{00A0}", with: " "),
        expectation.label)
    }
  }

  func testDaypartHoursFollowTheLocalesClock() {
    XCTAssertEqual(
      ProgressDaypart.allCases.map { $0.localizedTimeRange(locale: Locale(identifier: "en_US")) },
      ["12–6 AM", "6 AM–12 PM", "12–6 PM", "6 PM–12 AM"])
    XCTAssertEqual(
      ProgressDaypart.allCases.map { $0.localizedTimeRange(locale: Locale(identifier: "pt_BR")) },
      ["00–06", "06–12", "12–18", "18–24"])
  }

  func testWeekdayNamesStartUppercase() {
    XCTAssertEqual(
      ProgressWeekday.thursday.localizedTitle(locale: Locale(identifier: "en_US")), "Thursday")
    XCTAssertEqual(
      ProgressWeekday.thursday.localizedTitle(locale: Locale(identifier: "pt_BR")), "Quinta-feira")
  }

  func testLevelShareIsFullAtTheLastLevel() {
    XCTAssertEqual(
      LevelProgress.fixture(level: 4, progressInLevel: 250, isMaxLevel: false).share, 0.25)
    XCTAssertEqual(LevelProgress.fixture(level: 10, progressInLevel: 0, isMaxLevel: true).share, 1)
  }

  func testActivityStepsAreRelativeToTheBusiestDay() {
    XCTAssertEqual(
      [0, 1, 2, 5, 8].map { CalendarSteps.activity($0, maximum: 8) }, [0, 1, 1, 3, 4])
    XCTAssertEqual(CalendarSteps.activity(0, maximum: 0), 0)
  }

  func testEnergyStepsKeepTheLastForFullEnergy() {
    XCTAssertEqual(
      [nil, 0, 10, 25, 26, 99.9, 100].map(CalendarSteps.energy), [0, 0, 1, 1, 2, 4, 5])
  }

  func testCalendarStartsOnTheNewestDayWithSomethingOnIt() {
    let days = [3, 0, 2, 0].enumerated().map { index, step in
      CalendarDay(date: ProgressDate("2026-08-0\(index + 1)")!, step: step, label: "", value: nil)
    }

    XCTAssertEqual(CalendarSteps.defaultIndex(days), 2)
    XCTAssertEqual(
      CalendarSteps.defaultIndex(
        days.map { CalendarDay(date: $0.date, step: 0, label: "", value: nil) }), 3)
  }

  func testArrowKeysMoveADayWithinItsWeekAndAWeekAcross() {
    XCTAssertEqual(CalendarSteps.index(from: 7, key: .upArrow, count: 20), 7)
    XCTAssertEqual(CalendarSteps.index(from: 8, key: .upArrow, count: 20), 7)
    XCTAssertEqual(CalendarSteps.index(from: 13, key: .downArrow, count: 20), 13)
    XCTAssertEqual(CalendarSteps.index(from: 18, key: .downArrow, count: 19), 18)
    XCTAssertEqual(CalendarSteps.index(from: 3, key: .leftArrow, count: 20), 3)
    XCTAssertEqual(CalendarSteps.index(from: 10, key: .leftArrow, count: 20), 3)
    XCTAssertEqual(CalendarSteps.index(from: 14, key: .rightArrow, count: 20), 14)
    XCTAssertEqual(CalendarSteps.index(from: 10, key: .rightArrow, count: 20), 17)
  }
}

extension LevelProgress {
  fileprivate static func fixture(level: Int, progressInLevel: Int, isMaxLevel: Bool)
    -> LevelProgress
  {
    LevelProgress(
      belt: .green, bpPerLevel: 1_000, bpToNextLevel: 1_000 - progressInLevel,
      isMaxLevel: isMaxLevel,
      level: level, nextBelt: nil, progressInLevel: progressInLevel, totalBrainPower: 3_000)
  }
}
