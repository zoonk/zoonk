import XCTest

@testable import Zoonk

final class StepMarksTests: XCTestCase {
  func testTheExampleGetsItsOwnPartAndTheUnderlineGoesWhereItFirstShows() {
    let text = """
      Quando um gato come ração, o corpo dele transforma o alimento.

      Essas e outras **transformações** se chamam metabolismo.
      """
    let parts = LessonTextParts(
      text,
      marks: StepMarks(
        underline: "se chamam metabolismo",
        example: "Quando um gato come ração, o corpo dele transforma o alimento."))

    XCTAssertNil(parts.before)
    XCTAssertEqual(
      parts.example,
      .init(
        text: "Quando um gato come ração, o corpo dele transforma o alimento.", underline: nil))
    XCTAssertEqual(
      parts.after,
      .init(
        text: "Essas e outras **transformações** se chamam metabolismo.",
        underline: "se chamam metabolismo"))
  }

  func testTheUnderlineMayRunThroughABoldTerm() {
    let parts = LessonTextParts(
      "Um exemplo vem antes.\n\nEssas e outras **transformações** se chamam metabolismo.",
      marks: StepMarks(
        underline: "outras transformações se chamam", example: "Um exemplo vem antes."))

    XCTAssertNil(parts.example?.underline)
    XCTAssertEqual(parts.after?.underline, "outras transformações se chamam")
  }

  func testAnExampleTheTextDoesntHoldLeavesTheTextWhole() {
    let parts = LessonTextParts(
      "Sobra o valor que cai na conta. O valor que cai na conta é a renda líquida.",
      marks: StepMarks(underline: "o valor que cai na conta", example: "Cíntia ganha mais."))

    XCTAssertEqual(
      parts.before,
      .init(
        text: "Sobra o valor que cai na conta. O valor que cai na conta é a renda líquida.",
        underline: "o valor que cai na conta"))
    XCTAssertNil(parts.example)
    XCTAssertNil(parts.after)
  }

  func testAnExampleInsideANumberedListIsFramedAndTheListCountsOnAfterIt() {
    let parts = LessonTextParts(
      "1. Heat the water.\n2. Add the tea.\n3. Pour it into a cup.",
      marks: StepMarks(example: "2. Add the tea."))

    XCTAssertEqual(
      [parts.before, parts.example, parts.after].map { RichTextBlock.parse($0?.text ?? "") },
      [
        [.list(items: ["Heat the water."], start: 1)],
        [.list(items: ["Add the tea."], start: 2)],
        [.list(items: ["Pour it into a cup."], start: 3)],
      ])
  }

  @MainActor
  func testMarksCountTheTextAsDrawnInUTF16() {
    let drawn = LessonRichText.typeset("O 🐱 come **ração** todo dia").text

    let marks = InlineMarks(drawn, underline: "come ração", highlightsTerms: true)

    XCTAssertEqual(marks.terms, [10..<15], "the emoji takes two UTF-16 units")
    XCTAssertEqual(
      marks.underline, [5..<9, 10..<15],
      "its words, through the bold term, found in the drawn text, without the spaces a line can break at"
    )
    XCTAssertEqual(
      InlineMarks(drawn, underline: "não está aqui", highlightsTerms: false), InlineMarks())
  }
}
