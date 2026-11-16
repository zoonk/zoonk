import SwiftUI
import XCTest

@testable import Zoonk

/// "Get your certificate", claimed while the window crosses the width where the Plan splits into two
/// panes: the button is drawn again on the other side, and what the claim earned still shows.
@MainActor
final class PlanCertificateClaimTests: XCTestCase {
  func testWhatAClaimEarnedShowsWhenThePlanSplitsIntoPanesMeanwhile() async throws {
    let claim = HeldClaim()
    var shown: [PlanClaim] = []
    let context = PlanContext(
      goal: LearnerGoal(
        dailyMinutes: 30, id: "goal", kind: .exam, language: "en", status: .active,
        targetDate: "2026-01-04", displayName: "ENEM", title: "ENEM"),
      plan: try goalPlanFixture(), adjust: { _ in }, show: { _ in },
      claimCertificate: { await claim.answer() }, showClaim: { shown.append($0) })
    try readsWhatVoiceOverReads()

    let window = try show(
      PaneSplit {
        CertificateClaimButton(context: context, item: .finished)
      } secondary: {
        Color.clear
      } single: {
        CertificateClaimButton(context: context, item: .finished)
      }
      .zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: 420, height: 912)
    try await waitForLayout(in: window)

    try await activate(String(localized: "Get your certificate", table: "Plan"), in: window)
    try await claim.waitUntilAsked()

    window.frame = CGRect(x: 0, y: 0, width: 1376, height: 1032)
    try await waitForLayout(in: window)
    claim.release(.certificate(code: "ABC"))
    try await waitForTestCondition("The certificate did not open") { shown.count == 1 }

    XCTAssertEqual(shown.count, 1, "What it earned shows")
  }

  /// Leaving the Plan ends the visit: a claim that failed before shows nothing on the next one, and
  /// neither does one that fails after.
  func testLeavingThePlanShowsNothingOfAClaimThatFailed() async throws {
    let claim = HeldClaim()
    let context = PlanContext(
      goal: LearnerGoal(
        dailyMinutes: 30, id: "goal", kind: .exam, language: "en", status: .active,
        targetDate: "2026-01-04", displayName: "ENEM", title: "ENEM"),
      plan: try goalPlanFixture(), adjust: { _ in }, show: { _ in },
      claimCertificate: { await claim.answer() }, showClaim: { _ in })
    let owner = context.slotChecks
    var check: PlanSlotCheck { context.slotCheck(.finished, request: .claim) }

    check.claim(context)
    try await claim.waitUntilAsked()
    claim.release(nil)
    try await waitForTestCondition("Expected state did not arrive") { check.failed }
    XCTAssertTrue(check.failed)

    owner.leave()
    XCTAssertFalse(check.failed, "A failure before leaving")

    check.claim(context)
    try await claim.waitUntilAsked()
    owner.leave()
    claim.release(nil)
    try await waitForTestCondition("The late claim did not finish") { claim.completed == 2 }
    XCTAssertFalse(check.failed, "A failure after leaving")
  }
}

/// A claim the server answers when the test says.
@MainActor
private final class HeldClaim {
  private var held: CheckedContinuation<PlanClaim?, Never>?
  private(set) var completed = 0

  func answer() async -> PlanClaim? {
    let claim = await withCheckedContinuation { continuation in
      held = continuation
    }
    completed += 1
    return claim
  }

  func waitUntilAsked() async throws {
    try await waitForTestCondition("The fixture never received its request") { self.isHeld }
  }

  private var isHeld: Bool { held != nil }

  /// Nil when it didn't save.
  func release(_ claim: PlanClaim?) {
    held?.resume(returning: claim)
    held = nil
  }
}
