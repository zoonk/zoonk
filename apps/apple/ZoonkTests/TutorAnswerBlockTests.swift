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
      String(blocks[1].text.text.characters),
      "Why doesn't the electron fall? introduces how it stays.")
    XCTAssertEqual(String(blocks[7].text.text.characters), "let x = 1")
    XCTAssertEqual(
      blocks.map(\.followsListItem), [false, false, true, true, false, true, false, false])
  }

  func testLinksStayOnlyOnceChecked() {
    let checked = TutorAnswerBlock.blocks(of: answer, linksEnabled: true)[1].text.text
    let streaming = TutorAnswerBlock.blocks(of: answer, linksEnabled: false)[1].text.text

    XCTAssertEqual(checked.runs.compactMap(\.link).map(\.relativeString), ["/session?block=b1"])
    XCTAssertTrue(streaming.runs.allSatisfy { $0.link == nil })
  }

  /// Written by `tutor-math-native-fixtures.test.ts` from the web's remark-math setup.
  private struct Fixtures: Decodable {
    struct Case: Decodable {
      struct Formula: Decodable {
        let display: Bool
        let latex: String
      }

      let text: String
      let formulas: [Formula]
    }

    let cases: [Case]
  }

  func testFindsTheFormulasTheWebTypesets() throws {
    let file = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent()
      .appending(path: "../../../packages/player/src/questions/tutor-math-native-fixtures.json")
    let cases = try JSONDecoder().decode(Fixtures.self, from: Data(contentsOf: file)).cases

    XCTAssertFalse(cases.isEmpty)

    for fixture in cases {
      XCTAssertEqual(
        TutorFormula.takeOut(fixture.text).formulas,
        fixture.formulas.map { TutorFormula(display: $0.display, latex: $0.latex) }, fixture.text)
    }
  }

  @MainActor
  func testFormulasKeepTheirStarsAndBackslashesAndReadAsMath() {
    let answer = "Count $$2*3*4 = 24$$ and $$\\{a\\}$$, then:\n$$\n\\frac{1}{2} x^2\n$$\nDone."
    let blocks = TutorAnswerBlock.blocks(of: answer, linksEnabled: false)

    XCTAssertEqual(blocks.map(\.kind), [.paragraph, .formula, .paragraph])
    XCTAssertEqual(
      blocks.map { String($0.text.text.characters) },
      [
        "Count \(typeset("2*3*4 = 24")) and \(typeset("\\{a\\}")), then:",
        typeset("\\frac{1}{2} x^2"), "Done.",
      ])
    XCTAssertEqual(
      TutorAnswerText.said(blocks, buddyName: "Ada"),
      "Ada: Count 2*3*4 = 24 and {a}, then:\n1 over 2 x squared\nDone.")
  }

  private func typeset(_ latex: String) -> String {
    String(LessonMath.typeset(latex).text.characters)
  }
}
