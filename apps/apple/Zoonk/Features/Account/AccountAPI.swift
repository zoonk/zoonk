import Foundation
import OpenAPIRuntime

enum AccountAPIError: Error, Equatable {
  case accountDisabled
  case accountMismatch
  case appleCredentialMismatch
  case invalidCode
  case invalidEmail
  case invalidAppStorePurchase
  case invalidResponse
  case network
  case rateLimited
  case reauthenticationRequired
  case unauthorized
  case usernameTaken
  case validation
}

protocol AccountAPIClient {
  func deleteAccount(
    token: String,
    appleCredentials: AppleSignInCredentials?,
    emailCredentials: EmailReauthenticationCredentials?
  ) async throws -> AccountDeletionResponse
  func getCurrentAccount(token: String) async throws -> CurrentAccount
  func sendEmailCode(email: String) async throws
  func signInWithApple(_ credentials: AppleSignInCredentials) async throws -> String
  func signInWithEmailCode(email: String, code: String) async throws -> String
  func signInWithGoogle(idToken: String) async throws -> String
  func signOut(token: String) async throws
  func synchronizeAppleSubscription(
    token: String,
    signedTransaction: String
  ) async throws -> AppleSubscriptionSynchronization
  func updateProfile(token: String, name: String, username: String) async throws -> CurrentAccount
}

extension AccountAPIClient {
  func deleteAccount(token: String) async throws -> AccountDeletionResponse {
    try await deleteAccount(token: token, appleCredentials: nil, emailCredentials: nil)
  }

  func deleteAccount(
    token: String,
    appleCredentials: AppleSignInCredentials
  ) async throws -> AccountDeletionResponse {
    try await deleteAccount(
      token: token,
      appleCredentials: appleCredentials,
      emailCredentials: nil)
  }

  func deleteAccount(
    token: String,
    emailCredentials: EmailReauthenticationCredentials
  ) async throws -> AccountDeletionResponse {
    try await deleteAccount(
      token: token,
      appleCredentials: nil,
      emailCredentials: emailCredentials)
  }
}

struct AccountAPI {
  private let clients: APIClientFactory

  init(clients: APIClientFactory) {
    self.clients = clients
  }

  func getCurrentAccount(token: String) async throws -> CurrentAccount {
    let output = try await perform(token: token) { client in
      try await client.getCurrentUser(.init())
    }

    switch output {
    case .ok(let response):
      return makeCurrentAccount(try response.body.json)
    case .unauthorized:
      throw AccountAPIError.unauthorized
    case .internalServerError, .undocumented:
      throw AccountAPIError.invalidResponse
    }
  }

  /// Asks the existing mailer to send the same localized six-digit sign-in code used by the web application.
  func sendEmailCode(email: String) async throws {
    let output = try await perform { client in
      try await client.createEmailSignInCode(
        .init(body: .json(.init(email: email))))
    }

    switch output {
    case .noContent:
      return
    case .badRequest:
      throw AccountAPIError.invalidEmail
    case .forbidden(let response):
      throw getAPIError(statusCode: 403, payload: try response.body.json)
    case .tooManyRequests:
      throw AccountAPIError.rateLimited
    case .internalServerError, .undocumented:
      throw AccountAPIError.invalidResponse
    }
  }

  func signInWithEmailCode(email: String, code: String) async throws -> String {
    let output = try await perform { client in
      try await client.createEmailCodeSession(
        .init(body: .json(.init(code: code, email: email))))
    }

    switch output {
    case .ok(let response):
      return try response.body.json.token
    case .badRequest(let response):
      throw getAPIError(statusCode: 400, payload: try response.body.json)
    case .forbidden(let response):
      throw getAPIError(statusCode: 403, payload: try response.body.json)
    case .tooManyRequests:
      throw AccountAPIError.rateLimited
    case .internalServerError, .undocumented:
      throw AccountAPIError.invalidResponse
    }
  }

  /// Sends Apple's single-use code and signed identity assertion so the server owns token exchange, verification, and account linking.
  func signInWithApple(_ credentials: AppleSignInCredentials) async throws -> String {
    let output = try await perform { client in
      try await client.createAppleSession(
        .init(body: .json(makeAppleRequestBody(credentials))))
    }

    switch output {
    case .ok(let response):
      return try response.body.json.token
    case .badRequest(let response):
      throw getAPIError(statusCode: 400, payload: try response.body.json)
    case .unauthorized:
      throw AccountAPIError.unauthorized
    case .forbidden(let response):
      throw getAPIError(statusCode: 403, payload: try response.body.json)
    case .tooManyRequests:
      throw AccountAPIError.rateLimited
    case .internalServerError, .undocumented:
      throw AccountAPIError.invalidResponse
    }
  }

  func signInWithGoogle(idToken: String) async throws -> String {
    let output = try await perform { client in
      try await client.createGoogleSession(
        .init(body: .json(.init(idToken: idToken))))
    }

    switch output {
    case .ok(let response):
      return try response.body.json.token
    case .badRequest(let response):
      throw getAPIError(statusCode: 400, payload: try response.body.json)
    case .unauthorized:
      throw AccountAPIError.unauthorized
    case .forbidden(let response):
      throw getAPIError(statusCode: 403, payload: try response.body.json)
    case .tooManyRequests:
      throw AccountAPIError.rateLimited
    case .internalServerError, .undocumented:
      throw AccountAPIError.invalidResponse
    }
  }

  func updateProfile(token: String, name: String, username: String) async throws -> CurrentAccount {
    let output = try await perform(token: token) { client in
      try await client.updateCurrentUser(
        .init(body: .json(.init(name: name, username: username))))
    }

    switch output {
    case .ok(let response):
      return makeCurrentAccount(try response.body.json)
    case .badRequest(let response):
      throw getAPIError(statusCode: 400, payload: try response.body.json)
    case .unauthorized:
      throw AccountAPIError.unauthorized
    case .forbidden(let response):
      throw getAPIError(statusCode: 403, payload: try response.body.json)
    case .conflict(let response):
      throw getAPIError(statusCode: 409, payload: try response.body.json)
    case .internalServerError, .undocumented:
      throw AccountAPIError.invalidResponse
    }
  }

  func synchronizeAppleSubscription(
    token: String,
    signedTransaction: String
  ) async throws -> AppleSubscriptionSynchronization {
    let output = try await perform(token: token) { client in
      try await client.createAppleSubscription(
        .init(body: .json(.init(signedTransaction: signedTransaction))))
    }

    switch output {
    case .ok(let response):
      let synchronization = try response.body.json
      return AppleSubscriptionSynchronization(
        account: makeCurrentAccount(synchronization.currentAccount),
        isActive: synchronization.isActive)
    case .badRequest(let response):
      throw getAppleSubscriptionError(try response.body.json)
    case .unauthorized:
      throw AccountAPIError.unauthorized
    case .conflict:
      throw AccountAPIError.accountMismatch
    case .internalServerError, .undocumented:
      throw AccountAPIError.invalidResponse
    }
  }

  /// Revokes the shared server-side bearer session before the native client clears its local authenticated state.
  func signOut(token: String) async throws {
    let output = try await perform(token: token) { client in
      try await client.deleteCurrentSession(.init())
    }

    switch output {
    case .noContent:
      return
    case .forbidden, .internalServerError, .undocumented:
      throw AccountAPIError.invalidResponse
    }
  }

  /// Sends one atomic deletion request so the server owns any required Apple reauthorization, provider revocation, and permanent data cleanup.
  func deleteAccount(
    token: String,
    appleCredentials: AppleSignInCredentials? = nil,
    emailCredentials: EmailReauthenticationCredentials? = nil
  ) async throws -> AccountDeletionResponse {
    let body = try makeAccountDeletionBody(
      appleCredentials: appleCredentials,
      emailCredentials: emailCredentials)
    let output = try await perform(token: token) { client in
      try await client.deleteCurrentUser(.init(body: .json(body)))
    }

    switch output {
    case .ok(let response):
      return AccountDeletionResponse(
        appleAuthorizationRevoked: try response.body.json.appleAuthorizationRevoked)
    case .badRequest(let response):
      throw getAPIError(statusCode: 400, payload: try response.body.json)
    case .unauthorized:
      throw AccountAPIError.unauthorized
    case .forbidden(let response):
      throw getAPIError(
        statusCode: 403,
        payload: try response.body.json,
        forbiddenError: .reauthenticationRequired)
    case .internalServerError, .undocumented:
      throw AccountAPIError.invalidResponse
    }
  }

  /// Keeps generated transport and decoding details behind the account feature's stable recovery states.
  private func perform<Output: Sendable>(
    token: String? = nil,
    operation: @Sendable (Client) async throws -> Output
  ) async throws -> Output {
    do {
      return try await operation(clients.makeClient(token: token))
    } catch {
      if isRequestCancellation(error) {
        throw CancellationError()
      }

      if let error = error as? ClientError {
        if error.underlyingError is URLError {
          throw AccountAPIError.network
        }

        throw AccountAPIError.invalidResponse
      }

      if error is URLError {
        throw AccountAPIError.network
      }

      throw AccountAPIError.invalidResponse
    }
  }

  private func isRequestCancellation(_ error: Error) -> Bool {
    if error is CancellationError {
      return true
    }

    if let urlError = error as? URLError {
      return urlError.code == .cancelled
    }

    if let clientError = error as? ClientError {
      return isRequestCancellation(clientError.underlyingError)
    }

    return false
  }

  private func getAPIError(
    statusCode: Int,
    payload: Components.Schemas._Error,
    forbiddenError: AccountAPIError? = nil
  ) -> AccountAPIError {
    let code = payload.error.code

    if code == "ACCOUNT_DISABLED" {
      return .accountDisabled
    }

    if code == "ACCOUNT_DELETION_APPLE_MISMATCH" {
      return .appleCredentialMismatch
    }

    if code == "ACCOUNT_DELETION_EMAIL_MISMATCH" {
      return .accountMismatch
    }

    if [
      "ACCOUNT_DELETION_INVALID_OTP",
      "ACCOUNT_DELETION_OTP_EXPIRED",
      "ACCOUNT_DELETION_OTP_LOCKED",
      "EMAIL_SIGN_IN_CODE_EXPIRED",
      "EMAIL_SIGN_IN_CODE_INVALID",
      "EMAIL_SIGN_IN_CODE_LOCKED",
    ].contains(code) {
      return .invalidCode
    }

    if statusCode == 401 {
      return .unauthorized
    }

    if statusCode == 403, let forbiddenError {
      return forbiddenError
    }

    if code == "INVALID_EMAIL" {
      return .invalidEmail
    }

    if statusCode == 409 || code == "USERNAME_IS_ALREADY_TAKEN" {
      return .usernameTaken
    }

    if statusCode == 400 || statusCode == 422 {
      return .validation
    }

    return .invalidResponse
  }

  private func getAppleSubscriptionError(
    _ payload: Components.Schemas._Error
  ) -> AccountAPIError {
    if ["APPLE_PRODUCT_UNSUPPORTED", "APPLE_TRANSACTION_INVALID"].contains(payload.error.code) {
      return .invalidAppStorePurchase
    }

    return getAPIError(statusCode: 400, payload: payload)
  }

  private func makeAppleRequestBody(_ credentials: AppleSignInCredentials)
    -> Components.Schemas.AppleSessionRequest
  {
    let user = credentials.email.map {
      Components.Schemas.AppleSessionRequest.UserPayload(
        email: $0,
        name: .init(
          firstName: credentials.firstName,
          lastName: credentials.lastName))
    }

    return Components.Schemas.AppleSessionRequest(
      authorizationCode: credentials.authorizationCode,
      idToken: credentials.identityToken,
      nonce: credentials.nonce,
      user: user)
  }

  /// Converts the public mutually exclusive deletion contract into its generated Swift case.
  private func makeAccountDeletionBody(
    appleCredentials: AppleSignInCredentials?,
    emailCredentials: EmailReauthenticationCredentials?
  ) throws -> Components.Schemas.MeDeletion {
    switch (appleCredentials, emailCredentials) {
    case (.none, .none):
      return .case1(.init())
    case (.some(let credentials), .none):
      return .case2(.init(appleCredentials: makeAppleRequestBody(credentials)))
    case (.none, .some(let credentials)):
      return .case3(
        .init(
          emailCredentials: .init(
            email: credentials.email,
            otp: credentials.otp)))
    case (.some, .some):
      throw AccountAPIError.validation
    }
  }

  private func makeCurrentAccount(_ response: Components.Schemas.MeResponse) -> CurrentAccount {
    let subscription = response.account.subscription?.value1

    return CurrentAccount(
      account: AccountAccess(
        deletion: AccountDeletionRequirements(
          hasAppleAccount: response.account.deletion.hasAppleAccount),
        subscription: subscription.map {
          AccountSubscription(
            plan: $0.plan,
            provider: $0.provider,
            status: $0.status)
        }),
      user: AccountUser(
        displayUsername: response.user.displayUsername,
        email: response.user.email,
        id: response.user.id,
        image: response.user.image,
        name: response.user.name,
        username: response.user.username))
  }
}

extension AccountAPI: AccountAPIClient {}
