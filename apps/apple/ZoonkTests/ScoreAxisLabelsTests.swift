import SwiftUI
import XCTest

@testable import Zoonk

final class ScoreAxisLabelsTests: XCTestCase {
  func testFiveWeeklyLabelsKeepTheEndsInwardAndTheMiddleCentered() {
    let labels = scoreAxisLabels(count: 5, width: 343, labelWidth: 60)
    XCTAssertEqual(labels.map(\.index), [0, 1, 2, 3, 4])
    XCTAssertEqual(labels.map(\.anchor), [.topLeading, .top, .top, .top, .topTrailing])
  }

  func testDenseDatesThinEvenlyAndKeepTheLastDate() {
    let labels = scoreAxisLabels(count: 13, width: 343, labelWidth: 60)
    XCTAssertEqual(labels.map(\.index), [0, 3, 6, 9, 12])
    XCTAssertEqual(labels.first?.anchor, .topLeading)
    XCTAssertEqual(labels.last?.anchor, .topTrailing)
  }
}
