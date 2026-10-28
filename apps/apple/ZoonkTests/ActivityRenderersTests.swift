import XCTest

@testable import Zoonk

/// The order, sort and assign templates' rules, on the shared fixtures main's player browser tests
/// play (`@zoonk/testing/fixtures/activity-contents`): each renderer's grade must agree with core's
/// `checkActivityAnswer`, and its state rules with main's renderer models.
final class ActivityRenderersTests: XCTestCase {
  // MARK: - Shared

  func testShufflesLikeMainForTheSameSeed() {
    // Values from main's `seededShuffle` in `@zoonk/utils/seeded-random`.
    XCTAssertEqual(
      SeededShuffle.shuffled(["i1", "i2", "i3"], seed: "i1 i2 i3"), ["i2", "i3", "i1"])
    XCTAssertEqual(
      SeededShuffle.shuffled(["a", "b", "c", "d", "e", "f"], seed: "Photosynthesis: a,b,c,d,e,f"),
      ["a", "c", "d", "b", "f", "e"])
    XCTAssertEqual(SeededShuffle.hashSeed("évora 🙂 ok"), 2_079_340_494)
    XCTAssertEqual(
      SeededShuffle.shuffled(["x", "y", "z", "w"], seed: "évora 🙂 ok"), ["z", "w", "x", "y"])
  }

  // MARK: - Categorize

  private let categorizeJSON = #"""
    {"template":"categorize","prompt":"Sort each change.","check":{"kind":"interaction","explanation":"Here is why."},
     "fields":{"groups":[{"id":"chemical","label":"New substance","rule":"Something new forms."},
                         {"id":"physical","label":"Same substance","rule":"Only the form changes."}],
               "items":[{"groupId":"chemical","id":"i1","text":"Burning wood","why":"Ash and gas form."},
                        {"groupId":"physical","id":"i2","text":"Melting ice","why":"It is still water."},
                        {"groupId":"chemical","id":"i3","text":"Rusting iron","why":"Iron oxide forms."}]}}
    """#

  func testCategorizeEveryItemInItsGroupIsRight() throws {
    let content = try content(categorizeJSON)
    let fields = try content.fields(as: CategorizeFields.self)
    let placements = ["i1": "chemical", "i2": "physical", "i3": "chemical"]

    let answer = try XCTUnwrap(CategorizePlacements.answer(fields.shuffledItems, placements))
    XCTAssertTrue(grade(.categorize, content, answer))
    XCTAssertEqual(
      fields.shuffledItems.map(\.id), ["i2", "i3", "i1"], "items show in main's order")
  }

  func testCategorizeAMisplacedItemIsWrongAndSaysWhereItBelongs() throws {
    let content = try content(categorizeJSON)
    let items = try content.fields(as: CategorizeFields.self).items
    let placements = ["i1": "physical", "i2": "physical", "i3": "chemical"]

    XCTAssertFalse(
      grade(.categorize, content, try XCTUnwrap(CategorizePlacements.answer(items, placements))))
    XCTAssertEqual(
      CategorizePlacements.misplaced(
        items, expected: ["i1": "chemical", "i2": "physical", "i3": "chemical"],
        placements: placements
      ).map(\.id), ["i1"])
  }

  func testCategorizeHasNoAnswerUntilEveryItemIsSorted() throws {
    let items = try content(categorizeJSON).fields(as: CategorizeFields.self).items

    XCTAssertNil(CategorizePlacements.answer(items, ["i1": "chemical", "i2": "physical"]))
    XCTAssertEqual(
      CategorizePlacements.nextUnplacedId(items, placedId: "i3", placements: ["i3": "chemical"]),
      "i1",
      "focus wraps around to the first item left")
    XCTAssertNil(
      CategorizePlacements.nextUnplacedId(
        items, placedId: "i3", placements: ["i1": "a", "i2": "b", "i3": "c"]))
  }

  // MARK: - Helpers

  private func content(_ json: String) throws -> ActivityStepContent {
    try JSONDecoder().decode(ActivityStepContent.self, from: Data(json.utf8))
  }

  private func grade(
    _ renderer: ActivityRenderer, _ content: ActivityStepContent, _ answer: ActivityAnswer?
  )
    -> Bool
  {
    guard let answer, let grade = renderer.grade else {
      return false
    }

    return grade(content, answer)
  }
}
