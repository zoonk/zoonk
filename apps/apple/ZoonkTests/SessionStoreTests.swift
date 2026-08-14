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
  private func makeAccount() -> CurrentAccount {
    CurrentAccount(
      account: AccountAccess(
        deletion: AccountDeletionRequirements(hasAppleAccount: false),
        subscription: nil),
      user: AccountUser(
        displayUsername: "learner",
        email: "learner@zoonk.test",
        id: "session-store-test-user",
        image: nil,
        name: "Learner",
        username: "learner"))
  }
}

@MainActor
private struct SessionStoreAPIStub: AccountAPIClient {
  var currentAccountResult: Result<CurrentAccount, AccountAPIError> = .failure(.invalidResponse)
  var emailSignInResult: Result<String, AccountAPIError> = .failure(.invalidResponse)
  var signOutResult: Result<Void, AccountAPIError> = .failure(.invalidResponse)

  func getCurrentAccount(token: String) async throws -> CurrentAccount {
    try currentAccountResult.get()
  }

  func signInWithEmailCode(email: String, code: String) async throws -> String {
    try emailSignInResult.get()
  }

  func signOut(token: String) async throws {
    try signOutResult.get()
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
