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

  func testAnExampleInsideANumberedListLeavesTheListWhole() {
    let parts = LessonTextParts(
      "1. Heat the water.\n2. Add the tea.\n3. Pour it into a cup.",
      marks: StepMarks(example: "2. Add the tea."))

    XCTAssertNil(parts.example, "framing it would number every part from 1")
    XCTAssertEqual(
      parts.before?.text, "1. Heat the water.\n2. Add the tea.\n3. Pour it into a cup.")
  }

  func testLateMarksDrawOnTheScreenInViewAndAddTheRestOnTheNextVisit() throws {
    var state = LessonPlayerState(
      lessonId: "lesson", steps: [try explanation("first"), try explanation("second")],
      hasMap: true)

    state.applyMarks(from: [
      try explanation("first", marks: #"{"ideaIndex": 0, "underline": "Cells make up"}"#),
      try explanation("second", marks: #"{"ideaIndex": 1}"#),
    ])

    XCTAssertEqual(
      state.steps["first"]?.marks, StepMarks(underline: "Cells make up"),
      "only what draws on the text, so the screen in view keeps its layout")
    XCTAssertEqual(state.steps["second"]?.marks?.ideaIndex, 1)

    state.continueLesson()
    XCTAssertEqual(
      state.steps["first"]?.marks, StepMarks(ideaIndex: 0, underline: "Cells make up"))
  }

  func testALateIconLeavesTheLayoutTheScreenInViewAlreadyShows() throws {
    var state = LessonPlayerState(
      lessonId: "lesson",
      steps: [try explanation("first", marks: #"{"ideaIndex": 0, "example": "Cells."}"#)],
      hasMap: true)
    let icon =
      #"{"url": "https://cdn.test/cell-256.webp", "smallUrl": "https://cdn.test/cell-96.webp"}"#

    state.applyMarks(from: [
      try explanation("first", marks: #"{"ideaIndex": 0, "example": "Cells.", "icon": \#(icon)}"#)
    ])

    XCTAssertEqual(state.steps["first"]?.marks, StepMarks(ideaIndex: 0, example: "Cells."))
  }

  func testAnExampleInsideANumberedListWithWindowsLineEndingsLeavesTheListWhole() {
    let parts = LessonTextParts(
      "1. Heat the water.\r\n2. Add the tea.\r\n3. Pour it into a cup.",
      marks: StepMarks(example: "2. Add the tea."))

    XCTAssertNil(parts.example)
  }

  func testHeldMarksShowOnceAnotherScreenComesFirst() throws {
    var state = LessonPlayerState(
      lessonId: "lesson", steps: [try check("check"), try explanation("explanation")])

    state.applyMarks(from: [try check("check", marks: #"{"ideaIndex": 1}"#)])
    XCTAssertNil(state.steps["check"]?.marks?.ideaIndex)

    state.explainFirst()
    XCTAssertEqual(state.currentStep?.id, "explanation")
    XCTAssertEqual(state.steps["check"]?.marks?.ideaIndex, 1)
  }

  @MainActor
  func testMarksCountTheTextAsDrawnInUTF16() {
    let drawn = LessonRichText.typeset("O 🐱 come **ração** todo dia").text

    let marks = InlineMarks(drawn, underline: "come ração", highlightsTerms: true)

    XCTAssertEqual(marks.terms, [10..<15], "the emoji takes two UTF-16 units")
    XCTAssertEqual(marks.underline, 5..<15, "through the bold term, found in the drawn text")
    XCTAssertEqual(
      InlineMarks(drawn, underline: "não está aqui", highlightsTerms: false), InlineMarks())
  }

  func testIdeasSitInReadingOrderAroundTheMapsCenter() {
    let slot = { (column: Int, row: Int) in LessonIdeaSlot(column: column, row: row) }

    XCTAssertEqual(LessonIdeaSlot.slots(count: 2), [slot(-1, 1), slot(1, 1)])
    XCTAssertEqual(LessonIdeaSlot.slots(count: 3), [slot(-1, -1), slot(1, -1), slot(0, 1)])
    XCTAssertEqual(
      LessonIdeaSlot.slots(count: 5),
      [slot(-1, -1), slot(1, -1), slot(-1, 1), slot(1, 1), slot(0, 2)])
    XCTAssertEqual(LessonIdeaSlot.rows(of: LessonIdeaSlot.slots(count: 5)), -1...2)
    XCTAssertEqual(LessonIdeaSlot.rows(of: LessonIdeaSlot.slots(count: 2)), 0...1)

    for count in 1...8 {
      let slots = LessonIdeaSlot.slots(count: count)
      XCTAssertEqual(
        slots,
        slots.sorted { ($0.row, $0.column) < ($1.row, $1.column) },
        "VoiceOver reads by position, so \(count) ideas must sit in number order")
    }
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

  private func check(_ id: String, marks: String = "null") throws -> LessonStep {
    try step(
      """
      {"id": "\(id)", "position": 0, "kind": "check", "marks": \(marks),
       "content": {"question": "Capital of France?", "basis": null, "options": [
         {"id": "right", "isCorrect": true, "reason": "It is.", "text": "Paris"},
         {"id": "wrong", "isCorrect": false, "reason": "That's Lyon.", "text": "Lyon"}]}}
      """)
  }
}
