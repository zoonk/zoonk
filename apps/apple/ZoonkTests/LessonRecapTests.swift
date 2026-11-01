import XCTest

@testable import Zoonk

final class LessonRecapTests: XCTestCase {
  func testAQuestionRecapsTheScreenItWasWrittenAfter() throws {
    var state = LessonPlayerState(
      lessonId: "lesson",
      steps: try [
        explanation("first", position: 0), check("quiz", position: 1),
        explanation("second", position: 2), check("last", position: 3),
      ])

    state.continueLesson()
    XCTAssertNil(state.recap, "\"Explain first\" brings the explanation after it instead")

    try answer(&state, right: false)
    state.continueLesson()
    state.continueLesson()
    XCTAssertEqual(state.recap?.step.id, "second")

    try answer(&state, right: true)
    state.continueLesson()
    XCTAssertEqual(state.currentStep?.id, "quiz")
    XCTAssertEqual(state.recap?.step.id, "first", "a missed question back at the end")
  }

  func testAMissedQuickCheckRecapsFromWhereItWasWritten() throws {
    var state = LessonPlayerState(
      lessonId: "lesson",
      steps: try [
        explanation("first", position: 0), check("quiz", position: 1),
        explanation("second", position: 2),
      ])

    state.knowThis()
    try answer(&state, right: false)
    state.continueLesson()
    state.continueLesson()
    state.continueLesson()

    XCTAssertEqual(state.queue, ["first", "second", "quiz"])
    XCTAssertEqual(state.currentStep?.id, "quiz")
    XCTAssertEqual(state.recap?.step.id, "first")
  }

  func testAMissMarksTheSentenceTheQuestionRestsOn() throws {
    let quote = "It spreads out into a **cloud**."

    let cases: [(restsOn: Int, mark: String?)] = [(0, quote), (5, nil)]

    for (restsOn, mark) in cases {
      var state = LessonPlayerState(
        lessonId: "lesson",
        steps: try [
          explanation("idea", position: 0),
          check("quiz", position: 1, basis: #"{"position": \#(restsOn), "quote": "\#(quote)"}"#),
        ])

      state.continueLesson()
      XCTAssertNil(state.recap?.mark, "nothing is marked before the check")

      try answer(&state, right: false)
      XCTAssertEqual(state.recap?.step.id, "idea")
      XCTAssertEqual(state.recap?.mark, mark, "basis on screen \(restsOn)")
    }
  }

  private func answer(_ state: inout LessonPlayerState, right: Bool) throws {
    let step = try XCTUnwrap(state.currentStep)
    let optionId = right ? "right" : "wrong"
    state.select(.check(optionId: optionId), for: step.id)
    let grade = try XCTUnwrap(LessonGrading.grade(.check(optionId: optionId), step: step))
    state.resolve(step.id, result: LessonStepResult(grade))
  }
}

private func step(_ id: String, position: Int, kind: String, content: String) throws -> LessonStep {
  try JSONDecoder().decode(
    LessonStep.self,
    from: Data(
      """
      {"id": "\(id)", "position": \(position), "skillId": null, "citation": null, "image": null,
       "imagePending": false, "kind": "\(kind)", "content": \(content)}
      """.utf8))
}

private func explanation(_ id: String, position: Int) throws -> LessonStep {
  try step(
    id, position: position, kind: "explanation",
    content: #"{"title": "\#(id)", "text": "It spreads out into a **cloud**. Then it settles."}"#)
}

private func check(_ id: String, position: Int, basis: String = "null") throws -> LessonStep {
  try step(
    id, position: position, kind: "check",
    content: #"""
      {"question": "Where is it?", "basis": \#(basis), "options": [
        {"id": "right", "isCorrect": true, "reason": "It is.", "text": "A cloud"},
        {"id": "wrong", "isCorrect": false, "reason": "It isn't.", "text": "A ball"}]}
      """#)
}
