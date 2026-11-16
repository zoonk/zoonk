import SwiftUI
import XCTest

@testable import Zoonk

/// PR comment 29, everywhere a page asks: how a request ended belongs to the visit that asked. A
/// failure shown before the learner left is gone when they come back, and one that lands after
/// they left says nothing. Each page is in a tab, and leaving is going to the other tab.
@MainActor
final class VisitOutcomeTests: XCTestCase {
  func testAPreferenceThatDidntSaveIsGoneOnReturn() async throws {
    let api = VisitSettingsAPI(failsUpdates: true)
    let tabs = VisitTabs()
    let window = try await host(PreferencesView(), settings: api, tabs: tabs)

    try activate(where: { $0.hasPrefix(Self.sounds) }, in: window)
    try await settle()
    XCTAssertTrue(shows(Self.didntSave, in: window), "The failure shows: \(spoken(in: window))")

    try await leaveAndComeBack(tabs)
    XCTAssertFalse(shows(Self.didntSave, in: window), "Gone on return: \(spoken(in: window))")
  }

  func testAPreferenceThatFailsAfterTheLearnerLeftSaysNothing() async throws {
    let api = VisitSettingsAPI(failsUpdates: true)
    await api.holdUpdates()
    let tabs = VisitTabs()
    let window = try await host(PreferencesView(), settings: api, tabs: tabs)

    try activate(where: { $0.hasPrefix(Self.sounds) }, in: window)
    await api.waitForHeldUpdate()
    try await leave(tabs, meanwhile: { await api.releaseUpdate() })

    XCTAssertFalse(shows(Self.didntSave, in: window), "Nothing of it: \(spoken(in: window))")
  }

  func testUsageSharingThatDidntSaveIsGoneOnReturn() async throws {
    let api = VisitSettingsAPI(failsUpdates: true)
    let tabs = VisitTabs()
    let window = try await host(PrivacyView(deleteAccount: nil), settings: api, tabs: tabs)

    try activate(where: { $0.hasPrefix(Self.shareUsage) }, in: window)
    try await settle()
    XCTAssertTrue(shows(Self.didntSave, in: window), "The failure shows: \(spoken(in: window))")

    try await leaveAndComeBack(tabs)
    XCTAssertFalse(shows(Self.didntSave, in: window), "Gone on return: \(spoken(in: window))")
  }

  func testUsageSharingThatFailsAfterTheLearnerLeftSaysNothing() async throws {
    let api = VisitSettingsAPI(failsUpdates: true)
    await api.holdUpdates()
    let tabs = VisitTabs()
    let window = try await host(PrivacyView(deleteAccount: nil), settings: api, tabs: tabs)

    try activate(where: { $0.hasPrefix(Self.shareUsage) }, in: window)
    await api.waitForHeldUpdate()
    try await leave(tabs, meanwhile: { await api.releaseUpdate() })

    XCTAssertFalse(shows(Self.didntSave, in: window), "Nothing of it: \(spoken(in: window))")
  }

  func testAMemorySwitchThatDidntSaveIsGoneOnReturn() async throws {
    let api = VisitSettingsAPI(failsUpdates: true)
    let tabs = VisitTabs()
    let window = try await host(MemoryView { _ in }, settings: api, tabs: tabs)

    try activate(where: { $0.hasPrefix(Self.useMemory) }, in: window)
    try await settle()
    XCTAssertTrue(shows(Self.didntSave, in: window), "The failure shows: \(spoken(in: window))")

    try await leaveAndComeBack(tabs)
    XCTAssertFalse(shows(Self.didntSave, in: window), "Gone on return: \(spoken(in: window))")
  }

  func testAMemorySwitchThatFailsAfterTheLearnerLeftSaysNothing() async throws {
    let api = VisitSettingsAPI(failsUpdates: true)
    await api.holdUpdates()
    let tabs = VisitTabs()
    let window = try await host(MemoryView { _ in }, settings: api, tabs: tabs)

    try activate(where: { $0.hasPrefix(Self.useMemory) }, in: window)
    await api.waitForHeldUpdate()
    try await leave(tabs, meanwhile: { await api.releaseUpdate() })

    XCTAssertFalse(shows(Self.didntSave, in: window), "Nothing of it: \(spoken(in: window))")
  }

  func testAReminderThatDidntSaveIsGoneOnReturn() async throws {
    let api = VisitRemindersAPI()
    let tabs = VisitTabs()
    let window = try await host(RemindersView {}, reminders: api, tabs: tabs)

    try activate(where: { $0.hasPrefix(Self.email) }, in: window)
    try await settle()
    XCTAssertTrue(shows(Self.didntSave, in: window), "The failure shows: \(spoken(in: window))")

    try await leaveAndComeBack(tabs)
    XCTAssertFalse(shows(Self.didntSave, in: window), "Gone on return: \(spoken(in: window))")
  }

  func testAReminderThatFailsAfterTheLearnerLeftSaysNothing() async throws {
    let api = VisitRemindersAPI()
    await api.holdUpdates()
    let tabs = VisitTabs()
    let window = try await host(RemindersView {}, reminders: api, tabs: tabs)

    try activate(where: { $0.hasPrefix(Self.email) }, in: window)
    await api.waitForHeldUpdate()
    try await leave(tabs, meanwhile: { await api.releaseUpdate() })

    XCTAssertFalse(shows(Self.didntSave, in: window), "Nothing of it: \(spoken(in: window))")
  }

  /// The failure is the editor's, not a line every account page shares.
  func testAProfileThatDidntSaveIsGoneOnReturn() async throws {
    let accounts = SwitchingAccountAPI()
    let session = await accounts.signedIn(as: "learner")
    let account = try XCTUnwrap(session.account)
    let tabs = VisitTabs()
    try readsWhatVoiceOverReads()
    let window = try show(
      VisitTabsView(tabs: tabs) {
        ProfileEditorView(account: account, isRequiredSetup: false)
      }
      .appDependencies(
        AppDependencies(
          clients: APIClientFactory(
            baseURL: URL(string: "https://api.zoonk.test")!, transport: OfflineTransport()),
          session: session, imageLoader: .live(), subscriptionStore: .live())
      )
      .zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: 420, height: 912)
    try await settle()

    try activate(String(localized: "Save", table: "Account"), in: window)
    try await settle()
    XCTAssertTrue(
      shows(Self.profileDidntSave, in: window), "The failure shows: \(spoken(in: window))")

    try await leaveAndComeBack(tabs)
    XCTAssertFalse(
      shows(Self.profileDidntSave, in: window), "Gone on return: \(spoken(in: window))")
  }

  /// The glasses' sheet closed and opened again: its failure was that opening's.
  func testGlassesThatDidntGoOnAreGoneWhenTheSheetOpensAgain() async throws {
    let api = VisitBuddyAPI()
    let opening = VisitTabs()
    let store = BuddyStore(
      api: api, cache: AppCache(session: .preview(account: .planTestAccount)))
    await store.status.load()
    let status = try XCTUnwrap(store.status.value)
    try readsWhatVoiceOverReads()
    let window = try show(
      GlassesSheet(opening: opening, status: status)
        .environment(store)
        .appDependencies(.hosted())
        .zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: 420, height: 912)
    try await settle()

    try activate(where: { $0.hasPrefix(Self.star) }, in: window)
    try await settle()
    XCTAssertTrue(
      shows(Self.buddyDidntSave, in: window), "The failure shows: \(spoken(in: window))")

    opening.selected = 1
    try await settle()
    opening.selected = 0
    try await settle()
    XCTAssertFalse(
      shows(Self.buddyDidntSave, in: window), "Gone on the next opening: \(spoken(in: window))")
  }

  /// The name on the certificates, changed on a certificate's page: its failure is that page's.
  func testACertificateNameThatDidntSaveIsGoneOnReturn() async throws {
    let tabs = VisitTabs()
    let window = try await hostCertificate(tabs: tabs)
    try activate(
      where: { $0.hasPrefix(String(localized: "Name", table: "Certificates")) }, in: window)
    try await settle()
    let field = try XCTUnwrap(textFields(in: window).first, "The name's field")
    field.becomeFirstResponder()
    field.insertText(" Souza")
    try await settle()

    try activate(String(localized: "Save", table: "Certificates"), in: window)
    try await settle()
    XCTAssertTrue(
      shows(Self.profileDidntSave, in: window), "The failure shows: \(spoken(in: window))")

    try await leaveAndComeBack(tabs)
    XCTAssertFalse(
      shows(Self.profileDidntSave, in: window), "Gone on return: \(spoken(in: window))")
  }

  func testAPrintThatFailedIsGoneOnReturn() async throws {
    let tabs = VisitTabs()
    let window = try await hostCertificate(tabs: tabs)
    let failure = String(
      localized: "That didn't work. Try again in a moment.", table: "Certificates")

    try activate(String(localized: "Print", table: "Certificates"), in: window)
    for _ in 0..<25 where !shows(failure, in: window) {
      try await settle()
    }
    XCTAssertTrue(shows(failure, in: window), "The failure shows: \(spoken(in: window))")

    try await leaveAndComeBack(tabs)
    XCTAssertFalse(shows(failure, in: window), "Gone on return: \(spoken(in: window))")
  }

  private static let didntSave = String(
    localized: "That didn't save. Try again.", table: "Settings")
  /// What a profile save says when it fails with an error the account API doesn't name.
  private static let profileDidntSave = String(
    localized: "We couldn't log you in. Try again or email hello@zoonk.com.", table: "Account")
  private static let buddyDidntSave = String(
    localized: "We couldn't save your buddy. Try again.", table: "Buddy")
  private static let sounds = String(localized: "Sounds", table: "Settings")
  private static let shareUsage = String(localized: "Share usage data", table: "Settings")
  private static let useMemory = String(localized: "Use memory", table: "Settings")
  private static let email = String(localized: "Email", table: "Reminders")
  private static let star = String(localized: "Star", table: "Buddy")

  private func host(
    _ page: some View, settings: VisitSettingsAPI, tabs: VisitTabs
  ) async throws -> UIWindow {
    let dependencies = AppDependencies.hosted()
    return try await host(
      page.environment(SettingsStore(api: settings, cache: dependencies.cache)),
      dependencies: dependencies, tabs: tabs)
  }

  private func host(
    _ page: some View, reminders: VisitRemindersAPI, tabs: VisitTabs
  ) async throws -> UIWindow {
    let dependencies = AppDependencies.hosted()
    return try await host(
      page.environment(
        StudyRemindersStore(
          api: reminders, cache: dependencies.cache, push: PushNotifications.shared)),
      dependencies: dependencies, tabs: tabs)
  }

  /// Shows the page once what it reads has loaded.
  private func host(
    _ page: some View, dependencies: AppDependencies, tabs: VisitTabs
  ) async throws -> UIWindow {
    try readsWhatVoiceOverReads()
    let window = try show(
      VisitTabsView(tabs: tabs) { page }
        .appDependencies(dependencies)
        .environment(AppRouter())
        .zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: 420, height: 912)
    try await settle()
    try await settle()
    return window
  }

  /// A certificate's own page, for a learner whose name saves fail. Its file is at an address no
  /// one answers, so printing fails.
  private func hostCertificate(tabs: VisitTabs) async throws -> UIWindow {
    let accounts = SwitchingAccountAPI()
    let session = await accounts.signedIn(as: "learner")
    let dependencies = AppDependencies(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!, transport: OfflineTransport()),
      session: session, imageLoader: .live(), subscriptionStore: .live())
    let window = try await host(
      CertificateScreen(code: VisitCertificatesAPI.code)
        .environment(CertificatesStore(api: VisitCertificatesAPI(), cache: dependencies.cache)),
      dependencies: dependencies, tabs: tabs)
    // Tall enough to draw the whole page, the name's row under the details included.
    window.frame = CGRect(x: 0, y: 0, width: 420, height: 1600)
    try await settle()
    return window
  }

  private func textFields(in view: UIView) -> [UITextField] {
    ((view as? UITextField).map { [$0] } ?? []) + view.subviews.flatMap { textFields(in: $0) }
  }

  private func shows(_ line: String, in window: UIWindow) -> Bool {
    spoken(in: window).contains { $0.contains(line) }
  }

  private func leaveAndComeBack(_ tabs: VisitTabs) async throws {
    try await leave(tabs, meanwhile: {})
  }

  /// Goes to the other tab, lets `meanwhile` happen there, and comes back.
  private func leave(_ tabs: VisitTabs, meanwhile: () async -> Void) async throws {
    tabs.selected = 1
    try await settle()
    await meanwhile()
    try await settle()
    tabs.selected = 0
    try await settle()
  }

  private func settle() async throws {
    try await Task.sleep(for: .milliseconds(400))
  }
}

@MainActor
@Observable
private final class VisitTabs {
  var selected = 0
}

/// The page in one tab, and somewhere else to go.
private struct VisitTabsView<Page: View>: View {
  @Bindable var tabs: VisitTabs
  @ViewBuilder let page: Page

  var body: some View {
    TabView(selection: $tabs.selected) {
      NavigationStack {
        page
      }
      .tag(0)

      Text(verbatim: "Elsewhere")
        .tag(1)
    }
  }
}

/// The glasses' sheet, open while `opening` is 0.
private struct GlassesSheet: View {
  @Bindable var opening: VisitTabs
  let status: BuddyStatus

  var body: some View {
    if opening.selected == 0 {
      BuddyGlassesPicker(status: status)
    } else {
      Text(verbatim: "Closed")
    }
  }
}

/// Answers what the settings pages read; a change fails when the test says, after it's released
/// when held.
private actor VisitSettingsAPI: SettingsAPIClient {
  private let failsUpdates: Bool
  private var holds = false
  private var held: CheckedContinuation<Void, Never>?
  private var heldWaiter: CheckedContinuation<Void, Never>?

  init(failsUpdates: Bool) {
    self.failsUpdates = failsUpdates
  }

  func holdUpdates() { holds = true }

  func waitForHeldUpdate() async {
    guard held == nil else {
      return
    }

    await withCheckedContinuation { heldWaiter = $0 }
  }

  func releaseUpdate() {
    held?.resume()
    held = nil
  }

  private func update() async throws {
    if holds {
      holds = false
      await withCheckedContinuation { continuation in
        held = continuation
        heldWaiter?.resume()
        heldWaiter = nil
      }
    }

    if failsUpdates {
      throw APIError.unavailable
    }
  }

  func getPreferences(token: String) async throws -> LearningPreferences {
    .visitFixture
  }

  func updatePreferences(token: String, _ update: PreferencesUpdate) async throws
    -> LearningPreferences
  {
    try await self.update()
    return .visitFixture
  }

  func getMemory(token: String) async throws -> LearnerMemory {
    LearnerMemory(enabled: true, facts: [])
  }

  func setMemoryEnabled(token: String, _ enabled: Bool) async throws {
    try await update()
  }

  func updateMemoryFact(token: String, factId: String, statement: String) async throws
    -> MemoryFact
  {
    throw APIError.unavailable
  }

  func deleteMemoryFact(token: String, factId: String) async throws -> MemoryFact {
    throw APIError.unavailable
  }

  func restoreMemoryFact(token: String, factId: String) async throws -> [MemoryFact]? {
    nil
  }

  func getAllowance(token: String) async throws -> PlanAllowance { throw APIError.notFound }
  func getFreePlan() async throws -> FreePlan { throw APIError.notFound }
  func getWebPlus(token: String) async throws -> WebPlus { throw APIError.notFound }
  func cancelWebPlus(token: String) async throws {}
  func keepWebPlus(token: String) async throws {}
  func exportMemory(token: String) async throws -> Data { Data() }
  func exportAccountData(token: String) async throws -> Data { Data() }

  func getProfileQuestions(token: String) async throws -> ProfileQuestions {
    throw APIError.notFound
  }

  func answerProfileQuestion(token: String, _ input: Components.Schemas.ProfileAnswerInput)
    async throws -> ProfileQuestionView
  {
    throw APIError.notFound
  }
}

/// A reminder with email off, whose changes fail, after they're released when held.
private actor VisitRemindersAPI: StudyRemindersAPIClient {
  private var holds = false
  private var held: CheckedContinuation<Void, Never>?
  private var heldWaiter: CheckedContinuation<Void, Never>?

  func holdUpdates() { holds = true }

  func waitForHeldUpdate() async {
    guard held == nil else {
      return
    }

    await withCheckedContinuation { heldWaiter = $0 }
  }

  func releaseUpdate() {
    held?.resume()
    held = nil
  }

  func getReminder(token: String) async throws -> StudyReminder {
    StudyReminder(
      time: "20:00", timeZone: "America/Sao_Paulo", emailOn: false,
      emailAddress: "learner@zoonk.test", pushOn: false, phone: nil, quiet: false)
  }

  func updateReminder(token: String, _ change: StudyReminderChange) async throws -> StudyReminder {
    if holds {
      holds = false
      await withCheckedContinuation { continuation in
        held = continuation
        heldWaiter?.resume()
        heldWaiter = nil
      }
    }

    throw APIError.unavailable
  }

  func claimOffer(token: String) async throws -> Bool { false }

  func selectPhone(token: String, pushToken: String) async throws -> StudyReminder {
    throw APIError.unavailable
  }
}

/// One certificate, issued to "learner", whose print file no one answers for.
private actor VisitCertificatesAPI: CertificatesAPIClient {
  static let code = "COURSE000001"

  func list(token: String) async throws -> [OwnedCertificate] {
    let json = #"""
      [{"code": "\#(Self.code)", "kind": "course", "recipientName": "learner",
       "completedOn": "2026-11-03", "title": "Quantum physics from scratch",
       "courseLevel": "beginner", "targetLanguage": null, "level": null, "topics": ["Variables"],
       "canDo": [], "lessonsStudied": 148, "lessonsTestedOut": 0, "minutes": 2460,
       "locked": false, "shownAt": null, "url": "https://zoonk.com/c/\#(Self.code)",
       "imageUrls": {"screen": "https://zoonk.invalid/a.png", "print": "https://zoonk.invalid/b.png",
         "link": "https://zoonk.invalid/c.png", "post": "https://zoonk.invalid/d.png"},
       "linkedInUrl": "https://www.linkedin.com/profile/add"}]
      """#
    return try JSONDecoder().decode([OwnedCertificate].self, from: Data(json.utf8))
  }

  func markShown(token: String, code: String) async throws {}

  func claim(token: String, goalID: String) async throws -> [ClaimedCertificate] {
    []
  }

  func upNext(token: String) async throws -> [CertificateUpNext] {
    []
  }
}

/// A buddy with two pairs of glasses earned, whose saves fail.
private final class VisitBuddyAPI: BuddyAPIClient, @unchecked Sendable {
  func status(timeZone: String, token: String) async throws -> BuddyStatus {
    BuddyStatus(
      belt: .init(
        bpPerLevel: 100, bpToNextLevel: 50, color: "white", isMaxLevel: false, level: 1,
        progressInLevel: 50, totalBrainPower: 50),
      buddy: .init(glasses: .round, kind: .zu, name: nil, picked: true),
      energy: .init(current: 72, state: .awake, studiedToday: true),
      firstSteps: nil,
      glasses: [
        .init(current: 1, earned: true, glasses: .round, target: 1),
        .init(current: 1, earned: true, glasses: .star, target: 1),
      ],
      nextStage: nil,
      stage: .baby,
      thisWeek: .init(fixes: 0, newIdeas: 0, reviews: 0),
      today: nil)
  }

  func save(_ buddy: BuddyChoice, token: String) async throws {
    throw APIError.unavailable
  }

  func earlierQuestions(cursor: String?, token: String) async throws -> EarlierQuestionsPage {
    EarlierQuestionsPage(questions: [], nextCursor: nil)
  }

  func answer(insightId: String, accepted: Bool, quote: PlanChangeQuote?, token: String)
    async throws -> MemoryInsight?
  {
    nil
  }
}

extension LearningPreferences {
  fileprivate static let visitFixture = LearningPreferences(
    buddy: BuddyChoice(kind: .otto, name: nil, glasses: .round),
    buddyPicked: true,
    availableGlasses: [.round],
    soundsEnabled: true)
}
