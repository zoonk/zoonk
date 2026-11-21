import XCTest

@testable import Zoonk

final class MockReviewItemTests: XCTestCase {
  /// The whole result fails to show when one review entry doesn't decode, so a right answer the
  /// learner marked as not sure has to read as one.
  func testARightAnswerMarkedNotSureDecodes() throws {
    let json = Data(
      #"""
      {"area":"Biology","citation":null,"context":null,"set":null,"correctAnswer":"Mitochondria",
      "explanation":null,"format":"multipleChoice","itemId":"01a12229-b961-72ae-a802-006ceef4fd0d",
      "learnerAnswer":"Mitochondria","number":12,"outcome":"right","question":"Where is ATP made?",
      "unsure":true}
      """#.utf8)

    let item = try JSONDecoder().decode(MockReviewItem.self, from: json)

    XCTAssertEqual(item.outcome, .right)
    XCTAssertTrue(item.unsure)
  }
}
