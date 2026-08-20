import XCTest

@testable import Zoonk

final class SessionStoreTests: XCTestCase {
  @MainActor
  func testRestoreWithoutCredentialSignsOut() async {
    let credentialStore = SessionCredentialStoreSpy()
    let session = makeSession(credentialStore: credentialStore)

    await session.restore()

    XCTAssertEqual(session.state, .signedOut)
    XCTAssertNil(session.failure)
  }

  @MainActor
  func testRestoreWithValidCredentialSignsIn() async {
    let account = makeAccount()
    let credentialStore = SessionCredentialStoreSpy(token: "stored-session")
    let session = makeSession(
      api: SessionStoreAPIStub(currentAccountResult: .success(account)),
      credentialStore: credentialStore)

    await session.restore()

    XCTAssertEqual(session.state, .signedIn(account))
    XCTAssertEqual(credentialStore.token, "stored-session")
    XCTAssertNil(session.failure)
  }

  @MainActor
  func testRestoreWithUnauthorizedCredentialClearsLocalSession() async {
    let credentialStore = SessionCredentialStoreSpy(token: "expired-session")
    let googleAuthentication = GoogleAuthenticationSpy()
    let session = makeSession(
      api: SessionStoreAPIStub(currentAccountResult: .failure(.unauthorized)),
      credentialStore: credentialStore,
      googleAuthentication: googleAuthentication)

    await session.restore()

    XCTAssertEqual(session.state, .signedOut)
    XCTAssertNil(credentialStore.token)
    XCTAssertEqual(credentialStore.deleteCallCount, 1)
    XCTAssertEqual(googleAuthentication.signOutCallCount, 1)
    XCTAssertNil(session.failure)
  }

  @MainActor
  func testRestoreWithTemporaryFailurePreservesCredential() async {
    let credentialStore = SessionCredentialStoreSpy(token: "stored-session")
    let session = makeSession(
      api: SessionStoreAPIStub(currentAccountResult: .failure(.network)),
      credentialStore: credentialStore)

    await session.restore()

    XCTAssertEqual(session.state, .unavailable)
    XCTAssertEqual(session.failure, .network)
    XCTAssertEqual(credentialStore.token, "stored-session")
    XCTAssertEqual(credentialStore.deleteCallCount, 0)
  }

  @MainActor
  func testCancelledRestoreCanRestartWithoutPublishingFailure() async {
    let account = makeAccount()
    let api = SessionStoreAPIStub()
    api.currentAccountError = CancellationError()
    let credentialStore = SessionCredentialStoreSpy(token: "stored-session")
    let session = makeSession(api: api, credentialStore: credentialStore)

    await session.restore()

    XCTAssertEqual(session.state, .restoring)
    XCTAssertNil(session.failure)
    XCTAssertEqual(credentialStore.token, "stored-session")

    api.currentAccountError = nil
    api.currentAccountResult = .success(account)
    await session.restore()

    XCTAssertEqual(session.state, .signedIn(account))
    XCTAssertNil(session.failure)
  }

  @MainActor
  func testSignOutDoesNotReportSignedOutWhenCredentialDeletionFails() async {
    let account = makeAccount()
    let credentialStore = SessionCredentialStoreSpy(token: "stored-session")
    let session = makeSession(
      api: SessionStoreAPIStub(
        currentAccountResult: .success(account),
        signOutResult: .success(())),
      credentialStore: credentialStore)

    await session.restore()
    credentialStore.deleteError = SessionCredentialStoreSpyError.deletionFailed
    await session.signOut()

    XCTAssertEqual(session.state, .unavailable)
    XCTAssertEqual(session.failure, .network)
    XCTAssertEqual(credentialStore.token, "stored-session")
    XCTAssertEqual(credentialStore.deleteCallCount, 1)
  }

  @MainActor
  func testEmailSignInValidatesAndStoresSession() async {
    let account = makeAccount()
    let credentialStore = SessionCredentialStoreSpy()
    let session = makeSession(
      api: SessionStoreAPIStub(
        currentAccountResult: .success(account),
        emailSignInResult: .success("new-session")),
      credentialStore: credentialStore)

    await session.signInWithEmailCode(email: "learner@zoonk.test", code: "123456")

    XCTAssertEqual(session.state, .signedIn(account))
    XCTAssertEqual(credentialStore.token, "new-session")
    XCTAssertEqual(credentialStore.savedTokens, ["new-session"])
    XCTAssertNil(session.failure)
  }

  @MainActor
  func testEmailSignInSurfacesRateLimitRecovery() async {
    let session = makeSession(
      api: SessionStoreAPIStub(emailSignInResult: .failure(.rateLimited)),
      credentialStore: SessionCredentialStoreSpy())

    await session.signInWithEmailCode(email: "learner@zoonk.test", code: "123456")

    XCTAssertEqual(session.state, .restoring)
    XCTAssertEqual(session.failure, .rateLimited)
  }

  @MainActor
  func testAppleSubscriptionSynchronizationUpdatesTheCurrentAccount() async {
    let subscribedAccount = makeAccount(
      subscription: AccountSubscription(plan: "plus", provider: "apple", status: "active"))
    let api = SessionStoreAPIStub(
      appleSubscriptionResult: .success(
        AppleSubscriptionSynchronization(account: subscribedAccount, isActive: true)),
      currentAccountResult: .success(makeAccount()))
    let session = makeSession(
      api: api,
      credentialStore: SessionCredentialStoreSpy(token: "stored-session"))
    await session.restore()

    let result = await session.synchronizeAppleSubscription(
      signedTransaction: "signed-transaction",
      expectedAccountID: "session-store-test-user")

    XCTAssertEqual(result, .synchronizedActive)
    XCTAssertEqual(api.appleSignedTransactions, ["signed-transaction"])
    XCTAssertEqual(session.state, .signedIn(subscribedAccount))
  }

  @MainActor
  func testSuccessfulAppleSubscriptionSynchronizationClearsAnEarlierFailure() async {
    let subscribedAccount = makeAccount(
      subscription: AccountSubscription(plan: "plus", provider: "apple", status: "active"))
    let api = SessionStoreAPIStub(
      appleSubscriptionResult: .success(
        AppleSubscriptionSynchronization(account: subscribedAccount, isActive: true)),
      currentAccountResult: .success(makeAccount()))
    let session = makeSession(
      api: api,
      credentialStore: SessionCredentialStoreSpy(token: "stored-session"))
    await session.restore()
    session.reportSignInFailure()

    let result = await session.synchronizeAppleSubscription(
      signedTransaction: "signed-transaction",
      expectedAccountID: "session-store-test-user")

    XCTAssertEqual(result, .synchronizedActive)
    XCTAssertNil(session.failure)
  }

  @MainActor
  func testInactiveAppleSubscriptionSynchronizationIsDurablyRecordedWithoutGrantingAccess() async {
    let freeAccount = makeAccount()
    let api = SessionStoreAPIStub(
      appleSubscriptionResult: .success(
        AppleSubscriptionSynchronization(account: freeAccount, isActive: false)),
      currentAccountResult: .success(freeAccount))
    let session = makeSession(
      api: api,
      credentialStore: SessionCredentialStoreSpy(token: "stored-session"))
    await session.restore()

    let result = await session.synchronizeAppleSubscription(
      signedTransaction: "expired-signed-transaction",
      expectedAccountID: "session-store-test-user")

    XCTAssertEqual(result, .synchronizedInactive)
    XCTAssertEqual(api.appleSignedTransactions, ["expired-signed-transaction"])
    XCTAssertEqual(session.state, .signedIn(freeAccount))
  }

  @MainActor
  func testAppleSynchronizationDoesNotTreatAnotherProviderAsAnActiveAppStorePurchase() async {
    let googleAccount = makeAccount(
      subscription: AccountSubscription(plan: "plus", provider: "google", status: "active"))
    let api = SessionStoreAPIStub(
      appleSubscriptionResult: .success(
        AppleSubscriptionSynchronization(account: googleAccount, isActive: false)),
      currentAccountResult: .success(googleAccount))
    let session = makeSession(
      api: api,
      credentialStore: SessionCredentialStoreSpy(token: "stored-session"))
    await session.restore()

    let result = await session.synchronizeAppleSubscription(
      signedTransaction: "expired-signed-transaction",
      expectedAccountID: "session-store-test-user")

    XCTAssertEqual(result, .synchronizedInactive)
    XCTAssertEqual(session.state, .signedIn(googleAccount))
  }

  @MainActor
  func testUnauthorizedAppleSubscriptionSynchronizationClearsTheSession() async {
    let credentialStore = SessionCredentialStoreSpy(token: "stored-session")
    let api = SessionStoreAPIStub(
      appleSubscriptionResult: .failure(.unauthorized),
      currentAccountResult: .success(makeAccount()))
    let session = makeSession(api: api, credentialStore: credentialStore)
    await session.restore()

    let result = await session.synchronizeAppleSubscription(
      signedTransaction: "signed-transaction",
      expectedAccountID: "session-store-test-user")

    XCTAssertEqual(result, .authenticationRequired)
    XCTAssertEqual(session.state, .signedOut)
    XCTAssertNil(credentialStore.token)
  }

  @MainActor
  func testFailedAppleSubscriptionSynchronizationKeepsTheSignedInAccount() async {
    let account = makeAccount()
    let api = SessionStoreAPIStub(
      appleSubscriptionResult: .failure(.network),
      currentAccountResult: .success(account))
    let session = makeSession(
      api: api,
      credentialStore: SessionCredentialStoreSpy(token: "stored-session"))
    await session.restore()

    let result = await session.synchronizeAppleSubscription(
      signedTransaction: "signed-transaction",
      expectedAccountID: "session-store-test-user")

    XCTAssertEqual(result, .failed)
    XCTAssertEqual(session.state, .signedIn(account))
  }

  @MainActor
  func testAppleSubscriptionAccountMismatchKeepsTheSignedInAccount() async {
    let account = makeAccount()
    let api = SessionStoreAPIStub(
      appleSubscriptionResult: .failure(.accountMismatch),
      currentAccountResult: .success(account))
    let session = makeSession(
      api: api,
      credentialStore: SessionCredentialStoreSpy(token: "stored-session"))
    await session.restore()

    let result = await session.synchronizeAppleSubscription(
      signedTransaction: "signed-transaction",
      expectedAccountID: "session-store-test-user")

    XCTAssertEqual(result, .accountMismatch)
    XCTAssertEqual(session.state, .signedIn(account))
  }

  @MainActor
  func testAppleSubscriptionSynchronizationDoesNotUseAnotherAccountsSession() async {
    let account = makeAccount(userID: "account-b")
    let api = SessionStoreAPIStub(currentAccountResult: .success(account))
    let session = makeSession(
      api: api,
      credentialStore: SessionCredentialStoreSpy(token: "account-b-session"))
    await session.restore()

    let result = await session.synchronizeAppleSubscription(
      signedTransaction: "account-a-signed-transaction",
      expectedAccountID: "account-a")

    XCTAssertEqual(result, .accountMismatch)
    XCTAssertEqual(api.appleSignedTransactions, [])
    XCTAssertEqual(session.state, .signedIn(account))
  }

  @MainActor
  func testInvalidAppleSubscriptionPurchaseKeepsTheSignedInAccount() async {
    let account = makeAccount()
    let api = SessionStoreAPIStub(
      appleSubscriptionResult: .failure(.invalidAppStorePurchase),
      currentAccountResult: .success(account))
    let session = makeSession(
      api: api,
      credentialStore: SessionCredentialStoreSpy(token: "stored-session"))
    await session.restore()

    let result = await session.synchronizeAppleSubscription(
      signedTransaction: "signed-transaction",
      expectedAccountID: "session-store-test-user")

    XCTAssertEqual(result, .invalidPurchase)
    XCTAssertEqual(session.state, .signedIn(account))
  }

  @MainActor
  func testAppleSubscriptionSynchronizationWinsAgainstAnEarlierCredentialRefresh() async {
    let freeAccount = makeAccount()
    let subscribedAccount = makeAccount(
      subscription: AccountSubscription(plan: "plus", provider: "apple", status: "active"))
    let api = SessionStoreAPIStub(
      appleSubscriptionResult: .success(
        AppleSubscriptionSynchronization(account: subscribedAccount, isActive: true)),
      currentAccountResult: .success(freeAccount))
    let session = makeSession(
      api: api,
      credentialStore: SessionCredentialStoreSpy(token: "stored-session"))
    await session.restore()

    let credentialRefresh = CurrentAccountRequestGate()
    api.currentAccountHandler = { _ in
      await credentialRefresh.load()
    }
    let refreshTask = Task {
      await session.reconcileSynchronizedCredential()
    }
    await credentialRefresh.waitUntilStarted()

    let result = await session.synchronizeAppleSubscription(
      signedTransaction: "signed-transaction",
      expectedAccountID: "session-store-test-user")
    credentialRefresh.resume(returning: freeAccount)
    await refreshTask.value

    XCTAssertEqual(result, .synchronizedActive)
    XCTAssertEqual(session.state, .signedIn(subscribedAccount))
  }

  @MainActor
  func testAppleSubscriptionSynchronizationWinsAgainstALaterCredentialRefresh() async {
    let freeAccount = makeAccount()
    let subscribedAccount = makeAccount(
      subscription: AccountSubscription(plan: "plus", provider: "apple", status: "active"))
    let appleSynchronization = AppleSubscriptionRequestGate()
    let api = SessionStoreAPIStub(currentAccountResult: .success(freeAccount))
    api.appleSubscriptionHandler = { _, _ in
      await appleSynchronization.load()
    }
    let session = makeSession(
      api: api,
      credentialStore: SessionCredentialStoreSpy(token: "stored-session"))
    await session.restore()

    let synchronizationTask = Task {
      await session.synchronizeAppleSubscription(
        signedTransaction: "signed-transaction",
        expectedAccountID: "session-store-test-user")
    }
    await appleSynchronization.waitUntilStarted()

    let credentialRefresh = CurrentAccountRequestGate()
    api.currentAccountHandler = { _ in
      await credentialRefresh.load()
    }
    let refreshTask = Task {
      await session.reconcileSynchronizedCredential()
    }
    await credentialRefresh.waitUntilStarted()

    appleSynchronization.resume(
      returning: AppleSubscriptionSynchronization(
        account: subscribedAccount,
        isActive: true))
    let result = await synchronizationTask.value
    credentialRefresh.resume(returning: freeAccount)
    await refreshTask.value

    XCTAssertEqual(result, .synchronizedActive)
    XCTAssertEqual(session.state, .signedIn(subscribedAccount))
  }

  @MainActor
  func testProfileUpdateWinsAgainstAnEarlierAppleSubscriptionSynchronization() async {
    let freeAccount = makeAccount()
    let subscribedAccount = makeAccount(
      subscription: AccountSubscription(plan: "plus", provider: "apple", status: "active"))
    let updatedAccount = makeAccount(name: "Updated learner")
    let appleSynchronization = AppleSubscriptionRequestGate()
    let api = SessionStoreAPIStub(
      currentAccountResult: .success(freeAccount),
      updateProfileResult: .success(updatedAccount))
    api.appleSubscriptionHandler = { _, _ in
      await appleSynchronization.load()
    }
    let session = makeSession(
      api: api,
      credentialStore: SessionCredentialStoreSpy(token: "stored-session"))
    await session.restore()

    let synchronizationTask = Task {
      await session.synchronizeAppleSubscription(
        signedTransaction: "signed-transaction",
        expectedAccountID: "session-store-test-user")
    }
    await appleSynchronization.waitUntilStarted()

    let didUpdateProfile = await session.updateProfile(
      name: "Updated learner",
      username: "learner")
    appleSynchronization.resume(
      returning: AppleSubscriptionSynchronization(
        account: subscribedAccount,
        isActive: true))
    let result = await synchronizationTask.value

    XCTAssertTrue(didUpdateProfile)
    XCTAssertEqual(result, .synchronizedActive)
    XCTAssertEqual(session.state, .signedIn(updatedAccount))
  }

  @MainActor
  func testNewKeychainAccountWinsAgainstAppleSynchronizationForThePreviousAccount() async {
    let accountA = makeAccount(userID: "account-a")
    let accountASubscription = makeAccount(
      subscription: AccountSubscription(plan: "plus", provider: "apple", status: "active"),
      userID: "account-a")
    let accountB = makeAccount(userID: "account-b")
    let credentialStore = SessionCredentialStoreSpy(token: "account-a-session")
    let api = SessionStoreAPIStub(
      appleSubscriptionResult: .success(
        AppleSubscriptionSynchronization(account: accountASubscription, isActive: true)),
      currentAccountResult: .success(accountA))
    let session = makeSession(api: api, credentialStore: credentialStore)
    await session.restore()

    let credentialRefresh = CurrentAccountRequestGate()
    credentialStore.token = "account-b-session"
    api.currentAccountHandler = { token in
      XCTAssertEqual(token, "account-b-session")
      return await credentialRefresh.load()
    }
    let refreshTask = Task {
      await session.reconcileSynchronizedCredential()
    }
    await credentialRefresh.waitUntilStarted()

    let result = await session.synchronizeAppleSubscription(
      signedTransaction: "account-a-signed-transaction",
      expectedAccountID: "account-a")
    credentialRefresh.resume(returning: accountB)
    await refreshTask.value

    XCTAssertEqual(result, .synchronizedActive)
    XCTAssertEqual(session.state, .signedIn(accountB))
  }

  @MainActor
  private func makeSession(
    api: any AccountAPIClient = SessionStoreAPIStub(),
    credentialStore: SessionCredentialStoreSpy,
    googleAuthentication: GoogleAuthenticationSpy = GoogleAuthenticationSpy()
  ) -> SessionStore {
    SessionStore(
      api: api,
      credentialStore: credentialStore,
      googleAuthentication: googleAuthentication)
  }

  @MainActor
  private func makeAccount(
    name: String = "Learner",
    subscription: AccountSubscription? = nil,
    userID: String = "session-store-test-user"
  ) -> CurrentAccount {
    CurrentAccount(
      account: AccountAccess(
        deletion: AccountDeletionRequirements(hasAppleAccount: false),
        subscription: subscription),
      user: AccountUser(
        displayUsername: "learner",
        email: "learner@zoonk.test",
        id: userID,
        image: nil,
        name: name,
        username: "learner"))
  }
}

private final class SessionStoreAPIStub: AccountAPIClient, @unchecked Sendable {
  private(set) var appleSignedTransactions = [String]()
  var appleSubscriptionResult: Result<AppleSubscriptionSynchronization, AccountAPIError> = .failure(
    .invalidResponse)
  var appleSubscriptionHandler:
    (@MainActor (String, String) async throws -> AppleSubscriptionSynchronization)?
  var currentAccountResult: Result<CurrentAccount, AccountAPIError> = .failure(.invalidResponse)
  var currentAccountError: Error?
  var currentAccountHandler: (@MainActor (String) async throws -> CurrentAccount)?
  var emailSignInResult: Result<String, AccountAPIError> = .failure(.invalidResponse)
  var signOutResult: Result<Void, AccountAPIError> = .failure(.invalidResponse)
  var updateProfileResult: Result<CurrentAccount, AccountAPIError> = .failure(.invalidResponse)

  init(
    appleSubscriptionResult: Result<AppleSubscriptionSynchronization, AccountAPIError> = .failure(
      .invalidResponse),
    currentAccountResult: Result<CurrentAccount, AccountAPIError> = .failure(.invalidResponse),
    emailSignInResult: Result<String, AccountAPIError> = .failure(.invalidResponse),
    signOutResult: Result<Void, AccountAPIError> = .failure(.invalidResponse),
    updateProfileResult: Result<CurrentAccount, AccountAPIError> = .failure(.invalidResponse)
  ) {
    self.appleSubscriptionResult = appleSubscriptionResult
    self.currentAccountResult = currentAccountResult
    self.emailSignInResult = emailSignInResult
    self.signOutResult = signOutResult
    self.updateProfileResult = updateProfileResult
  }

  func synchronizeAppleSubscription(
    token: String,
    signedTransaction: String
  ) async throws -> AppleSubscriptionSynchronization {
    appleSignedTransactions.append(signedTransaction)

    if let appleSubscriptionHandler {
      return try await appleSubscriptionHandler(token, signedTransaction)
    }

    return try appleSubscriptionResult.get()
  }

  func getCurrentAccount(token: String) async throws -> CurrentAccount {
    if let currentAccountHandler {
      return try await currentAccountHandler(token)
    }

    if let currentAccountError {
      throw currentAccountError
    }

    return try currentAccountResult.get()
  }

  func signInWithEmailCode(email: String, code: String) async throws -> String {
    try emailSignInResult.get()
  }

  func signOut(token: String) async throws {
    try signOutResult.get()
  }

  func updateProfile(token: String, name: String, username: String) async throws -> CurrentAccount {
    try updateProfileResult.get()
  }
}

@MainActor
private final class CurrentAccountRequestGate {
  private var requestContinuation: CheckedContinuation<CurrentAccount, Never>?
  private var startedContinuation: CheckedContinuation<Void, Never>?

  func load() async -> CurrentAccount {
    await withCheckedContinuation { continuation in
      requestContinuation = continuation
      startedContinuation?.resume()
      startedContinuation = nil
    }
  }

  func waitUntilStarted() async {
    guard requestContinuation == nil else {
      return
    }

    await withCheckedContinuation { continuation in
      startedContinuation = continuation
    }
  }

  func resume(returning account: CurrentAccount) {
    requestContinuation?.resume(returning: account)
    requestContinuation = nil
  }
}

@MainActor
private final class AppleSubscriptionRequestGate {
  private var requestContinuation: CheckedContinuation<AppleSubscriptionSynchronization, Never>?
  private var startedContinuation: CheckedContinuation<Void, Never>?

  func load() async -> AppleSubscriptionSynchronization {
    await withCheckedContinuation { continuation in
      requestContinuation = continuation
      startedContinuation?.resume()
      startedContinuation = nil
    }
  }

  func waitUntilStarted() async {
    guard requestContinuation == nil else {
      return
    }

    await withCheckedContinuation { continuation in
      startedContinuation = continuation
    }
  }

  func resume(returning synchronization: AppleSubscriptionSynchronization) {
    requestContinuation?.resume(returning: synchronization)
    requestContinuation = nil
  }
}

@MainActor
extension AccountAPIClient {
  func deleteAccount(
    token: String,
    appleCredentials: AppleSignInCredentials?,
    emailCredentials: EmailReauthenticationCredentials?
  ) async throws -> AccountDeletionResponse {
    throw AccountAPIError.invalidResponse
  }

  func sendEmailCode(email: String) async throws {
    throw AccountAPIError.invalidResponse
  }

  func signInWithApple(_ credentials: AppleSignInCredentials) async throws -> String {
    throw AccountAPIError.invalidResponse
  }

  func signInWithGoogle(idToken: String) async throws -> String {
    throw AccountAPIError.invalidResponse
  }

  func updateProfile(token: String, name: String, username: String) async throws -> CurrentAccount {
    throw AccountAPIError.invalidResponse
  }
}

@MainActor
private final class GoogleAuthenticationSpy: GoogleAuthenticating {
  private(set) var signOutCallCount = 0
  let isAvailable = false

  func handle(_ url: URL) {}

  func signIn(from anchor: GoogleAuthenticationAnchor) async throws -> String {
    throw GoogleAuthenticationError.unavailable
  }

  func signOut() {
    signOutCallCount += 1
  }
}

private enum SessionCredentialStoreSpyError: Error {
  case deletionFailed
}

@MainActor
private final class SessionCredentialStoreSpy: SessionCredentialStoring {
  private(set) var deleteCallCount = 0
  private(set) var savedTokens = [String]()
  var deleteError: Error?
  var token: String?

  init(token: String? = nil) {
    self.token = token
  }

  func delete() throws {
    deleteCallCount += 1

    if let deleteError {
      throw deleteError
    }

    token = nil
  }

  func read() throws -> String? {
    token
  }

  func save(_ token: String) throws {
    savedTokens.append(token)
    self.token = token
  }
}
