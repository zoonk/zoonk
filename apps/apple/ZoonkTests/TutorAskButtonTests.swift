import SwiftUI
import XCTest

@testable import Zoonk

/// An Ask button in a practice bar, its panel open while the window crosses the width where the
/// question and its answer are two panes: the router presents the panel, so it stays.
@MainActor
final class TutorAskButtonTests: XCTestCase {
  func testThePanelStaysWhenTheBarsPaneGoes() async throws {
    try await staysOpen(from: 1376, to: 420)
  }

  func testThePanelStaysWhenTheBarsPaneComes() async throws {
    try await staysOpen(from: 420, to: 1376)
  }

  private func staysOpen(from: CGFloat, to: CGFloat) async throws {
    let dependencies = AppDependencies.hosted()
    let router = AppRouter()
    let scope = TutorScope.plan(goalId: "goal")
    try readsWhatVoiceOverReads()

    let window = try show(
      PaneSplit {
        Color.clear
      } secondary: {
        TutorAskButton(scope: scope)
      } single: {
        TutorAskButton(scope: scope)
      }
      .sheet(item: router.sheet(presentedBy: 0)) { sheet in
        AppSheetView(sheet: sheet)
      }
      .appDependencies(dependencies)
      .environment(router)
      .zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: from, height: 1032)
    try await settle()

    let name = dependencies.learnerSummaryStore.buddyDisplayName
    try activate(scope.askLabel(name), in: window)
    try await settle()
    XCTAssertNotNil(window.rootViewController?.presentedViewController, "The panel opens")

    window.frame = CGRect(x: 0, y: 0, width: to, height: 1032)
    try await settle()

    XCTAssertNotNil(window.rootViewController?.presentedViewController, "The panel stays")
  }

  private func settle() async throws {
    try await Task.sleep(for: .milliseconds(600))
  }

}
