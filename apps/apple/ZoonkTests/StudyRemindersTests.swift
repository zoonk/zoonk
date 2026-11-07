import XCTest

@testable import Zoonk

@MainActor
final class StudyRemindersTests: XCTestCase {
  func testRemindMeSelectsThisPhoneBeforeTurningPushOn() async throws {
    let api = RemindersAPIStub()
    let store = try await makeStore(api: api, push: PushStub(token: "phone"))

    let result = await store.turnOnPush(at: "20:30")

    XCTAssertEqual(result, .on)
    let calls = await api.calls
    XCTAssertEqual(calls, ["select a phone", "update a 20:30 push true"])
  }

  func testRemindMeWithoutPermissionSavesNothing() async throws {
    let api = RemindersAPIStub()
    let store = try await makeStore(api: api, push: PushStub(token: "phone", allows: false))

    let result = await store.turnOnPush(at: "20:30")

    XCTAssertEqual(result, .denied)
    let calls = await api.calls
    XCTAssertEqual(calls, [])
  }

  func testRemindMeIsntOnWhenPushFailsAfterThePhoneSaved() async throws {
    let api = RemindersAPIStub(updateFails: true)
    let store = try await makeStore(api: api, push: PushStub(token: "phone"))

    let result = await store.turnOnPush(at: "20:30")

    XCTAssertEqual(result, .failed)
    let calls = await api.calls
    XCTAssertEqual(calls, ["select a phone", "update a 20:30 push true"])
  }

  func testSettingsTurnsPushOnForThisPhoneOnlyWithPermission() async throws {
    let context = try await context(token: "a")
    context.defaults.set("phone", forKey: "studyReminderPushToken")
    let api = RemindersAPIStub(phones: ["a": "phone"])
    let store = StudyRemindersStore(
      api: api, cache: AppCache(session: context.session),
      push: PushStub(token: "phone", allows: false), defaults: context.defaults)
    await store.reminder.load()
    let reminder = try XCTUnwrap(store.reminder.value)

    let result = await store.setPush(true, in: reminder)

    XCTAssertEqual(result, .denied)
    let calls = await api.calls
    XCTAssertEqual(calls, ["get a"], "blocked notifications never turn push on")
  }

  func testRegistrationStartedByACannotEnablePushForB() async throws {
    let context = try await context(token: "a")
    let registration = RegistrationGate()
    let api = RemindersAPIStub()
    let store = StudyRemindersStore(
      api: api, cache: AppCache(session: context.session),
      push: PushStub(token: "phone", registration: registration), defaults: context.defaults)
    let setup = Task { await store.turnOnPush(at: "20:30") }
    await registration.waitUntilStarted()

    try context.credentials.save("b")
    await context.session.reconcileSynchronizedCredential()
    XCTAssertEqual(context.session.authenticatedSession?.bearerToken, "b")
    registration.finish()
    _ = await setup.value

    let calls = await api.calls
    XCTAssertEqual(calls, [], "A's pending setup must not select a phone or enable push for B")
  }

  func testLaunchingBDoesNotLoseTheTokenRefreshOwedToA() async throws {
    let context = try await context(token: "b")
    context.defaults.set("old-token", forKey: "studyReminderPushToken")
    let api = RemindersAPIStub(phones: ["a": "old-token"])
    let store = StudyRemindersStore(
      api: api, cache: AppCache(session: context.session), push: PushStub(token: "new-token"),
      defaults: context.defaults)
    await store.refreshPhoneToken()

    try context.credentials.save("a")
    await context.session.reconcileSynchronizedCredential()
    await store.refreshPhoneToken()

    let phone = await api.phone(for: "a")
    XCTAssertEqual(phone, "new-token", "A still selected this installation and needs its new token")
  }

  func testSignOutWaitsUntilThePhoneIsRemoved() async throws {
    let context = try await context(token: "a")
    context.defaults.set("phone", forKey: "studyReminderPushToken")
    let api = RemindersAPIStub(phones: ["a": "phone"], removalFails: true)
    let store = StudyRemindersStore(
      api: api, cache: AppCache(session: context.session), push: PushStub(token: "phone"),
      defaults: context.defaults)
    context.session.willSignOut = { try await store.forgetThisPhone($0) }

    await context.session.signOut()

    let phone = await api.phone(for: "a")
    XCTAssertEqual(phone, "phone")
    XCTAssertEqual(
      context.session.authenticatedSession?.bearerToken, "a",
      "a sign-out that left this phone receiving A's reminders didn't happen, so it can be retried")
    XCTAssertEqual(context.session.failure, .network)
  }

  func testPickedTimesRoundToTheQuarterHourTheyArriveAt() {
    XCTAssertEqual(ReminderTime.rounded("20:07"), "20:00")
    XCTAssertEqual(ReminderTime.rounded("20:08"), "20:15")
    XCTAssertEqual(ReminderTime.rounded("07:52"), "07:45")
    XCTAssertEqual(ReminderTime.rounded("23:53"), "00:00")
  }

  func testATappedReminderMakesItsGoalActiveThenOpensToday() async throws {
    let tap = try XCTUnwrap(
      StudyReminderTap(["type": "study_reminder", "goalId": "goal-2", "aps": [:]]))
    XCTAssertNil(StudyReminderTap(["type": "other", "goalId": "goal-2"]))
    XCTAssertNil(StudyReminderTap(["type": "study_reminder"]))

    let router = AppRouter()
    router.select(.plan)
    router.open(.session)
    var switched: [String] = []

    await router.openStudyReminder(goalID: tap.goalID) { goalID in
      switched.append(goalID)
      return .failed(.network)
    }

    XCTAssertEqual(switched, ["goal-2"])
    XCTAssertEqual(router.selectedTab, .today, "a failed switch still opens Today")
    XCTAssertEqual(router.tasks, [])
  }

  private func makeStore(api: RemindersAPIStub, push: PushStub) async throws
    -> StudyRemindersStore
  {
    let context = try await context(token: "a")
    return StudyRemindersStore(
      api: api, cache: AppCache(session: context.session), push: push, defaults: context.defaults)
  }

  private func context(token: String) async throws -> (
    session: SessionStore, credentials: InMemorySessionCredentialStore, defaults: UserDefaults
  ) {
    let credentials = InMemorySessionCredentialStore(token: token)
    let session = SessionStore(
      api: AccountAPIStub(), credentialStore: credentials,
      googleAuthentication: GoogleAuthenticationStub())
    await session.restore()
    XCTAssertEqual(session.authenticatedSession?.bearerToken, token)
    let defaults = try XCTUnwrap(UserDefaults(suiteName: UUID().uuidString))
    return (session, credentials, defaults)
  }
}

@MainActor
private final class RegistrationGate {
  private var continuation: CheckedContinuation<Void, Never>?
  private var started: CheckedContinuation<Void, Never>?

  func wait() async {
    await withCheckedContinuation { continuation in
      self.continuation = continuation
      started?.resume()
      started = nil
    }
  }

  func waitUntilStarted() async {
    guard continuation == nil else {
      return
    }

    await withCheckedContinuation { started = $0 }
  }

  func finish() {
    continuation?.resume()
    continuation = nil
  }
}

@MainActor
private final class PushStub: PushAccess {
  let token: String
  let allows: Bool
  let registration: RegistrationGate?

  init(token: String, allows: Bool = true, registration: RegistrationGate? = nil) {
    self.token = token
    self.allows = allows
    self.registration = registration
  }

  func requestAuthorization() async -> Bool { allows }
  func isAuthorized() async -> Bool { allows }

  func deviceToken() async -> String? {
    await registration?.wait()
    return token
  }
}

/// One reminder per account, keyed by its bearer token.
private actor RemindersAPIStub: StudyRemindersAPIClient {
  private(set) var calls: [String] = []
  private var phones: [String: String]
  private let removalFails: Bool
  private let updateFails: Bool

  init(phones: [String: String] = [:], removalFails: Bool = false, updateFails: Bool = false) {
    self.phones = phones
    self.removalFails = removalFails
    self.updateFails = updateFails
  }

  func phone(for token: String) -> String? { phones[token] }

  func getReminder(token: String) async throws -> StudyReminder {
    calls.append("get \(token)")
    return reminder(token)
  }

  func updateReminder(token: String, _ change: StudyReminderChange) async throws -> StudyReminder {
    calls.append(
      "update \(token) \(change.time ?? "-") push \(change.pushOn.map(String.init) ?? "-")")

    if updateFails {
      throw APIError.unavailable
    }

    return change.applied(to: reminder(token))
  }

  func claimOffer(token: String) async throws -> Bool { true }

  func selectPhone(token: String, pushToken: String) async throws -> StudyReminder {
    calls.append("select \(token) \(pushToken)")
    phones[token] = pushToken
    return reminder(token)
  }

  func removePhone(token: String, pushToken: String) async throws {
    calls.append("remove \(token) \(pushToken)")

    if removalFails {
      throw APIError.network
    }

    if phones[token] == pushToken {
      phones[token] = nil
    }
  }

  private func reminder(_ token: String) -> StudyReminder {
    StudyReminder(
      time: "19:00", timeZone: "America/Sao_Paulo", emailOn: false,
      emailAddress: "\(token)@zoonk.test", pushOn: false,
      phone: phones[token].map { StudyReminder.Phone(label: "iPhone", token: $0) }, quiet: false)
  }
}

private struct AccountAPIStub: AccountAPIClient {
  func getCurrentAccount(token: String) async throws -> CurrentAccount {
    CurrentAccount(
      account: AccountAccess(
        deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
      user: AccountUser(
        email: "\(token)@zoonk.test", id: token, image: nil, name: token, username: token))
  }

  func signInWithEmailCode(email: String, code: String, guestToken: String?) async throws -> String
  {
    "b"
  }

  func signOut(token: String) async throws {}

  func synchronizeAppleSubscription(token: String, signedTransaction: String) async throws
    -> AppleSubscriptionSynchronization
  {
    throw AccountAPIError.invalidResponse
  }
}

@MainActor
private struct GoogleAuthenticationStub: GoogleAuthenticating {
  let isAvailable = false
  func handle(_ url: URL) {}
  func signOut() {}
  func signIn(from anchor: GoogleAuthenticationAnchor) async throws -> String {
    throw GoogleAuthenticationError.unavailable
  }
}
