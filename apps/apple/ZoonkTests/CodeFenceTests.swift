import XCTest

@testable import Zoonk

/// Main's `code-fence.test.ts` and the fenced cases of its rich text and question tests: lessons and
/// questions show a fenced block as code, exactly as written.
final class CodeFenceTests: XCTestCase {
  private let text = [
    "O que aparece no console?",
    "```JavaScript linhas",
    "if (pronto) {",
    "  console.log('fim');",
    "}",
    "```",
    "Escolha uma opção.",
  ]

  func testReadsAFencesLanguageAndItsCodeExactlyAsWritten() {
    XCTAssertEqual(
      CodeFence.read(text, at: 1),
      CodeFence(
        code: "if (pronto) {\n  console.log('fim');\n}", language: "javascript", isClosed: true,
        start: 1, end: 6))
  }

  func testRunsAFenceThatNeverClosesToTheEndAsCommonMarkDoes() {
    XCTAssertEqual(
      CodeFence.read(["```", "x = 1", "", "y = 2"], at: 0),
      CodeFence(code: "x = 1\n\ny = 2", language: nil, isClosed: false, start: 0, end: 4))
  }

  func testClosesOnlyOnAFenceAtLeastAsLongAsTheOpeningOne() {
    XCTAssertEqual(CodeFence.read(["````md", "```", "texto", "````"], at: 0)?.code, "```\ntexto")
  }

  func testReadsAFenceOfTildesWhichOnlyTildesClose() {
    XCTAssertEqual(
      CodeFence.read(["~~~js `x`", "f(`a`);", "```", "~~~~"], at: 0),
      CodeFence(code: "f(`a`);\n```", language: "js", isClosed: true, start: 0, end: 4))
    XCTAssertEqual(CodeFence.read(["```", "x", "~~~"], at: 0)?.isClosed, false)
    XCTAssertNil(CodeFence.read(["~~", "x", "~~"], at: 0))
  }

  func testTakesTheOpeningFencesIndentationOffItsCode() {
    XCTAssertEqual(
      CodeFence.read(["  ```py", "  if x:", "      y()", " z", "  ```"], at: 0)?.code,
      "if x:\n    y()\nz")
  }

  func testReadsInlineCodeAndAnIndentedBlockAsNoFence() {
    XCTAssertNil(CodeFence.read(["```x``` e mais"], at: 0))
    XCTAssertNil(CodeFence.read(["    ```", "x", "```"], at: 0))
    XCTAssertNil(CodeFence.read(text, at: 2))
  }

  func testMarksEveryLineOfEachBlockItsFencesIncluded() {
    XCTAssertEqual(
      CodeFence.lines(in: text + ["```sql", "SELECT 1;", "```"]),
      IndexSet([1, 2, 3, 4, 5, 7, 8, 9]))
  }

  func testReadsATextThatIsOneClosedBlockAndNothingElse() {
    XCTAssertEqual(CodeFence.whole(" ```js\nf();\n```\n")?.code, "f();")
    XCTAssertNil(CodeFence.whole("Rode:\n```js\nf();\n```"))
    XCTAssertNil(CodeFence.whole("```js\nf();\n```\nE depois?"))
    XCTAssertNil(CodeFence.whole("```js\nf();"))
  }

  func testKeepsABlocksCodeExactlyAsWrittenWithItsLanguage() {
    let code = "for i in range(3):\n    if i > 0:\n\n        print(i)  \nprint('fim')"

    XCTAssertEqual(
      RichTextBlock.parse("Veja este código:\n\n```python\n\(code)\n```\n\nO que ele mostra?"),
      [
        .paragraph(lines: ["Veja este código:"]),
        .code(code: code, language: "python"),
        .paragraph(lines: ["O que ele mostra?"]),
      ])
  }

  func testStartsABlockRightUnderASentenceAndReadsMarkdownInsideItAsCode() {
    XCTAssertEqual(
      RichTextBlock.parse("Em\n```\n- **x** | $y$\n| a | b |\n|---|---|\n```\no valor muda."),
      [
        .paragraph(lines: ["Em"]),
        .code(code: "- **x** | $y$\n| a | b |\n|---|---|", language: nil),
        .paragraph(lines: ["o valor muda."]),
      ])
  }

  func testRunsABlockThatNeverClosesToTheEndOfTheText() {
    XCTAssertEqual(
      RichTextBlock.parse("Run it:\n```js\nconst a = 1;\n\nlog(a);"),
      [
        .paragraph(lines: ["Run it:"]),
        .code(code: "const a = 1;\n\nlog(a);", language: "js"),
      ])
  }

  func testNeverMarksInsideCodeAndMarksTheSentenceAfterIt() {
    let blocks = RichTextBlock.parse("```python\nprint('prints hi')\n```\nThe program prints hi.")

    XCTAssertEqual(
      RichTextBlock.mark("prints hi", in: blocks) { $0 },
      RichTextBlock.Mark(block: 1, item: 0, text: "prints hi"))
  }

  func testReadsACodeBlockAmongWordsAsOneRunOfInlineCode() {
    let line = LessonRichText.typeset(
      "Use\n```python\nfor i in range(3):\n    print(i)\n```\nto count.")

    XCTAssertEqual(
      String(line.text.characters).replacing(String(CodeBreaks.mark), with: ""),
      "Use for i in range(3): print(i) to count.")
    XCTAssertNil(line.snippet)
    XCTAssertEqual(
      line.text.runs.filter { $0.inlinePresentationIntent == .code }
        .map { String(line.text[$0.range].characters) },
      ["for i in range(\u{200B}3): print(\u{200B}i)"])
  }

  func testDrawsAnOptionThatIsOneCodeBlockAsCode() {
    let option = LessonRichText.typeset("```java\nint total = 0;\ntotal++;\n```")

    XCTAssertEqual(option.snippet?.code, "int total = 0;\ntotal++;")
    XCTAssertEqual(option.snippet?.language, "java")
    XCTAssertEqual(String(option.text.characters), "int total = 0; total++;")
  }

  func testShowsAQuestionsCodeAboveItWithTheQuestionAsItsTitle() {
    let code = "```python\nfor i in range(3):\n    print(i)\n```"

    XCTAssertEqual(
      LessonQuestionParts("What does this print?\n\(code)"),
      LessonQuestionParts(data: code, question: "What does this print?"))
    XCTAssertEqual(
      LessonQuestionParts("Look at this:\n\n\(code)\n\nWhat does it print?"),
      LessonQuestionParts(data: "Look at this:\n\n\(code)", question: "What does it print?"))
    XCTAssertEqual(
      LessonQuestionParts("What is `x`?"), LessonQuestionParts(data: nil, question: "What is `x`?"))
  }
}
