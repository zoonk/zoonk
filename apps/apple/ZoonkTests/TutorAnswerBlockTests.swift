import XCTest

@testable import Zoonk

final class TutorAnswerBlockTests: XCTestCase {
  private let answer = """
    Today builds the chapter:

    - [Why doesn't the electron fall?](/session?block=b1) introduces **how** it
    stays.
    - Practice revisits a mistake.
      - A detail under it

    1. First
    2. Second

    ## Next

    ```
    let x = 1
    ```
    """

  func testListsHeadingsAndCodeReadAsTheirOwnBlocks() {
    let blocks = TutorAnswerBlock.blocks(of: answer, linksEnabled: true)

    XCTAssertEqual(
      blocks.map(\.kind),
      [
        .paragraph, .listItem(marker: "•"), .listItem(marker: "•"), .listItem(marker: "•"),
        .listItem(marker: "1."), .listItem(marker: "2."), .heading, .code,
      ])
    XCTAssertEqual(blocks.map(\.depth), [0, 0, 0, 1, 0, 0, 0, 0])
    XCTAssertEqual(
      String(blocks[1].text.characters), "Why doesn't the electron fall? introduces how it stays.")
    XCTAssertEqual(String(blocks[7].text.characters), "let x = 1")
    XCTAssertEqual(
      blocks.map(\.followsListItem), [false, false, true, true, false, true, false, false])
  }

  func testLinksStayOnlyOnceChecked() {
    let checked = TutorAnswerBlock.blocks(of: answer, linksEnabled: true)[1].text
    let streaming = TutorAnswerBlock.blocks(of: answer, linksEnabled: false)[1].text

    XCTAssertEqual(checked.runs.compactMap(\.link).map(\.relativeString), ["/session?block=b1"])
    XCTAssertTrue(streaming.runs.allSatisfy { $0.link == nil })
  }
}
