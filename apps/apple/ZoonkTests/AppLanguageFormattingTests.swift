import XCTest

@testable import Zoonk

final class AppLanguageFormattingTests: XCTestCase {
  func testEnglishCopyUsesEnglishDigitGrouping() {
    XCTAssertEqual(PlacementTestCopy.lessonsSkipped(1127), "1,127 lessons skipped")
  }
}
