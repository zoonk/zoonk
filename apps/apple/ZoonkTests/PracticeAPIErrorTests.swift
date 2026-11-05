import OpenAPIRuntime
import XCTest

@testable import Zoonk

final class PracticeAPIErrorTests: XCTestCase {
  func testRefusedQuestionWritingNeedsPlusOnlyWhenItSaysSo() {
    XCTAssertEqual(refused(402, "PLUS_REQUIRED"), .plusRequired)
    XCTAssertEqual(
      refused(402, "USAGE_LIMIT_REACHED", #"{"limit":{"period":"month","tier":"free"}}"#),
      .limit(.limitReached(period: .month, tier: .free)))
  }

  private func refused(_ status: Int, _ code: String, _ details: String? = nil)
    -> PracticeAPIError
  {
    PracticeAPIError(
      writingRefused: VoiceRefusal(
        status: status, code: code,
        details: details.flatMap {
          try? JSONDecoder().decode(OpenAPIValueContainer.self, from: Data($0.utf8))
        }))
  }
}
