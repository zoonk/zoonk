import XCTest

@testable import Zoonk

final class MultilineTextFieldTests: XCTestCase {
  func testReturnAnywhereSubmits() {
    XCTAssertTrue(MultilineTextField.isReturn(from: "", to: "\n"))
    XCTAssertTrue(MultilineTextField.isReturn(from: "I am fine", to: "I am fine\n"))
    XCTAssertTrue(MultilineTextField.isReturn(from: "I am fine", to: "I am\n fine"))
    XCTAssertTrue(MultilineTextField.isReturn(from: "a\nb", to: "a\n\nb"))
    XCTAssertTrue(MultilineTextField.isReturn(from: "I am fine", to: "I am \n"))
  }

  func testPasteKeepsItsLines() {
    XCTAssertFalse(MultilineTextField.isReturn(from: "I am fine", to: "We are OK\n"))
    XCTAssertFalse(MultilineTextField.isReturn(from: "", to: "We\nare"))
    XCTAssertFalse(MultilineTextField.isReturn(from: "I am", to: "I amx"))
    XCTAssertFalse(MultilineTextField.isReturn(from: "a\nb", to: "ab"))
  }
}
