import XCTest

@testable import Zoonk

@MainActor
final class LinkOpeningTests: XCTestCase {
  func testOpensWebPagesEmailAndTheAppsSettings() throws {
    for link in [
      "https://zoonk.com/support", "http://example.com", "HTTPS://example.com",
      "mailto:hello@zoonk.com", UIApplication.openSettingsURLString,
    ] {
      XCTAssertTrue(LinkOpening.mayOpen(try XCTUnwrap(URL(string: link))), link)
    }
  }

  /// Lesson text and sources are AI-written, so a link in them can name any scheme.
  func testNeverCallsMessagesOrOpensAnotherApp() throws {
    for link in [
      "tel:+15555550100", "sms:+15555550100", "facetime:hello@example.com",
      "zoonk://session", "itms-apps://apps.apple.com", "javascript:alert(1)", "/mistakes",
    ] {
      XCTAssertFalse(LinkOpening.mayOpen(try XCTUnwrap(URL(string: link))), link)
    }
  }
}
