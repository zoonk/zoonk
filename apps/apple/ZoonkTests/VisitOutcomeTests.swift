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

    try await activate(where: { $0.hasPrefix(Self.sounds) }, in: window)
    try await waitForTestCondition("Expected state did not arrive") {
      shows(Self.didntSave, in: window)
    }
    XCTAssertTrue(shows(Self.didntSave, in: window), "The failure shows: \(spoken(in: window))")

    try await leaveAndComeBack(tabs, in: window)
    XCTAssertFalse(shows(Self.didntSave, in: window), "Gone on return: \(spoken(in: window))")
  }

  func testAPreferenceThatFailsAfterTheLearnerLeftSaysNothing() async throws {
    let api = VisitSettingsAPI(failsUpdates: true)
    await api.holdUpdates()
    let tabs = VisitTabs()
    let window = try await host(PreferencesView(), settings: api, tabs: tabs)

    try await activate(where: { $0.hasPrefix(Self.sounds) }, in: window)
    await api.waitForHeldUpdate()
    try await leave(tabs, in: window, meanwhile: { await api.releaseUpdate() })

    XCTAssertFalse(shows(Self.didntSave, in: window), "Nothing of it: \(spoken(in: window))")
  }

  func testUsageSharingThatDidntSaveIsGoneOnReturn() async throws {
    let api = VisitSettingsAPI(failsUpdates: true)
    let tabs = VisitTabs()
    let window = try await host(PrivacyView(deleteAccount: nil), settings: api, tabs: tabs)

    try await activate(where: { $0.hasPrefix(Self.shareUsage) }, in: window)
    try await waitForTestCondition("Expected state did not arrive") {
      shows(Self.didntSave, in: window)
    }
    XCTAssertTrue(shows(Self.didntSave, in: window), "The failure shows: \(spoken(in: window))")

    try await leaveAndComeBack(tabs, in: window)
    XCTAssertFalse(shows(Self.didntSave, in: window), "Gone on return: \(spoken(in: window))")
  }

  func testUsageSharingThatFailsAfterTheLearnerLeftSaysNothing() async throws {
    let api = VisitSettingsAPI(failsUpdates: true)
    await api.holdUpdates()
    let tabs = VisitTabs()
    let window = try await host(PrivacyView(deleteAccount: nil), settings: api, tabs: tabs)

    try await activate(where: { $0.hasPrefix(Self.shareUsage) }, in: window)
    await api.waitForHeldUpdate()
    try await leave(tabs, in: window, meanwhile: { await api.releaseUpdate() })

    XCTAssertFalse(shows(Self.didntSave, in: window), "Nothing of it: \(spoken(in: window))")
  }

  func testAMemorySwitchThatDidntSaveIsGoneOnReturn() async throws {
    let api = VisitSettingsAPI(failsUpdates: true)
    let tabs = VisitTabs()
    let window = try await host(MemoryView { _ in }, settings: api, tabs: tabs)

    try await activate(where: { $0.hasPrefix(Self.useMemory) }, in: window)
    try await waitForTestCondition("Expected state did not arrive") {
      shows(Self.didntSave, in: window)
    }
    XCTAssertTrue(shows(Self.didntSave, in: window), "The failure shows: \(spoken(in: window))")

    try await leaveAndComeBack(tabs, in: window)
    XCTAssertFalse(shows(Self.didntSave, in: window), "Gone on return: \(spoken(in: window))")
  }

  func testAMemorySwitchThatFailsAfterTheLearnerLeftSaysNothing() async throws {
    let api = VisitSettingsAPI(failsUpdates: true)
    await api.holdUpdates()
    let tabs = VisitTabs()
    let window = try await host(MemoryView { _ in }, settings: api, tabs: tabs)

    try await activate(where: { $0.hasPrefix(Self.useMemory) }, in: window)
    await api.waitForHeldUpdate()
    try await leave(tabs, in: window, meanwhile: { await api.releaseUpdate() })

    XCTAssertFalse(shows(Self.didntSave, in: window), "Nothing of it: \(spoken(in: window))")
  }

  func testAReminderThatDidntSaveIsGoneOnReturn() async throws {
    let api = VisitRemindersAPI()
    let tabs = VisitTabs()
    let window = try await host(RemindersView {}, reminders: api, tabs: tabs)

    try await activate(where: { $0.hasPrefix(Self.email) }, in: window)
    try await waitForTestCondition("Expected state did not arrive") {
      shows(Self.didntSave, in: window)
    }
    XCTAssertTrue(shows(Self.didntSave, in: window), "The failure shows: \(spoken(in: window))")

    try await leaveAndComeBack(tabs, in: window)
    XCTAssertFalse(shows(Self.didntSave, in: window), "Gone on return: \(spoken(in: window))")
  }

  func testAReminderThatFailsAfterTheLearnerLeftSaysNothing() async throws {
    let api = VisitRemindersAPI()
    await api.holdUpdates()
    let tabs = VisitTabs()
    let window = try await host(RemindersView {}, reminders: api, tabs: tabs)

    try await activate(where: { $0.hasPrefix(Self.email) }, in: window)
    await api.waitForHeldUpdate()
    try await leave(tabs, in: window, meanwhile: { await api.releaseUpdate() })

    XCTAssertFalse(shows(Self.didntSave, in: window), "Nothing of it: \(spoken(in: window))")
  }

  /// A later change on the same page doesn't hide an earlier one that failed: the time's save fails
  /// while the email's, made after it, saves, and the page still says so (review of `697b994fb2`).
  func testATimeThatDidntSaveSaysSoWhenTheEmailSavedMeanwhile() async throws {
    let api = VisitRemindersAPI(fails: { $0.time != nil })
    await api.holdUpdates()
    let tabs = VisitTabs()
    let window = try await host(RemindersView {}, reminders: api, tabs: tabs)

    try await waitForTestCondition("The reminder time picker did not appear") {
      !views(UIDatePicker.self, in: window).isEmpty
    }
    let picker = try XCTUnwrap(views(UIDatePicker.self, in: window).first, "The time's picker")
    picker.date = picker.date.addingTimeInterval(3_600)
    picker.sendActions(for: .valueChanged)
    await api.waitForHeldUpdate()
    try await activate(where: { $0.hasPrefix(Self.email) }, in: window)
    await api.releaseUpdate()
    try await waitForTestCondition("Expected state did not arrive") {
      shows(Self.didntSave, in: window)
    }
    XCTAssertTrue(
      shows(Self.didntSave, in: window), "The time's failure shows: \(spoken(in: window))")
  }

  /// Push met blocked notifications: the notice that says so was that visit's.
  func testABlockedPushNoticeIsGoneOnReturn() async throws {
    let tabs = VisitTabs()
    let dependencies = AppDependencies.hosted()
    let window = try await host(
      RemindersView {}.environment(
        StudyRemindersStore(
          api: VisitRemindersAPI(), cache: dependencies.cache, push: BlockedPush())),
      dependencies: dependencies, tabs: tabs)
    let blocked = String(localized: "Notifications are off for Zoonk.", table: "Reminders")

    try await activate(
      where: { $0.hasPrefix(String(localized: "Push notifications", table: "Reminders")) },
      in: window)
    try await waitForTestCondition("Expected state did not arrive") { shows(blocked, in: window) }
    XCTAssertTrue(shows(blocked, in: window), "The notice shows: \(spoken(in: window))")

    try await leaveAndComeBack(tabs, in: window)
    XCTAssertFalse(shows(blocked, in: window), "Gone on return: \(spoken(in: window))")
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
    try await waitForLayout(in: window)

    try await activate(String(localized: "Save", table: "Account"), in: window)
    try await waitForTestCondition("Expected state did not arrive") {
      shows(Self.profileDidntSave, in: window)
    }
    XCTAssertTrue(
      shows(Self.profileDidntSave, in: window), "The failure shows: \(spoken(in: window))")

    try await leaveAndComeBack(tabs, in: window)
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
    try await waitForLayout(in: window)

    try await activate(where: { $0.hasPrefix(Self.star) }, in: window)
    try await waitForTestCondition("Expected state did not arrive") {
      shows(Self.buddyDidntSave, in: window)
    }
    XCTAssertTrue(
      shows(Self.buddyDidntSave, in: window), "The failure shows: \(spoken(in: window))")

    opening.selected = 1
    try await waitForTestCondition("The closed panel did not disappear") {
      !shows(Self.star, in: window)
    }
    opening.selected = 0
    try await waitForTestCondition("Expected state did not arrive") {
      !(shows(Self.buddyDidntSave, in: window))
    }
    XCTAssertFalse(
      shows(Self.buddyDidntSave, in: window), "Gone on the next opening: \(spoken(in: window))")
  }

  /// The name on the certificates, changed on a certificate's page: its failure is that page's.
  func testACertificateNameThatDidntSaveIsGoneOnReturn() async throws {
    let tabs = VisitTabs()
    let window = try await hostCertificate(tabs: tabs)
    try await activate(
      where: { $0.hasPrefix(String(localized: "Name", table: "Certificates")) }, in: window)
    try await waitForTestCondition("The name field did not appear") {
      !textFields(in: window).isEmpty
    }
    let field = try XCTUnwrap(textFields(in: window).first, "The name's field")
    field.becomeFirstResponder()
    field.insertText(" Souza")

    try await activate(String(localized: "Save", table: "Certificates"), in: window)
    try await waitForTestCondition("Expected state did not arrive") {
      shows(Self.profileDidntSave, in: window)
    }
    XCTAssertTrue(
      shows(Self.profileDidntSave, in: window), "The failure shows: \(spoken(in: window))")

    try await leaveAndComeBack(tabs, in: window)
    XCTAssertFalse(
      shows(Self.profileDidntSave, in: window), "Gone on return: \(spoken(in: window))")
  }

  func testAPrintThatFailedIsGoneOnReturn() async throws {
    let tabs = VisitTabs()
    let window = try await hostCertificate(tabs: tabs)
    let failure = String(
      localized: "That didn't work. Try again in a moment.", table: "Certificates")

    try await activate(String(localized: "Print", table: "Certificates"), in: window)
    try await waitForTestCondition("The failure never appeared") { shows(failure, in: window) }
    XCTAssertTrue(shows(failure, in: window), "The failure shows: \(spoken(in: window))")

    try await leaveAndComeBack(tabs, in: window)
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
    try await waitForLayout(in: window)
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
    try await waitForLayout(in: window)
    return window
  }

  private func textFields(in view: UIView) -> [UITextField] {
    views(UITextField.self, in: view)
  }

  private func views<Kind: UIView>(_ kind: Kind.Type, in view: UIView) -> [Kind] {
    ((view as? Kind).map { [$0] } ?? []) + view.subviews.flatMap { views(kind, in: $0) }
  }

  private func shows(_ line: String, in window: UIWindow) -> Bool {
    spoken(in: window).contains { $0.contains(line) }
  }

  private func leaveAndComeBack(_ tabs: VisitTabs, in window: UIWindow) async throws {
    try await leave(tabs, in: window, meanwhile: {})
  }

  /// Goes to the other tab, lets `meanwhile` happen there, and comes back.
  private func leave(_ tabs: VisitTabs, in window: UIWindow, meanwhile: () async -> Void)
    async throws
  {
    tabs.selected = 1
    try await waitForTestCondition("The other tab did not appear") {
      !tabs.pageVisible && spoken(in: window).contains("Elsewhere")
    }
    await meanwhile()
    tabs.selected = 0
    try await waitForTestCondition("The page did not return") {
      tabs.pageVisible && !spoken(in: window).contains("Elsewhere")
    }
  }

}

@MainActor
@Observable
private final class VisitTabs {
  var selected = 0
  var pageVisible = false
}

/// The page in one tab, and somewhere else to go.
private struct VisitTabsView<Page: View>: View {
  @Bindable var tabs: VisitTabs
  @ViewBuilder let page: Page

  var body: some View {
    TabView(selection: $tabs.selected) {
      NavigationStack {
        page
          .onAppear { tabs.pageVisible = true }
          .onDisappear { tabs.pageVisible = false }
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
  private var held: TestContinuation<Void>?
  private var completed = 0
  private var heldWaiter: TestContinuation<Void>?

  init(failsUpdates: Bool) {
    self.failsUpdates = failsUpdates
  }

  func holdUpdates() { holds = true }

  func waitForHeldUpdate(file: StaticString = #filePath, line: UInt = #line) async {
    guard held == nil else {
      return
    }

    await withTestVoidContinuation(file: file, line: line) { heldWaiter = $0 }
  }

  func releaseUpdate(file: StaticString = #filePath, line: UInt = #line) async {
    let before = completed
    held?.resume()
    held = nil
    _ = try? await waitForTestCondition(
      "The released response did not finish", file: file, line: line
    ) { await self.completed > before }
  }

  private func update() async throws {
    defer { completed += 1 }
    if holds {
      holds = false
      await withTestVoidContinuation { continuation in
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

/// A reminder with email off, whose changes fail (those `fails` names) after they're released when
/// held.
private actor VisitRemindersAPI: StudyRemindersAPIClient {
  private static let reminder = StudyReminder(
    time: "20:00", timeZone: "America/Sao_Paulo", emailOn: false,
    emailAddress: "learner@zoonk.test", pushOn: false, phone: nil, quiet: false)

  private let fails: @Sendable (StudyReminderChange) -> Bool
  private var holds = false
  private var held: TestContinuation<Void>?
  private var completed = 0
  private var heldWaiter: TestContinuation<Void>?

  init(fails: @escaping @Sendable (StudyReminderChange) -> Bool = { _ in true }) {
    self.fails = fails
  }

  func holdUpdates() { holds = true }

  func waitForHeldUpdate(file: StaticString = #filePath, line: UInt = #line) async {
    guard held == nil else {
      return
    }

    await withTestVoidContinuation(file: file, line: line) { heldWaiter = $0 }
  }

  func releaseUpdate(file: StaticString = #filePath, line: UInt = #line) async {
    let before = completed
    held?.resume()
    held = nil
    _ = try? await waitForTestCondition(
      "The released response did not finish", file: file, line: line
    ) { await self.completed > before }
  }

  func getReminder(token: String) async throws -> StudyReminder {
    Self.reminder
  }

  func updateReminder(token: String, _ change: StudyReminderChange) async throws -> StudyReminder {
    defer { completed += 1 }
    if holds {
      holds = false
      await withTestVoidContinuation { continuation in
        held = continuation
        heldWaiter?.resume()
        heldWaiter = nil
      }
    }

    guard !fails(change) else {
      throw APIError.unavailable
    }

    return change.applied(to: Self.reminder)
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

/// Notifications the learner blocked in the system's Settings.
private final class BlockedPush: PushAccess {
  func requestAuthorization() async -> Bool { false }
  func deviceToken() async -> String? { nil }
  func isAuthorized() async -> Bool { false }
  func isDenied() async -> Bool { true }
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
