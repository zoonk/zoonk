import XCTest

@testable import Zoonk

final class MindMapSlotTests: XCTestCase {
  func testAChapterMapWithItsPictureShowsIt() {
    let picture = URL(string: "https://example.com/map.webp")!

    XCTAssertEqual(MindMapSlotLook(kind: .chapter, picture: picture), .picture(picture))
  }

  /// A dashed square is a chapter map whose picture hasn't come; a lesson map never has one.
  func testOnlyAChapterMapWithoutItsPictureIsDashed() {
    XCTAssertEqual(MindMapSlotLook(kind: .chapter, picture: nil), .dashed)
    XCTAssertEqual(MindMapSlotLook(kind: .lesson, picture: nil), .filled)
  }
}
