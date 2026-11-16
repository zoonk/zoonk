import SwiftUI
import XCTest

@testable import Zoonk

@MainActor
final class TutorAnswerLinkTests: XCTestCase {
  func testLeavingBuddyAndReturningBeforeTheLinkAnswersOpensNothingAndNextTapWorks() async throws {
    let (window, tabs, api, router) = try await host()
    try activate("Open lesson", in: window)
    await api.waitForHeldCall()
    tabs.selected = 1
    router.select(.plan)
    try await settle()
    tabs.selected = 0
    router.select(.buddy)
    try await settle()
    await api.releaseHeldCall()
    try await settle()
    XCTAssertTrue(router.tasks.isEmpty)
    try await tapAgain(in: window, api: api, router: router)
  }

  func testAccountOpenedWhileTheAnswerLinkWaitsStaysOnItsLayer() async throws {
    let (window, _, api, router) = try await host()
    try activate("Open lesson", in: window)
    await api.waitForHeldCall()
    router.present(.account())
    await api.releaseHeldCall()
    try await settle()
    XCTAssertTrue(router.tasks.isEmpty)
    XCTAssertEqual(router.sheet(presentedBy: 0).wrappedValue, .account())
    router.sheet = nil
    try await tapAgain(in: window, api: api, router: router)
  }

  func testAResizeThatRebuildsTheAnswerDropsItsOpeningAndTheNextTapWorks() async throws {
    let (window, _, api, router) = try await host()
    try activate("Open lesson", in: window)
    await api.waitForHeldCall()
    window.frame = CGRect(x: 0, y: 0, width: 1376, height: 1032)
    try await settle()
    await api.releaseHeldCall()
    try await settle()
    XCTAssertTrue(router.tasks.isEmpty, "A resize that replaces the answer drops its opening")
    try await tapAgain(in: window, api: api, router: router)
    let opened = await api.openedBlocks
    XCTAssertEqual(opened, ["mission:b1", "mission:b1"])
  }

  private func tapAgain(in window: UIWindow, api: StudyAPIStub, router: AppRouter) async throws {
    try activate("Open lesson", in: window)
    await api.waitForHeldCall()
    await api.releaseHeldCall()
    try await settle()
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
    try await settle()
    return (window, tabs, api, router)
  }

  private func settle() async throws {
    try await Task.sleep(for: .milliseconds(600))
  }
}

@MainActor
@Observable
private final class AnswerTabs {
  var selected = 0
}

private struct AnswerHost: View {
  @Bindable var tabs: AnswerTabs

  var body: some View {
    TabView(selection: $tabs.selected) {
      PaneSplit {
        ViewOwnedAnswerLink()
      } secondary: {
        Text(verbatim: "Day")
      } single: {
        ViewOwnedAnswerLink()
      }
      .tag(0)
      Text(verbatim: "Elsewhere").tag(1)
    }
  }
}

private struct ViewOwnedAnswerLink: View {
  @Environment(AppRouter.self) private var router
  @State private var opening: Task<Void, Never>?

  var body: some View {
    Button("Open lesson") {
      guard opening == nil else { return }
      opening = Task {
        _ = await router.openAnswerLink(blockID: "b1")
        opening = nil
      }
    }
    .onDisappear { opening?.cancel() }
  }
}
