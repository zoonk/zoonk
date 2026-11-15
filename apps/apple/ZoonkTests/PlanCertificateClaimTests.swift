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
      claimCertificate: { await claim.answer() }, showClaim: { shown.append($0) },
      certificateClaim: CertificateClaim())
    try readsWhatVoiceOverReads()

    let window = try show(
      PaneSplit {
        CertificateClaimButton(context: context)
      } secondary: {
        Color.clear
      } single: {
        CertificateClaimButton(context: context)
      }
      .zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: 420, height: 912)
    try await settle()

    try activate(String(localized: "Get your certificate", table: "Plan"), in: window)
    await claim.waitUntilAsked()

    window.frame = CGRect(x: 0, y: 0, width: 1376, height: 1032)
    try await settle()
    claim.release(.certificate(code: "ABC"))
    try await settle()

    XCTAssertEqual(shown.count, 1, "What it earned shows")
  }

  private func settle() async throws {
    try await Task.sleep(for: .milliseconds(300))
  }
}

/// A claim the server answers when the test says.
@MainActor
private final class HeldClaim {
  private var held: CheckedContinuation<PlanClaim?, Never>?
  private var waiter: CheckedContinuation<Void, Never>?

  func answer() async -> PlanClaim? {
    await withCheckedContinuation { continuation in
      held = continuation
      waiter?.resume()
      waiter = nil
    }
  }

  func waitUntilAsked() async {
    if held == nil {
      await withCheckedContinuation { waiter = $0 }
    }
  }

  func release(_ claim: PlanClaim) {
    held?.resume(returning: claim)
    held = nil
  }
}
