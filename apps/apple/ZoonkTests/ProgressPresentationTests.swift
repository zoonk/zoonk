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

  /// Main's `formatDuration` output in each app language. Apple's data and main's differ on how
  /// narrow a unit's no-break space is (Turkish), so any no-break space counts as one.
  func testLearningTimeMatchesMainInEveryLanguage() {
    let expectations = [
      "en": ["0 min", "5 min", "1 hr", "1 hr 30 min", "3 hr 38 min"],
      "es": ["0 min", "5 min", "1 h", "1 h 30 min", "3 h 38 min"],
      "pt": ["0 min", "5 min", "1 h", "1 h 30 min", "3 h 38 min"],
      "fr": ["0 min", "5 min", "1 h", "1 h 30 min", "3 h 38 min"],
      "de": ["0 Min.", "5 Min.", "1 Std.", "1 Std. 30 Min.", "3 Std. 38 Min."],
      "it": ["0 min", "5 min", "1 h", "1 h 30 min", "3 h 38 min"],
      "ja": ["0分", "5分", "1時間", "1時間30分", "3時間38分"],
      "ko": ["0분", "5분", "1시간", "1시간 30분", "3시간 38분"],
      "tr": ["0 dk.", "5 dk.", "1 sa.", "1 sa. 30 dk.", "3 sa. 38 dk."],
      "pl": ["0 min", "5 min", "1 godz.", "1 godz. 30 min", "3 godz. 38 min"],
    ]

    for (language, labels) in expectations {
      let shown = [0, 300, 3_600, 5_400, 13_080].map {
        progressLearningTime($0, locale: formattingLocale(language))
          .replacingOccurrences(of: "\u{202F}", with: "\u{00A0}")
      }
      // Within a unit the space doesn't break; between hours and minutes it may.
      let expected = labels.map {
        $0.replacingOccurrences(of: #"(\d) "#, with: "$1\u{00A0}", options: .regularExpression)
      }

      XCTAssertEqual(shown, expected, language)
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
