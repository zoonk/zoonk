import Foundation
import HTTPTypes
import OpenAPIRuntime
import SwiftUI
import XCTest

@testable import Zoonk

/// A goal made from a draft's card, through the store and the draft's page as the start flow shows
/// it: Back waits while the goal is made, the card keeps one owner through the draft's reads, and
/// what the create leads to belongs to the visit that asked.
@MainActor
final class DraftCreationTests: XCTestCase {
  /// A create the server answers needs no read of its own: refused, the draft is as it was, and the
  /// card can send again at once.
  func testACreateTheServerAnswersLeavesItsDraftFresh() async throws {
    let server = DraftServer(try Self.explainDraft())
    let store = makeStore(server)
    let card = store.draft(id: Self.draftID)
    await card.load()
    let shown = try XCTUnwrap(card.value)
    await server.answerCreates(.refused)
    await server.holdNextCreate()

    let creating = Task { try await store.createExplanation(draft: shown, question: "Why?") }
    await server.waitForHeldCreate()
    XCTAssertEqual(card.freshState, .loaded(shown), "Sending marks nothing")

    await server.releaseHeldCreate()
    _ = try? await creating.value
    let reads = await server.reads

    XCTAssertEqual(card.freshState, .loaded(shown), "A refusal leaves the draft as it was")
    XCTAssertEqual(reads, 1, "No read after an answer")
  }

  /// A create that fails without the server's answer may have made the goal, so its draft is read
  /// again before the card offers it.
  func testACreateWithoutTheServersAnswerMakesItsDraftStale() async throws {
    let server = DraftServer(try Self.explainDraft())
    let store = makeStore(server)
    let card = store.draft(id: Self.draftID)
    await card.load()
    let shown = try XCTUnwrap(card.value)
    await server.answerCreates(.unavailable)

    _ = try? await store.createExplanation(draft: shown, question: "Why?")

    XCTAssertFalse(DraftCreation.canCreate(from: card))
  }

  /// Back stays off while the goal is made, even when the draft is read again meanwhile, and the
  /// failure shows on the card the learner sees.
  func testBackWaitsThroughAReadAndTheFailureShowsOnTheCard() async throws {
    let server = DraftServer(try Self.explainDraft())
    let store = makeStore(server)
    let card = store.draft(id: Self.draftID)
    await card.load()
    await server.answerCreates(.unavailable)
    await server.holdNextCreate()
    let page = Page(shown: Self.draftID)
    try readsWhatVoiceOverReads()

    let window = try host(page, cards: [Self.draftID: card], store: store, router: AppRouter())
    // Sent here, the question's explanation starts by itself.
    await server.waitForHeldCreate()
    try await waitUntil { Self.hidesBack(in: window) == true }

    card.invalidate()
    let readAgain = try await waitUntil { await server.reads >= 2 && card.freshState != .loading }
    XCTAssertTrue(readAgain)
    XCTAssertEqual(Self.hidesBack(in: window), true, "Back waits through the draft's read")

    await server.releaseHeldCreate()
    try await waitUntil { Self.hidesBack(in: window) == false }

    let failure = String(
      localized: "We couldn't save your goal. Try again in a moment.", table: "Onboarding")
    let saysWhy = try await waitUntil { Self.spoken(in: window).contains { $0.contains(failure) } }
    XCTAssertTrue(saysWhy, "The failure shows on the card: \(Self.spoken(in: window))")
  }

  /// The learner leaves while an explanation is made and opens another draft: the first one's
  /// answer opens nothing over the second, and its goal is made, which its draft names.
  func testALeftVisitsLateGoalOpensNothingOverANewerStart() async throws {
    let other = "00000000-0000-4000-8000-0000000000d2"
    let server = DraftServer(try Self.explainDraft())
    let store = makeStore(server)
    let card = store.draft(id: Self.draftID)
    await card.load()
    await server.holdNextCreate()
    let router = AppRouter()
    router.open(.startGoal(draftId: Self.draftID))
    let page = Page(shown: Self.draftID)

    _ = try host(page, cards: [Self.draftID: card], store: store, router: router)
    await server.waitForHeldCreate()

    // Closed, then another draft's start flow opened.
    page.shown = nil
    router.dismissTask()
    router.open(.startGoal(draftId: other))
    try await Task.sleep(for: .milliseconds(300))

    await server.serve(try Self.explainDraft(goalID: Self.goalID))
    await server.releaseHeldCreate()
    try await Task.sleep(for: .milliseconds(500))
    await card.load()

    XCTAssertEqual(router.tasks, [.startGoal(draftId: other)], "The newer start flow stays")
    XCTAssertEqual(card.value?.goalId, Self.goalID, "The goal was made; its draft opens its setup")
  }

  // MARK: Helpers

  private static let draftID = "00000000-0000-4000-8000-0000000000d1"
  private static let goalID = "00000000-0000-4000-8000-0000000000a1"

  private static func explainDraft(goalID: String? = nil) throws -> OnboardingDraft {
    let goal = goalID.map { #""\#($0)""# } ?? "null"

    return try JSONDecoder().decode(
      OnboardingDraft.self,
      from: Data(
        #"""
        {"activeGoalsLeft":2,"generationId":null,"goalId":\#(goal),"id":"\#(draftID)","prompt":"Why is the sky blue?","status":"understood","timeZone":"America/Sao_Paulo","understanding":{"question":"Why is the sky blue?","status":"explain"}}
        """#.utf8))
  }

  private let session = SessionStore.preview(account: .onboardingStoreTest)

  private func makeStore(_ server: DraftServer) -> OnboardingStore {
    OnboardingStore(
      clients: APIClientFactory(baseURL: URL(string: "https://api.zoonk.test")!, transport: server),
      cache: AppCache(session: session), session: session)
  }

  /// The draft's page pushed in a navigation stack, as the start flow shows it.
  private func host(
    _ page: Page, cards: [String: Resource<OnboardingDraft>], store: OnboardingStore,
    router: AppRouter
  ) throws -> UIWindow {
    let scene = try XCTUnwrap(
      UIApplication.shared.connectedScenes.first { $0 is UIWindowScene } as? UIWindowScene)
    let window = UIWindow(windowScene: scene)
    window.rootViewController = UIHostingController(
      rootView: DraftHost(page: page, cards: cards)
        .environment(store)
        .environment(router)
        .environment(session)
        .zoonkStyles())
    window.makeKeyAndVisible()
    addTeardownBlock { window.isHidden = true }
    return window
  }

  @discardableResult
  private func waitUntil(_ condition: @MainActor () async -> Bool) async throws -> Bool {
    for _ in 0..<100 {
      if await condition() {
        return true
      }

      try await Task.sleep(for: .milliseconds(50))
    }

    return false
  }

  private static func hidesBack(in window: UIWindow) -> Bool? {
    navigationController(in: window.rootViewController)?.topViewController?.navigationItem
      .hidesBackButton
  }

  private static func navigationController(in controller: UIViewController?)
    -> UINavigationController?
  {
    guard let controller else {
      return nil
    }

    if let navigation = controller as? UINavigationController {
      return navigation
    }

    return controller.children.lazy.compactMap { navigationController(in: $0) }.first
  }

  /// SwiftUI builds what VoiceOver reads only while the simulator has app accessibility on, which
  /// a simulator an automation tool has driven keeps and a new one lacks, so the test turns it on
  /// for itself through the system's accessibility library, as accessibility snapshot tests do.
  private func readsWhatVoiceOverReads() throws {
    typealias Enabled = @convention(c) () -> Bool
    typealias SetEnabled = @convention(c) (Bool) -> Void
    let library = try XCTUnwrap(dlopen("/usr/lib/libAccessibility.dylib", RTLD_NOW))
    let enabled = unsafeBitCast(
      try XCTUnwrap(dlsym(library, "_AXSApplicationAccessibilityEnabled")), to: Enabled.self)
    let setEnabled = unsafeBitCast(
      try XCTUnwrap(dlsym(library, "_AXSApplicationAccessibilitySetEnabled")), to: SetEnabled.self)
    let wasOn = enabled()
    setEnabled(true)
    addTeardownBlock { setEnabled(wasOn) }
  }

  /// What VoiceOver can read on the screen.
  private static func spoken(in element: Any) -> [String] {
    guard let object = element as? NSObject else {
      return []
    }

    var texts = [object.accessibilityLabel].compactMap { $0 }.filter { !$0.isEmpty }

    if let view = object as? UIView {
      texts += view.subviews.flatMap { spoken(in: $0) }
    }

    if let elements = object.accessibilityElements {
      texts += elements.flatMap { spoken(in: $0) }
    }

    return texts
  }
}

@MainActor
@Observable
private final class Page {
  var shown: String?

  init(shown: String?) {
    self.shown = shown
  }
}

private struct DraftHost: View {
  let page: Page
  let cards: [String: Resource<OnboardingDraft>]
  @State private var path = [1]

  var body: some View {
    NavigationStack(path: $path) {
      Color.clear
        .navigationDestination(for: Int.self) { _ in
          if let id = page.shown, let card = cards[id] {
            DraftView(
              card: card, sentHere: true, onRewrite: { _ in }, onBack: {}, onGoal: { _ in },
              sourceIDs: []
            )
            .id(id)
          }
        }
    }
  }
}
