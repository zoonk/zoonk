import SwiftUI
import XCTest

@testable import Zoonk

/// What a check adds on a word bank's step: where it goes for each layout, and that what the
/// learner did in it (a buddy offer put away) stays when the page changes shape.
@MainActor
final class WordBankFeedbackTests: XCTestCase {
  func testWhatACheckAddsGoesWithTheBankOnlyOnAStepThatHasOne() throws {
    let cases: [(kind: String, oneColumn: CheckAddedPlace, spread: CheckAddedPlace)] = [
      ("reading", .aboveBank, .underBank),
      ("listening", .aboveBank, .underBank),
      ("fillBlank", .aboveBank, .underBank),
      ("translation", .underScreen, .underScreen),
      ("matchColumns", .underScreen, .underScreen),
      ("multipleChoice", .underScreen, .underScreen),
    ]

    for (kind, oneColumn, spread) in cases {
      let step = try languageStep(kind: kind)
      XCTAssertEqual(step.checkAddedPlace(isOneColumn: true), oneColumn, kind)
      XCTAssertEqual(step.checkAddedPlace(isOneColumn: false), spread, kind)
    }

    let check = try teachingCheck()
    XCTAssertEqual(check.checkAddedPlace(isOneColumn: true), .underScreen)
    XCTAssertEqual(check.checkAddedPlace(isOneColumn: false), .underScreen)
  }

  /// The ask panel opening beside the lesson, or the iPad changing size class, turns a spread into
  /// one column and back, which moves the feedback from under the tiles to above them.
  func testTheFeedbackKeepsItsStateWhenItMovesAboveTheTilesAndBack() async throws {
    let layout = BankLayout()
    let made = MadeStates()

    try show(BankHost(layout: layout, made: made))
    try await Task.sleep(for: .seconds(0.3))

    layout.isAbove = true
    try await Task.sleep(for: .seconds(0.3))
    layout.isAbove = false
    try await Task.sleep(for: .seconds(0.3))

    XCTAssertFalse(made.ids.isEmpty, "The feedback never showed")
    XCTAssertEqual(Set(made.ids).count, 1, "The feedback was made anew: \(made.ids)")
  }
}

@Observable
private final class BankLayout {
  var isAbove = false
}

private final class MadeStates {
  var ids: [UUID] = []
}

private struct BankHost: View {
  let layout: BankLayout
  let made: MadeStates

  var body: some View {
    LessonWordBank {
      Text(verbatim: "suis")
    }
    .environment(
      \.wordBankAdded,
      WordBankAdded(view: AnyView(StateProbe(made: made)), isAbove: layout.isAbove)
    )
    .frame(width: 320, height: 600)
  }
}

/// Stands in for the feedback's own state, such as a dismissed offer: a new id means it was made
/// anew and the state was lost.
private struct StateProbe: View {
  let made: MadeStates
  @State private var id = UUID()

  var body: some View {
    Text(verbatim: "Correct!")
      .onAppear { made.ids.append(id) }
  }
}

private func languageStep(kind: String) throws -> LessonStep {
  try JSONDecoder().decode(
    LessonStep.self,
    from: Data(
      """
      {"id": "\(kind)", "position": 0, "skillId": null, "kind": "\(kind)", "wordHints": null,
       "exercise": {"id": "\(kind)", "position": 0, "kind": "\(kind)", "content": {},
         "sentence": null, "word": null, "wordBankOptions": [], "sentenceWordOptions": [],
         "readingPromptWords": [], "fillBlankOptions": [], "translationOptions": [],
         "vocabularyOptions": [], "matchColumnsRightItems": []}}
      """.utf8))
}

private func teachingCheck() throws -> LessonStep {
  try JSONDecoder().decode(
    LessonStep.self,
    from: Data(
      #"""
      {"id": "check", "position": 0, "skillId": null, "citation": null, "image": null,
       "imagePending": false, "kind": "check", "content": {"question": "Capital of France?",
       "basis": null, "options": [{"id": "right", "isCorrect": true, "reason": "It is.",
       "text": "Paris"}]}}
      """#.utf8))
}
