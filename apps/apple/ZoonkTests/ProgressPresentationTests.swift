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

  func testLearningTimeWritesJapaneseUnitsTogether() {
    let locale = Locale(identifier: "ja_JP")

    XCTAssertEqual(progressLearningTime(5_400, locale: locale), "1時間30分")
    XCTAssertEqual(progressLearningTime(45, locale: locale), "45秒")
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
