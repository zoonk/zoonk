import SwiftUI
import XCTest

@testable import Zoonk

@MainActor
final class TutorAnswerLinkTests: XCTestCase {
  func testLeavingBuddyAndReturningBeforeTheLinkAnswersOpensNothingAndNextTapWorks() async throws {
    let (window, tabs, api, router) = try await host()
    try await activate("Open lesson", in: window)
    try await api.waitForHeldCall()
    tabs.selected = 1
    router.select(.plan)
    try await waitForTestCondition("Buddy did not disappear") {
      spoken(in: window).contains("Elsewhere")
    }
    tabs.selected = 0
    router.select(.buddy)
    try await waitForTestCondition("Buddy did not return") {
      spoken(in: window).contains("Open lesson")
    }
    await api.releaseHeldCall()
    try await waitForTestCondition("The old link request did not finish") { tabs.pending == 0 }
    XCTAssertTrue(router.tasks.isEmpty)
    try await tapAgain(in: window, api: api, router: router)
  }

  func testAccountOpenedWhileTheAnswerLinkWaitsStaysOnItsLayer() async throws {
    let (window, tabs, api, router) = try await host()
    try await activate("Open lesson", in: window)
    try await api.waitForHeldCall()
    router.present(.account())
    await api.releaseHeldCall()
    try await waitForTestCondition("The old link request did not finish") { tabs.pending == 0 }
    XCTAssertTrue(router.tasks.isEmpty)
    XCTAssertEqual(router.sheet(presentedBy: 0).wrappedValue, .account())
    router.sheet = nil
    try await tapAgain(in: window, api: api, router: router)
  }

  func testAResizeThatRebuildsTheAnswerDropsItsOpeningAndTheNextTapWorks() async throws {
    let (window, tabs, api, router) = try await host()
    try await activate("Open lesson", in: window)
    try await api.waitForHeldCall()
    window.frame = CGRect(x: 0, y: 0, width: 1376, height: 1032)
    try await waitForLayout(in: window)
    await api.releaseHeldCall()
    try await waitForTestCondition("The old link request did not finish") { tabs.pending == 0 }
    XCTAssertTrue(router.tasks.isEmpty, "A resize that replaces the answer drops its opening")
    try await tapAgain(in: window, api: api, router: router)
    let opened = await api.openedBlocks
    XCTAssertEqual(opened, ["mission:b1", "mission:b1"])
  }

  private func tapAgain(in window: UIWindow, api: StudyAPIStub, router: AppRouter) async throws {
    try await activate("Open lesson", in: window)
    try await api.waitForHeldCall()
    await api.releaseHeldCall()
    try await waitForTestCondition("Expected state did not arrive") { !(router.tasks.isEmpty) }
    XCTAssertFalse(router.tasks.isEmpty)
  }

  private func host() async throws -> (UIWindow, AnswerTabs, StudyAPIStub, AppRouter) {
    let opening = try JSONDecoder().decode(
      StudyBlockOpening.self,
      from: Data(#"{"kind":"lesson","lessonId":"l1","sessionId":"s1"}"#.utf8))
    let api = StudyAPIStub(openings: [opening, opening], holdsOpening: true)
    let cache = AppCache(session: .preview(account: .planTestAccount))
    let router = AppRouter(
      openBlock: AppRouter.openingTodayBlocks(today: TodayStore(api: api, cache: cache)))
    router.select(.buddy)
    let tabs = AnswerTabs()
    try readsWhatVoiceOverReads()
    let window = try show(AnswerHost(tabs: tabs).environment(router))
    window.frame = CGRect(x: 0, y: 0, width: 420, height: 912)
    try await waitForLayout(in: window)
    return (window, tabs, api, router)
  }

}

@MainActor
@Observable
private final class AnswerTabs {
  var selected = 0
  var pending = 0
}

private struct AnswerHost: View {
  @Bindable var tabs: AnswerTabs

  var body: some View {
    TabView(selection: $tabs.selected) {
      PaneSplit {
        ViewOwnedAnswerLink(tabs: tabs)
      } secondary: {
        Text(verbatim: "Day")
      } single: {
        ViewOwnedAnswerLink(tabs: tabs)
      }
      .tag(0)
      Text(verbatim: "Elsewhere").tag(1)
    }
  }
}

private struct ViewOwnedAnswerLink: View {
  let tabs: AnswerTabs
  @Environment(AppRouter.self) private var router
  @State private var opening: Task<Void, Never>?

  var body: some View {
    Button("Open lesson") {
      guard opening == nil else { return }
      tabs.pending += 1
      opening = Task {
        defer { tabs.pending -= 1 }
        _ = await router.openAnswerLink(blockID: "b1")
        opening = nil
      }
    }
    .onDisappear { opening?.cancel() }
  }
}
