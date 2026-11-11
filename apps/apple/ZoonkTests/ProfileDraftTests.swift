import XCTest

@testable import Zoonk

final class ProfileDraftTests: XCTestCase {
  /// Core's own saves and reads: `profile-native-fixtures.test.ts` writes them.
  private struct Fixtures: Decodable {
    struct Fixture: Decodable {
      let answer: Components.Schemas.ProfileAnswerInput
      let view: ProfileQuestionView
    }

    let fixtures: [Fixture]
  }

  private static let fixtures: [Fixtures.Fixture] = {
    let file = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent()
      .appending(path: "../../../packages/core/src/profile/questions/profile-native-fixtures.json")

    do {
      return try JSONDecoder().decode(Fixtures.self, from: Data(contentsOf: file)).fixtures
    } catch {
      XCTFail("core's profile fixtures can't be read: \(error)")
      return []
    }
  }()

  func testASavedAnswerOpensOnWhatSavesItAgain() throws {
    XCTAssertFalse(Self.fixtures.isEmpty)

    for fixture in Self.fixtures {
      let draft = ProfileDraft(fixture.view)

      XCTAssertEqual(
        try sent(draft.input), fixture.answer, "\(fixture.view.id) \(fixture.view.saved)")
    }
  }

  func testPickingConditionsSavesThemAndSkipDeclinesThem() throws {
    let declined = try XCTUnwrap(
      Self.fixtures.first { $0.view.id == .conditions && $0.view.status == .declined }?.view)
    var draft = ProfileDraft(declined)

    XCTAssertTrue(draft.isEmpty, "a declined conditions screen opens with nothing to send")

    draft.toggle("adhd")
    draft.toggle("other")
    draft.text = "migraines"

    XCTAssertEqual(
      try sent(draft.input),
      try decode(
        #"{"question":"conditions","answer":{"conditions":[{"condition":"adhd","note":null},{"condition":"other","note":"migraines"}],"consented":true,"declined":false}}"#
      ))
    XCTAssertEqual(
      try sent(draft.skipInput),
      try decode(
        #"{"question":"conditions","answer":{"conditions":[],"consented":false,"declined":true}}"#))
  }

  func testAboutYouScreensAreNeverSetupLeft() {
    XCTAssertFalse(
      [Components.Schemas.OnboardingStep.work, .learningSupport, .plan].hasSetupQuestions)
    XCTAssertTrue([Components.Schemas.OnboardingStep.work, .schedule, .plan].hasSetupQuestions)
  }

  private func sent(_ input: [String: Any]) throws -> Components.Schemas.ProfileAnswerInput {
    try JSONDecoder().decode(
      Components.Schemas.ProfileAnswerInput.self,
      from: JSONSerialization.data(withJSONObject: input))
  }

  private func decode(_ json: String) throws -> Components.Schemas.ProfileAnswerInput {
    try JSONDecoder().decode(Components.Schemas.ProfileAnswerInput.self, from: Data(json.utf8))
  }
}
