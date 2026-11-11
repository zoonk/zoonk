import XCTest

@testable import Zoonk

final class LessonMathSegmentTests: XCTestCase {
  /// Main's own splits: `math-spans-native-fixtures.test.ts` writes them.
  private struct Fixtures: Decodable {
    struct Case: Decodable {
      struct Segment: Decodable {
        let kind: String
        let text: String
      }

      let text: String
      let segments: [Segment]
    }

    let cases: [Case]
  }

  func testSplitsEachLineWhereMainFindsMath() throws {
    let file = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent()
      .appending(path: "../../../packages/utils/src/math-spans-native-fixtures.json")
    let cases = try JSONDecoder().decode(Fixtures.self, from: Data(contentsOf: file)).cases

    XCTAssertFalse(cases.isEmpty)

    for fixture in cases {
      XCTAssertEqual(
        LessonMathSegment.split(fixture.text),
        try fixture.segments.map {
          LessonMathSegment(kind: try XCTUnwrap(.init(rawValue: $0.kind)), text: $0.text)
        },
        fixture.text)
    }
  }
}
