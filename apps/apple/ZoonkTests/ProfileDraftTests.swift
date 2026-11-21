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

  /// A name is added whole or not at all: what doesn't fit stays in the field, which takes no more
  /// typing, and saving waits until it fits.
  func testTypedToolsStopAtTheFavoritesLimit() throws {
    var draft = ProfileDraft(tools(saved: ""))

    enter(String(repeating: "a", count: 50), into: &draft)
    draft.addTypedTools()
    enter(String(repeating: "b", count: 68), into: &draft)
    enter(String(repeating: "b", count: 69), into: &draft)

    XCTAssertEqual(draft.text.count, 68, "the field takes no more than one name can hold")

    enter("Photoshop, " + String(repeating: "c", count: 60) + ", Excel; Tasy", into: &draft)

    XCTAssertEqual(draft.typedTools, [String(repeating: "a", count: 50), "Photoshop"])
    XCTAssertEqual(draft.picks, ["excel", "Tasy"])
    XCTAssertEqual(
      draft.text, String(repeating: "c", count: 60), "a name that doesn't fit stays whole")
    XCTAssertFalse(draft.canAddTypedTools, "Add can't add what doesn't fit")
    XCTAssertFalse(draft.isComplete, "saving would drop the name in the field")

    draft.removeTypedTool("Photoshop")

    XCTAssertTrue(draft.canAddTypedTools)

    draft.addTypedTools()

    XCTAssertEqual(draft.text, "")
    XCTAssertTrue(draft.isComplete)
    XCTAssertEqual(draft.typedTools.joined(separator: ", ").count, 112)
  }

  /// Core counts code points: "Café" with its accent as a second mark is five, though Swift sees
  /// four characters, and an emoji is one, though JavaScript's length says two.
  func testTheLimitCountsAsCoreCounts() throws {
    var draft = ProfileDraft(tools(saved: ""))

    enter(String(repeating: "a", count: 114), into: &draft)
    draft.addTypedTools()
    enter("Cafe\u{301}", into: &draft)

    XCTAssertEqual(draft.text, "", "five code points don't fit the four left")

    enter("Caf\u{e9}", into: &draft)

    XCTAssertTrue(draft.canAddTypedTools)

    var emoji = ProfileDraft(tools(saved: ""))

    enter(String(repeating: "a", count: 117), into: &emoji)
    emoji.addTypedTools()
    enter("\u{1F3A8}", into: &emoji)
    emoji.addTypedTools()

    XCTAssertEqual(emoji.typedTools.last, "\u{1F3A8}")
  }

  /// What the field does as each word lands in it.
  private func enter(_ text: String, into draft: inout ProfileDraft) {
    let old = draft.text
    draft.text = text
    draft.settleToolText(from: old)
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
