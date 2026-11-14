import SwiftUI
import XCTest

@testable import Zoonk

/// A capture's `type` rule compares these names, so one role always gets one name.
final class LayoutCaptureTests: XCTestCase {
  func testNamesEachRoleByTheDesignSystem() {
    XCTAssertEqual(TypeStyle.rowTitle.layoutName, "rowTitle")
    XCTAssertEqual(TypeStyle.meta.layoutName, "meta")
    XCTAssertEqual(TypeStyle.data.layoutName, "data")
  }

  /// `note` and `smallButton` differ only in weight, so a weight change on either could match both.
  func testNamesAWeightChangeByItsRoleTheSameEveryTime() {
    XCTAssertEqual(TypeStyle.note.weight(.semibold).layoutName, "note semibold")
    XCTAssertEqual(TypeStyle.meta.weight(.medium).layoutName, "meta medium")
  }
}
