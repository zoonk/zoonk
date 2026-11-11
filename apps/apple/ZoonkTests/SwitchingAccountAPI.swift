import Foundation

@testable import Zoonk

/// Signs a session in as one learner after another, each with their own token.
final class SwitchingAccountAPI: AccountAPIClient, @unchecked Sendable {
  /// Only the main actor changes it, between requests.
  nonisolated(unsafe) private var userID = "learner-a"

  @MainActor
  func signedIn(as userID: String) async -> SessionStore {
    let session = SessionStore(
      api: self, credentialStore: InMemorySessionCredentialStore(token: nil),
      googleAuthentication: GoogleAuthenticationClient(), skipsCredentialReconciliation: true)
    await signIn(session, as: userID)
    return session
  }

  @MainActor
  func signIn(_ session: SessionStore, as userID: String) async {
    self.userID = userID
    await session.signInWithEmailCode(email: "\(userID)@zoonk.test", code: "123456")
  }

  func getCurrentAccount(token: String) async throws -> CurrentAccount {
    CurrentAccount(
      account: AccountAccess(
        deletion: AccountDeletionRequirements(hasAppleAccount: false), subscription: nil),
      user: AccountUser(
        email: "\(userID)@zoonk.test", id: userID, image: nil,
        name: userID, username: userID))
  }

  func signInWithEmailCode(email: String, code: String, guestToken: String?) async throws
    -> String
  {
    "token-\(userID)"
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
  func signInAsGuest() async throws -> String { throw APIError.unavailable }
  func signInWithGoogle(idToken: String, guestToken: String?) async throws -> String {
    throw APIError.unavailable
  }
  func signOut(token: String) async throws {}
  func synchronizeAppleSubscription(token: String, signedTransaction: String) async throws
    -> AppleSubscriptionSynchronization
  { throw APIError.unavailable }
  func updateProfile(token: String, name: String?, username: String?) async throws
    -> CurrentAccount
  { throw APIError.unavailable }
}
