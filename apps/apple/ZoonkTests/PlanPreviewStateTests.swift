import XCTest

@testable import Zoonk

final class PlanPreviewStateTests: XCTestCase {
  private func preview(effect: PlanEffect?, ready: Bool = true, unchanged: Bool = false)
    -> PlanChangePreview
  {
    PlanChangePreview(effect: effect, feasibility: nil, ready: ready, unchanged: unchanged)
  }

  private func effect() throws -> PlanEffect {
    try JSONDecoder().decode(
      PlanEffect.self,
      from: Data(
        #"{"endDateAfter": null, "endDateBefore": null, "lessonsAdded": 2, "lessonsRemoved": 0}"#
          .utf8))
  }

  func testOnlyAnUnchangedAnswerSaysThePlanStaysAsItIs() throws {
    let changes = preview(effect: try effect())

    XCTAssertEqual(PlanPreviewState(preview(effect: nil, unchanged: true)), .unchanged)
    XCTAssertEqual(PlanPreviewState(changes), .changes(changes))
  }

  func testARefusedUnbuiltOrEffectlessPreviewFailed() throws {
    XCTAssertEqual(PlanPreviewState(nil), .failed)
    XCTAssertEqual(PlanPreviewState(preview(effect: try effect(), ready: false)), .failed)
    XCTAssertEqual(PlanPreviewState(preview(effect: nil)), .failed)
    XCTAssertFalse(PlanPreviewState.failed.canSave)
  }
}
