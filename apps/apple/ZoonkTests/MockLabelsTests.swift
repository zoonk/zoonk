import XCTest

@testable import Zoonk

final class MockLabelsTests: XCTestCase {
  private let english = Locale(identifier: "en_US")

  func testAScoreThatReadsAsZeroTakesNoSign() {
    XCTAssertEqual(MockLabels.number(-0.004, locale: english), "0")
    XCTAssertEqual(MockLabels.percent(-0.04, locale: english), "0%")
  }

  func testANegativeScoreTakesATypographicMinus() {
    XCTAssertEqual(MockLabels.number(-1.5, locale: english), "\u{2212}1.5")
    XCTAssertEqual(MockLabels.percent(-5, locale: english), "\u{2212}5%")
    XCTAssertEqual(MockLabels.number(-1.5, locale: Locale(identifier: "pt_BR")), "\u{2212}1,5")
  }
}
