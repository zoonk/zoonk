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
      try decode(#"{"question":"conditions","answer":{"declined":true}}"#))
  }

  func testTheAddressFormSendsOneFormAndRatherNotSayDeclinesIt() throws {
    let feminine = try XCTUnwrap(
      Self.fixtures.first { $0.view.id == .addressForm && $0.view.saved.picks == ["feminine"] })
    var draft = ProfileDraft(feminine.view)
    draft.toggle("neutral")

    XCTAssertEqual(
      try sent(draft.input),
      try decode(#"{"question":"addressForm","answer":{"declined":false,"form":"neutral"}}"#))

    let declined = try XCTUnwrap(
      Self.fixtures.first { $0.view.id == .addressForm && $0.view.status == .declined })
    XCTAssertEqual(
      try sent(draft.skipInput),
      try decode(#"{"question":"addressForm","answer":{"declined":true}}"#))
    XCTAssertEqual(
      try sent(ProfileDraft(declined.view).declining(.ratherNotSay).input), declined.answer)
  }

  func testAChipQuestionTakesEveryPick() throws {
    let watch = try XCTUnwrap(Self.fixtures.first { $0.view.id == .watch }?.view)
    var draft = ProfileDraft(watch).declining(.ratherNotSay)
    let ids = watch.options.map(\.id)

    for id in ids {
      draft.toggle(id)
    }

    XCTAssertEqual(draft.picks, ids)
  }

  /// Saved favorites split as core splits them, each once, and save again joined by commas.
  func testSavedToolsOpenAsChipsAndSaveJoined() throws {
    let draft = ProfileDraft(tools(saved: "ClinicalKey; Whitebook\nclinicalkey、Bula，Excel"))

    XCTAssertEqual(draft.typedTools, ["ClinicalKey", "Whitebook", "Bula", "Excel"])
    XCTAssertEqual(draft.text, "")
    XCTAssertEqual(
      try sent(draft.input),
      try decode(
        #"{"question":"tools","answer":{"declined":false,"favorites":"ClinicalKey, Whitebook, Bula, Excel","picks":[]}}"#
      ))
  }

  func testATypedToolBecomesAChipOrPicksTheOfferedOne() throws {
    var draft = ProfileDraft(tools(saved: ""))

    enter("excel", into: &draft)
    draft.addTypedTools()
    enter("Whitebook,", into: &draft)
    enter("whitebook;", into: &draft)
    enter("tasy", into: &draft)

    XCTAssertEqual(draft.picks, ["excel"])
    XCTAssertEqual(draft.typedTools, ["Whitebook"])
    XCTAssertEqual(draft.text, "tasy", "a name stays in the field until it's added")
    XCTAssertEqual(
      try sent(draft.input),
      try decode(
        #"{"question":"tools","answer":{"declined":false,"favorites":"Whitebook","picks":["excel","Tasy"]}}"#
      ), "Continue counts the field's words as added")

    draft.removeTypedTool("Whitebook")

    XCTAssertEqual(draft.typedTools, [])
  }

  /// The field takes no more once the typed tools, joined as saving joins them, reach core's limit.
  func testTypedToolsStopAtTheFavoritesLimit() throws {
    var draft = ProfileDraft(tools(saved: ""))

    enter(String(repeating: "a", count: 50), into: &draft)
    draft.addTypedTools()
    enter(String(repeating: "b", count: 100), into: &draft)

    XCTAssertEqual(draft.text.count, 68)

    draft.addTypedTools()
    enter("c", into: &draft)

    XCTAssertEqual(draft.text, "")
    XCTAssertEqual(draft.typedTools.joined(separator: ", ").count, ProfileDraft.favoritesLimit)

    enter(String(repeating: "d", count: 30) + ", e", into: &draft)

    XCTAssertEqual(draft.typedTools.count, 2, "a paste past the limit adds nothing")
  }

  /// What the field does as each word lands in it.
  private func enter(_ text: String, into draft: inout ProfileDraft) {
    draft.text = text
    draft.settleToolText()
  }

  private func tools(saved text: String) -> ProfileQuestionView {
    ProfileQuestionView(
      id: .tools,
      options: [
        .init(description: nil, id: "Tasy", label: "Tasy"),
        .init(description: nil, id: "excel", label: "Excel"),
      ],
      saved: .init(picks: [], studies: [], text: text), status: nil, version: 1)
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
