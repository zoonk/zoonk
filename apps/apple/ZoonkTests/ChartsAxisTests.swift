import SwiftUI
import XCTest

@testable import Zoonk

/// Expected values are what main's `plot-scale`, `plot-ticks` and `timeline-scale` give for the
/// same inputs, so a chart's scale reads the same on every platform.
final class ChartsAxisTests: XCTestCase {
  private let english = Locale(identifier: "en_US")

  func testTicksAreMainsRoundSteps() {
    XCTAssertEqual(ChartsAxis.ticks(0...10_000), [0, 2_500, 5_000, 7_500, 10_000])
    XCTAssertEqual(ChartsAxis.ticks(-10...10), [-10, -5, 0, 5, 10])
    XCTAssertEqual(ChartsAxis.ticks(1_958...2_023), [1_960, 1_980, 2_000, 2_020])
    XCTAssertEqual(ChartsAxis.ticks(0.3...0.7), [0.3, 0.4, 0.5, 0.6, 0.7])
  }

  /// "$2,500" on an axis whose readout writes "$2,653", not "$2K" a point at $2,653 sits above.
  func testAnAxisWritesItsNumbersInFullWhileTheyFit() {
    let money = { (value: Double, isShort: Bool) in
      ActivityNumberFormat.format(value, unit: "$", compact: isShort, locale: self.english)
    }

    XCTAssertFalse(ChartsAxis.isShort(ChartsAxis.ticks(0...10_000), format: money))
    XCTAssertEqual(
      ChartsAxis.ticks(0...10_000).map { money($0, false) },
      ["$0", "$2,500", "$5,000", "$7,500", "$10,000"])
    XCTAssertTrue(ChartsAxis.isShort(ChartsAxis.ticks(0...2_000_000), format: money))
  }

  /// A short label keeps the digits that tell it from its neighbors: 2.5K, not 2K or 3K.
  func testShortLabelsKeepTheirDigits() {
    let short = { (value: Double, unit: String?) in
      ActivityNumberFormat.format(value, unit: unit, compact: true, locale: self.english)
    }

    XCTAssertEqual(short(2_500, "$"), "$2.5K")
    XCTAssertEqual(short(7_500, "$"), "$7.5K")
    XCTAssertEqual(short(10_000, "$"), "$10K")
    XCTAssertEqual(short(1_250_000, nil), "1.25M")
    XCTAssertEqual(short(7_500, nil), "7.5K")
  }

  /// There was no year 0, so the turn of the era is labeled with its first year, 1 CE, and the
  /// steps stay even.
  func testATimelineLabelsTheTurnOfTheEra() {
    XCTAssertEqual(
      TimelineScale.ticks(start: -3_000, end: 2_000), [-3_000, -2_000, -1_000, 1, 1_000, 2_000])
    XCTAssertEqual(
      TimelineScale.ticks(start: 1_900, end: 2_000), [1_900, 1_920, 1_940, 1_960, 1_980, 2_000])
    XCTAssertEqual(
      TimelineScale.ticks(start: 1_000, end: 2_000), [1_000, 1_200, 1_400, 1_600, 1_800, 2_000])
  }
}
