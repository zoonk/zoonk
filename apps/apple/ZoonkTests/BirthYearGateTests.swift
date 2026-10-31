import XCTest

@testable import Zoonk

@MainActor
final class BirthYearGateTests: XCTestCase {
  func testAVisitorsWriteWaitsForTheYearThenGoesOnAsAGuestWithItSaved() async {
    let app = makeApp(checks: [.accepted], saves: [.accepted])

    let write = Task { await app.gate.startGuest() }
    await waitUntil { app.gate.prompt == .question(canCancel: true) }
    XCTAssertEqual(app.accounts.guestStarts, 0, "No guest starts before the year is answered")

    await app.gate.submit(1990)

    let started = await write.value
    XCTAssertTrue(started)
    let checked = await app.birthYears.checked
    XCTAssertEqual(checked, [1990])
    XCTAssertEqual(app.accounts.guestStarts, 1)
    let saved = await app.birthYears.saved
    XCTAssertEqual(saved.map(\.year), [1990])
    XCTAssertEqual(saved.map(\.token), [GuestAccountAPI.guestToken])
    XCTAssertNil(app.gate.prompt)
  }

  func testAVisitorWhoBacksOutStartsNothing() async {
    let app = makeApp()

    let write = Task { await app.gate.startGuest() }
    await waitUntil { app.gate.prompt != nil }
    app.gate.close()

    let started = await write.value
    XCTAssertFalse(started)
    XCTAssertEqual(app.accounts.guestStarts, 0)
    XCTAssertNil(app.gate.prompt)
  }

  func testAYearThatCantBeRealStartsNoGuest() async {
    let app = makeApp(checks: [.invalidYear])

    let write = Task { await app.gate.startGuest() }
    await waitUntil { app.gate.prompt != nil }
    await app.gate.submit(2027)

    XCTAssertEqual(app.gate.failure, .invalidYear)
    XCTAssertEqual(app.gate.prompt, .question(canCancel: true))
    XCTAssertEqual(app.accounts.guestStarts, 0)

    app.gate.close()
    _ = await write.value
  }

  func testACheckThatDoesntArriveStartsNoGuest() async {
    let app = makeApp(checks: [.failure(.network)])

    let write = Task { await app.gate.startGuest() }
    await waitUntil { app.gate.prompt != nil }
    await app.gate.submit(1990)

    XCTAssertEqual(app.gate.failure, .unsaved)
    XCTAssertEqual(app.gate.prompt, .question(canCancel: true))
    XCTAssertEqual(app.accounts.guestStarts, 0)

    app.gate.close()
    _ = await write.value
  }

  func testAFailedSaveKeepsTheUnseenGuestAndAsksAgain() async {
    let app = makeApp(checks: [.accepted], saves: [.failure(.network), .accepted])

    let write = Task { await app.gate.startGuest() }
    await waitUntil { app.gate.prompt != nil }
    await app.gate.submit(1990)

    XCTAssertEqual(app.gate.failure, .unsaved)
    XCTAssertEqual(
      app.gate.prompt, .question(canCancel: false), "A guest exists now, so it must answer")
    XCTAssertNil(app.session.authenticatedSession, "Nothing can learn as the guest yet")
    app.gate.close()
    XCTAssertEqual(app.gate.prompt, .question(canCancel: false))

    await app.gate.submit(1990)

    let started = await write.value
    XCTAssertTrue(started)
    XCTAssertEqual(app.accounts.guestStarts, 1)
    XCTAssertEqual(app.session.authenticatedSession?.bearerToken, GuestAccountAPI.guestToken)
    let checked = await app.birthYears.checked
    XCTAssertEqual(checked, [1990], "The guest's retry only saves")
  }

  func testTheGuestIsSignedInOnlyOnceItsYearIsSaved() async {
    let app = makeApp(checks: [.accepted], saves: [.accepted])
    let finished = Finished()

    let write = Task { await app.gate.startGuest() }
    await waitUntil { app.gate.prompt != nil }
    await app.birthYears.holdNext(.save)
    let submit = Task { await app.gate.submit(1990) }
    await waitUntilHeld(app.birthYears)

    XCTAssertEqual(app.accounts.guestStarts, 1)
    XCTAssertNil(
      app.session.authenticatedSession, "A lesson keyed to the session can't load yet")
    let laterWrite = Task {
      let started = await app.gate.startGuest()
      finished.writes += 1
      return started
    }
    await Task.yield()
    XCTAssertEqual(finished.writes, 0, "Another write waits for the same save")

    await app.birthYears.release()
    await submit.value

    let started = await write.value
    let laterStarted = await laterWrite.value
    XCTAssertTrue(started)
    XCTAssertTrue(laterStarted)
    XCTAssertEqual(app.session.authenticatedSession?.bearerToken, GuestAccountAPI.guestToken)
  }

  func testALateCheckDoesntReplaceAnAccountThatSignedInMeanwhile() async {
    let app = makeApp(checks: [.accepted])

    let write = Task { await app.gate.startGuest() }
    await waitUntil { app.gate.prompt != nil }
    await app.birthYears.holdNext(.check)
    let submit = Task { await app.gate.submit(1990) }
    await waitUntilHeld(app.birthYears)

    await app.session.signInWithEmailCode(email: "learner@zoonk.test", code: "123456")
    await app.birthYears.release()
    await submit.value

    let started = await write.value
    XCTAssertFalse(started)
    XCTAssertEqual(app.accounts.guestStarts, 0)
    XCTAssertEqual(app.session.authenticatedSession?.bearerToken, GuestAccountAPI.accountToken)
  }

  func testALateRefusalDoesntLogOutAnAccountThatSignedInMeanwhile() async {
    let device = makeDefaultsSuite()
    let app = makeApp(checks: [.belowMinimumAge(13)], device: device)

    let write = Task { await app.gate.startGuest() }
    await waitUntil { app.gate.prompt != nil }
    await app.birthYears.holdNext(.check)
    let submit = Task { await app.gate.submit(2014) }
    await waitUntilHeld(app.birthYears)

    await app.session.signInWithEmailCode(email: "learner@zoonk.test", code: "123456")
    await app.birthYears.release()
    await submit.value

    let started = await write.value
    XCTAssertFalse(started)
    XCTAssertNotEqual(app.gate.prompt, .belowMinimumAge(13, logsOut: true))
    XCTAssertNotNil(app.session.account)
  }

  func testAQuestionAVisitorLeftOpenEndsWhenTheySignIn() async {
    let app = makeApp()

    let write = Task { await app.gate.startGuest() }
    await waitUntil { app.gate.prompt != nil }
    await app.session.signInWithEmailCode(email: "learner@zoonk.test", code: "123456")
    app.gate.followSession()

    let started = await write.value
    XCTAssertFalse(started)
    XCTAssertEqual(app.accounts.guestStarts, 0)
  }

  func testACancelledWriteStopsWaitingAndClosesTheQuestion() async {
    let app = makeApp()

    let write = Task { await app.gate.startGuest() }
    await waitUntil { app.gate.prompt != nil }
    write.cancel()

    let started = await write.value
    XCTAssertFalse(started)
    await waitUntil { app.gate.prompt == nil }
  }

  func testClosingWhileTheYearIsCheckedChangesNothing() async {
    let app = makeApp(checks: [.accepted], saves: [.accepted])

    let write = Task { await app.gate.startGuest() }
    await waitUntil { app.gate.prompt != nil }
    await app.birthYears.holdNext(.check)
    let submit = Task { await app.gate.submit(1990) }
    await waitUntilHeld(app.birthYears)

    app.gate.close()
    XCTAssertTrue(app.gate.isSaving)
    XCTAssertEqual(app.gate.prompt, .question(canCancel: true))

    await app.birthYears.release()
    await submit.value

    let started = await write.value
    XCTAssertTrue(started, "The answer the learner sent goes on")
  }

  func testATooYoungVisitorNeverGetsAnAccountAndCantTryAnotherYear() async {
    let app = makeApp(checks: [.belowMinimumAge(14)])

    let write = Task { await app.gate.startGuest() }
    await waitUntil { app.gate.prompt != nil }
    await app.gate.submit(2014)

    let started = await write.value
    XCTAssertFalse(started)
    XCTAssertEqual(app.accounts.guestStarts, 0)
    XCTAssertEqual(app.gate.prompt, .belowMinimumAge(14, logsOut: false))

    app.gate.close()
    XCTAssertNil(app.gate.prompt)
    let retried = await app.gate.startGuest()

    XCTAssertFalse(retried)
    XCTAssertEqual(app.gate.prompt, .belowMinimumAge(14, logsOut: false))
    let checked = await app.birthYears.checked
    XCTAssertEqual(checked, [2014], "No other year is asked")
    XCTAssertEqual(app.accounts.guestStarts, 0)
  }

  func testAVisitorsOpenRefusalNeverReachesAnAccountThatHasItsYear() async {
    let app = makeApp(checks: [.belowMinimumAge(13)], accountNeedsYear: false)

    let write = Task { await app.gate.startGuest() }
    await waitUntil { app.gate.prompt != nil }
    await app.gate.submit(2014)
    _ = await write.value
    XCTAssertEqual(app.gate.prompt, .belowMinimumAge(13, logsOut: false))

    await app.signIn()

    XCTAssertNil(app.gate.prompt, "No logout for an account that answered already")

    app.gate.followSession()
    await app.session.signOut()
    app.gate.followSession()

    XCTAssertNil(app.gate.prompt, "The visitor's message doesn't come back")
  }

  func testTheDeviceForgetsARefusalAfterADay() async {
    let clock = TestClock()
    let device = makeDefaultsSuite()
    await refuseAVisitor(on: device, clock: clock)

    clock.now += 24 * 60 * 60
    let app = makeApp(device: device, clock: clock)
    let write = Task { await app.gate.startGuest() }
    await waitUntil { app.gate.prompt != nil }

    XCTAssertEqual(app.gate.prompt, .question(canCancel: true))

    app.gate.close()
    _ = await write.value
  }

  func testAnAccountThatNeedsItsYearIsAskedUntilItSavesOne() async {
    let app = makeApp(saves: [.accepted])
    await app.signIn()

    XCTAssertEqual(app.gate.prompt, .question(canCancel: false))

    await app.gate.submit(1990)

    XCTAssertNil(app.gate.prompt)
    XCTAssertEqual(app.summary.value?.needsBirthYear, false)
  }

  func testATooYoungAccountLogsOutWithOKAndIsRemembered() async {
    let device = makeDefaultsSuite()
    let app = makeApp(saves: [.belowMinimumAge(13)], signOutError: .network, device: device)
    await app.signIn()

    await app.gate.submit(2014)

    XCTAssertEqual(app.gate.prompt, .belowMinimumAge(13, logsOut: true))
    app.gate.close()
    XCTAssertEqual(
      app.gate.prompt, .belowMinimumAge(13, logsOut: true), "An account can't close it")
    XCTAssertTrue(app.accounts.signOuts.isEmpty, "Nothing changes until OK")

    await app.gate.logOut()

    XCTAssertEqual(app.accounts.signOuts, [GuestAccountAPI.accountToken])
    XCTAssertNil(app.session.account, "Forgotten here even when the server couldn't be told")
    XCTAssertNil(app.gate.prompt)

    let visitor = makeApp(device: device)
    let retried = await visitor.gate.startGuest()

    XCTAssertFalse(retried)
    XCTAssertEqual(visitor.gate.prompt, .belowMinimumAge(13, logsOut: false))
  }

  func testAClosedAccountIsForgottenOnOKWithoutLoggingOutAndIsRemembered() async {
    let device = makeDefaultsSuite()
    let app = makeApp(saves: [.accountClosed(13)], device: device)
    await app.signIn()

    await app.gate.submit(2020)

    XCTAssertEqual(app.gate.prompt, .accountClosed(13))
    XCTAssertNotNil(app.session.account, "Nothing changes until OK")

    await app.gate.forgetClosedAccount()

    XCTAssertNil(app.session.account)
    XCTAssertTrue(app.accounts.signOuts.isEmpty, "Its server session is gone already")
    XCTAssertNil(app.gate.prompt)

    let visitor = makeApp(device: device)
    let retried = await visitor.gate.startGuest()

    XCTAssertFalse(retried)
    XCTAssertEqual(visitor.gate.prompt, .belowMinimumAge(13, logsOut: false))
  }

  func testAClosedAccountsMessageStaysWhenARequestFindsItsSessionGone() async throws {
    let app = makeApp(saves: [.accountClosed(13)])
    await app.signIn()
    await app.gate.submit(2020)

    await app.session.expire(try XCTUnwrap(app.session.authenticatedSession))
    app.gate.followSession()

    XCTAssertNil(app.session.account)
    XCTAssertEqual(app.gate.prompt, .accountClosed(13))

    await app.gate.forgetClosedAccount()

    XCTAssertNil(app.gate.prompt)
  }

  func testAnAccountOnADeviceThatRefusedWithinTheDayGetsTheMessageAndLogsOut() async {
    let device = makeDefaultsSuite()
    await refuseAVisitor(on: device, clock: TestClock())

    let app = makeApp(device: device)
    await app.signIn()

    XCTAssertEqual(
      app.gate.prompt, .belowMinimumAge(13, logsOut: true), "The message, never the question")

    await app.gate.logOut()

    XCTAssertNil(app.session.account)
    XCTAssertEqual(app.accounts.signOuts, [GuestAccountAPI.accountToken])
    XCTAssertNil(app.gate.prompt)
  }

  private func refuseAVisitor(on device: String, clock: TestClock) async {
    let app = makeApp(checks: [.belowMinimumAge(13)], device: device, clock: clock)
    let write = Task { await app.gate.startGuest() }
    await waitUntil { app.gate.prompt != nil }
    await app.gate.submit(2014)
    _ = await write.value
  }

  private func makeApp(
    checks: [BirthYearAPIStub.Answer] = [],
    saves: [BirthYearAPIStub.Answer] = [],
    signOutError: AccountAPIError? = nil,
    accountNeedsYear: Bool = true,
    device: String? = nil,
    clock: TestClock = TestClock()
  ) -> GateApp {
    let accounts = GuestAccountAPI(signOutError: signOutError)
    let session = SessionStore(
      api: accounts, credentialStore: InMemorySessionCredentialStore(),
      googleAuthentication: GoogleAuthenticationClient(), skipsCredentialReconciliation: true)
    let cache = AppCache(session: session)
    let summary = LearnerSummaryStore(
      api: SummaryAPIStub(needsBirthYear: accountNeedsYear), cache: cache
    ).summary
    let birthYears = BirthYearAPIStub(checks: checks, saves: saves)

    return GateApp(
      accounts: accounts, birthYears: birthYears, session: session, summary: summary,
      gate: BirthYearGate(
        api: birthYears, cache: cache, summary: summary,
        defaultsSuite: device ?? makeDefaultsSuite(), now: { clock.now }))
  }

  private func makeDefaultsSuite() -> String {
    let suite = "BirthYearGateTests.\(UUID().uuidString)"
    addTeardownBlock { UserDefaults().removePersistentDomain(forName: suite) }
    return suite
  }

  private func waitUntil(_ condition: () -> Bool) async {
    while !condition() {
      await Task.yield()
    }
  }

  private func waitUntilHeld(_ birthYears: BirthYearAPIStub) async {
    while !(await birthYears.isHolding) {
      await Task.yield()
    }
  }
}

@MainActor
private final class Finished {
  var writes = 0
}

@MainActor
private struct GateApp {
  let accounts: GuestAccountAPI
  let birthYears: BirthYearAPIStub
  let session: SessionStore
  let summary: Resource<LearnerSummary>
  let gate: BirthYearGate

  /// An account whose summary says it still needs its birth year.
  func signIn() async {
    await session.signInWithEmailCode(email: "learner@zoonk.test", code: "123456")
    await summary.load()
  }
}

@MainActor
private final class TestClock {
  var now = Date(timeIntervalSince1970: 1_793_448_000)
}

private actor BirthYearAPIStub: BirthYearAPIClient {
  enum Answer {
    case accepted
    case accountClosed(Int)
    case belowMinimumAge(Int)
    case failure(APIError)
    case invalidYear
  }

  enum Request {
    case check
    case save
  }

  private var checks: [Answer]
  private var saves: [Answer]
  private var held: Request?
  private var holding: CheckedContinuation<Void, Never>?
  private(set) var checked: [Int] = []
  private(set) var saved: [(year: Int, token: String)] = []

  init(checks: [Answer], saves: [Answer]) {
    self.checks = checks
    self.saves = saves
  }

  var isHolding: Bool {
    holding != nil
  }

  func holdNext(_ request: Request) {
    held = request
  }

  func release() {
    holding?.resume()
    holding = nil
  }

  func check(_ birthYear: Int) async throws -> BirthYearAnswer {
    checked.append(birthYear)
    await hold(.check)
    return try answer(checks.removeFirst())
  }

  func save(_ birthYear: Int, token: String) async throws -> BirthYearAnswer {
    await hold(.save)
    let result = try answer(saves.removeFirst())

    if result == .accepted {
      saved.append((birthYear, token))
    }

    return result
  }

  private func hold(_ request: Request) async {
    guard held == request else {
      return
    }

    held = nil
    await withCheckedContinuation { holding = $0 }
  }

  private func answer(_ answer: Answer) throws -> BirthYearAnswer {
    switch answer {
    case .accepted:
      .accepted
    case .accountClosed(let minimumAge):
      .accountClosed(minimumAge: minimumAge)
    case .belowMinimumAge(let minimumAge):
      .belowMinimumAge(minimumAge)
    case .failure(let error):
      throw error
    case .invalidYear:
      .invalidYear
    }
  }
}

private struct SummaryAPIStub: LearnerSummaryAPIClient {
  let needsBirthYear: Bool

  func getSummary(token: String) async throws -> LearnerSummary {
    LearnerSummary(
      activeGoalID: nil,
      buddy: BuddyLook(),
      buddyName: nil,
      goals: [],
      identity: LearnerIdentity(isAnonymous: true, signedInAt: .now, userID: "learner"),
      level: nil,
      needsBirthYear: needsBirthYear,
      nextChangeAt: .distantFuture,
      places: LearnerPlaces(exam: false, mindMaps: false, readyMistakes: 0, speaking: false),
      readAt: .now,
      tier: .guest,
      timeZone: nil,
      todayBlocksLeft: nil)
  }

  func switchGoal(token: String, goalID: String) async throws {}
}

private final class GuestAccountAPI: AccountAPIClient, @unchecked Sendable {
  static let guestToken = "guest-token"
  static let accountToken = "account-token"

  /// Only the main actor changes them.
  nonisolated(unsafe) private(set) var guestStarts = 0
  nonisolated(unsafe) private(set) var signOuts: [String] = []
  private let signOutError: AccountAPIError?

  init(signOutError: AccountAPIError? = nil) {
    self.signOutError = signOutError
  }

  func signInAsGuest() async throws -> String {
    guestStarts += 1
    return Self.guestToken
  }

  func signInWithEmailCode(email: String, code: String, guestToken: String?) async throws
    -> String
  {
    Self.accountToken
  }

  func getCurrentAccount(token: String) async throws -> CurrentAccount {
    let id = token == Self.guestToken ? "guest" : "learner"

    return CurrentAccount(
      account: AccountAccess(
        deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
      user: AccountUser(
        displayUsername: nil, email: "\(id)@zoonk.test", id: id, image: nil, name: "",
        username: nil))
  }

  func signOut(token: String) async throws {
    signOuts.append(token)

    if let signOutError {
      throw signOutError
    }
  }

  func deleteAccount(
    token: String, appleCredentials: AppleSignInCredentials?,
    emailCredentials: EmailReauthenticationCredentials?
  ) async throws -> AccountDeletionResponse { throw APIError.unavailable }
  func sendEmailCode(email: String, token: String?) async throws {}
  func signInWithApple(_ credentials: AppleSignInCredentials, guestToken: String?) async throws
    -> String
  {
    throw APIError.unavailable
  }
  func signInWithGoogle(idToken: String, guestToken: String?) async throws -> String {
    throw APIError.unavailable
  }
  func synchronizeAppleSubscription(token: String, signedTransaction: String) async throws
    -> AppleSubscriptionSynchronization
  { throw APIError.unavailable }
  func updateProfile(token: String, name: String, username: String) async throws
    -> CurrentAccount
  { throw APIError.unavailable }
  func getUsernameSuggestion(token: String) async throws -> String? { nil }
  func isUsernameAvailable(_ username: String) async throws -> Bool { true }
  func webPlusCancellationURL(token: String) async throws -> URL { throw APIError.unavailable }
}
