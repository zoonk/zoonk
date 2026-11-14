import XCTest

@testable import Zoonk

/// An answer the server didn't check (the screen was fixed after the learner started) counts
/// neither way, so it never reads as wrong.
final class LessonVerdictTests: XCTestCase {
  func testAnAnswerTheServerDidntCheckIsNeverWrong() throws {
    let spoken = try step(
      #""kind": "spokenAnswer", "content": {"language": "fr", "prompt": "Say hello.", "targetText": "Bonjour", "romanization": null, "translation": null}"#
    )
    let check = try step(
      #""kind": "check", "content": {"question": "Capital of France?", "basis": null, "options": [{"id": "right", "isCorrect": true, "reason": "It is.", "text": "Paris"}, {"id": "wrong", "isCorrect": false, "reason": "That's Lyon.", "text": "Lyon"}]}"#
    )
    var result = LessonStepResult(
      isCorrect: false, answerText: "Bonsoir", correctAnswer: nil, feedback: nil)
    result.checked = false

    for step in [spoken, check] {
      let verdict = LessonVerdict.of(result, step: step)

      XCTAssertEqual(String(localized: verdict.title), "Not checked this time")
      XCTAssertEqual(verdict.tone, .neutral)
    }
  }

  private func step(_ kindAndContent: String) throws -> LessonStep {
    try JSONDecoder().decode(
      LessonStep.self,
      from: Data(
        """
        {"id": "s1", "position": 0, "skillId": null, "citation": null, "image": null,
         "imagePending": false, \(kindAndContent)}
        """.utf8))
  }
}
