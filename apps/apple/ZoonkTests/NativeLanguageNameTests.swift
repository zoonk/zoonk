import XCTest

@testable import Zoonk

final class NativeLanguageNameTests: XCTestCase {
  func testALanguageIsNamedInItselfAsMainListsIt() {
    XCTAssertEqual(nativeLanguageName("pt"), "Português")
    XCTAssertEqual(nativeLanguageName("es"), "Español")
    XCTAssertEqual(nativeLanguageName("fr"), "Français")
    XCTAssertEqual(nativeLanguageName("de"), "Deutsch")
    XCTAssertEqual(nativeLanguageName("en"), "English")
  }
}
