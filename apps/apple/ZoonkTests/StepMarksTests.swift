import XCTest

@testable import Zoonk

final class StepMarksTests: XCTestCase {
  func testTaggedScreensAndMapsDecodeAndUntaggedOnesStayPlain() throws {
    let tagged = try step(
      #"""
      {"id": "explanation", "position": 1, "kind": "explanation",
       "content": {"title": null, "text": "A cat eats. That's **metabolism**."},
       "marks": {"ideaIndex": 1, "underline": "A cat eats.", "example": null,
                 "icon": {"url": "https://cdn.test/cat-256.webp",
                          "smallUrl": "https://cdn.test/cat-96.webp"}}}
      """#)
    let untagged = try step(
      #"""
      {"id": "explanation", "position": 1, "kind": "explanation",
       "content": {"title": null, "text": "A cat eats."}}
      """#)
    let map = try JSONDecoder().decode(
      LessonSummary.self,
      from: Data(
        #"""
        {"shape": "hub", "ideas": [
          {"label": "Metabolism", "text": "Food becomes energy.", "about": "What food turns into",
           "icon": {"url": "https://cdn.test/leaf-256.webp",
                    "smallUrl": "https://cdn.test/leaf-96.webp"}},
          {"label": "Cells", "text": "Living things are made of cells.", "about": null,
           "icon": null}]}
        """#.utf8))

    XCTAssertEqual(
      tagged.marks,
      StepMarks(
        ideaIndex: 1, underline: "A cat eats.",
        icon: LessonIcon(
          url: "https://cdn.test/cat-256.webp", smallUrl: "https://cdn.test/cat-96.webp")))
    XCTAssertNil(untagged.marks)
    XCTAssertEqual(map.ideas.map(\.about), ["What food turns into", nil])
    XCTAssertEqual(map.ideas.first?.icon?.smallUrl, "https://cdn.test/leaf-96.webp")
    XCTAssertTrue(map.isTagged)
    XCTAssertEqual(tagged.idea(in: map), 1)
    XCTAssertNil(tagged.idea(in: nil), "no map, no strip")
  }

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

  func testAnExampleInsideANumberedListLeavesTheListWhole() {
    let parts = LessonTextParts(
      "1. Heat the water.\n2. Add the tea.\n3. Pour it into a cup.",
      marks: StepMarks(example: "2. Add the tea."))

    XCTAssertNil(parts.example, "framing it would number every part from 1")
    XCTAssertEqual(
      parts.before?.text, "1. Heat the water.\n2. Add the tea.\n3. Pour it into a cup.")
  }

  func testMarksForTheScreenInViewWaitForTheLearnersNextVisit() throws {
    var state = LessonPlayerState(
      lessonId: "lesson", steps: [try explanation("first"), try explanation("second")],
      hasMap: true)

    state.applyMarks(from: [
      try explanation("first", marks: #"{"ideaIndex": 0}"#),
      try explanation("second", marks: #"{"ideaIndex": 1}"#),
    ])

    XCTAssertNil(state.steps["first"]?.marks, "the screen in view keeps its layout")
    XCTAssertEqual(state.steps["second"]?.marks?.ideaIndex, 1)

    state.continueLesson()
    XCTAssertEqual(state.steps["first"]?.marks?.ideaIndex, 0)
  }

  @MainActor
  func testMarksCountTheTextAsDrawnInUTF16() {
    let drawn = LessonRichText.typeset("O 🐱 come **ração** todo dia").text

    let marks = InlineMarks(drawn, underline: "come ração", highlightsTerms: true)

    XCTAssertEqual(marks.terms, [10..<15], "the emoji takes two UTF-16 units")
    XCTAssertEqual(marks.underline, 5..<15)
    XCTAssertEqual(
      InlineMarks(drawn, underline: "não está aqui", highlightsTerms: false), InlineMarks())
  }

  func testTheEndMapPutsTwoIdeasAboveItsTitleAndTheRestBelowInPairs() {
    let rows = [2, 3, 5].map { LessonMindMapRows(count: $0) }

    XCTAssertEqual(rows.map(\.above), [[[0]], [[0, 1]], [[0, 1]]])
    XCTAssertEqual(rows.map(\.below), [[[1]], [[2]], [[2, 3], [4]]])
    XCTAssertFalse(LessonMindMapRows.fits(6), "a sixth idea would sit behind the others' lines")
  }

  private func step(_ json: String) throws -> LessonStep {
    try JSONDecoder().decode(LessonStep.self, from: Data(json.utf8))
  }

  private func explanation(_ id: String, marks: String = "null") throws -> LessonStep {
    try step(
      """
      {"id": "\(id)", "position": 0, "kind": "explanation", "marks": \(marks),
       "content": {"title": null, "text": "Cells make up living things."}}
      """)
  }
}
