import Foundation
import XCTest

@testable import Zoonk

final class ProgressPresentationTests: XCTestCase {
  func testLearningTimeUsesTheSmallestUsefulLocalizedUnits() {
    let locale = Locale(identifier: "en_US")
    let expectations = [
      (seconds: 0, label: "0 min"),
      (seconds: 30, label: "30 sec"),
      (seconds: 59, label: "59 sec"),
      (seconds: 60, label: "1 min"),
      (seconds: 3_599, label: "1 hr"),
      (seconds: 3_600, label: "1 hr"),
      (seconds: 3_660, label: "1 hr, 1 min"),
    ]

    for expectation in expectations {
      XCTAssertEqual(
        progressLearningTime(expectation.seconds, locale: locale),
        expectation.label)
    }
  }

  func testMaximumLevelPresentsACompleteProgressValue() {
    let level = LevelProgress(
      belt: .black,
      bpPerLevel: 100_000,
      bpToNextLevel: 0,
      isMaxLevel: true,
      level: 10,
      progressInLevel: 0,
      totalBrainPower: 3_067_500)

    XCTAssertEqual(level.progressValue, 100_000)
    XCTAssertEqual(level.progressTotal, 100_000)
  }
}
