import Foundation

enum AccountAPIError: Error, Equatable {
  case accountMismatch
  case appleCredentialMismatch
  case invalidCode
  case invalidEmail
  case invalidResponse
  case network
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
  let baseURL: URL
  private let session: URLSession

  /// Creates a cookie-free client because native authentication is authorized only by the bearer token kept in Keychain.
  static func live(baseURL: URL) -> AccountAPI {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.httpCookieAcceptPolicy = .never
    configuration.httpShouldSetCookies = false
    configuration.timeoutIntervalForRequest = 30
    configuration.timeoutIntervalForResource = 60

    return AccountAPI(baseURL: baseURL, session: URLSession(configuration: configuration))
  }

  /// Loads the authenticated profile and subscription state used by the avatar and account sheet.
  func getCurrentAccount(token: String) async throws -> CurrentAccount {
    let request = makeRequest(path: "/v1/me", token: token)
    return try decode(CurrentAccount.self, from: await data(for: request))
  }

  /// Asks the existing mailer to send the same localized six-digit sign-in code used by the web application.
  func sendEmailCode(email: String) async throws {
    let body = EmailCodeRequest(email: email, type: "sign-in")
    let request = try makeJSONRequest(
      body: body,
      method: "POST",
      path: "/v1/auth/email-otp/send-verification-otp")
    _ = try await data(for: request)
  }

  /// Exchanges a verified email code for a Zoonk session rather than treating the short-lived code as an API credential.
  func signInWithEmailCode(email: String, code: String) async throws -> String {
    let body = EmailCodeSignInRequest(email: email, otp: code)
    let request = try makeJSONRequest(
      body: body,
      method: "POST",
      path: "/v1/auth/sign-in/email-otp")
    let response = try decode(SessionTokenResponse.self, from: await data(for: request))
    return response.token
  }

  /// Sends Apple's single-use code and signed identity assertion so the server owns token exchange, verification, and account linking.
  func signInWithApple(_ credentials: AppleSignInCredentials) async throws -> String {
    let request = try makeJSONRequest(
      body: makeAppleRequestBody(credentials),
      method: "POST",
      path: "/v1/auth/sign-in/apple-native")
    let response = try decode(SessionTokenResponse.self, from: await data(for: request))
    return response.token
  }

  /// Sends Google's native ID token to Better Auth so the server verifies the provider assertion and returns a Zoonk session.
  func signInWithGoogle(idToken: String) async throws -> String {
    let request = try makeJSONRequest(
      body: GoogleSignInRequest(
        idToken: GoogleIdentityToken(token: idToken),
        provider: "google"),
      method: "POST",
      path: "/v1/auth/sign-in/social")
    let response = try decode(SessionTokenResponse.self, from: await data(for: request))
    return response.token
  }

  /// Updates the public profile through the documented product API so first-time setup and later edits share one server contract.
  func updateProfile(token: String, name: String, username: String) async throws -> CurrentAccount {
    let request = try makeJSONRequest(
      body: ProfileUpdateRequest(name: name, username: username),
      method: "PATCH",
      path: "/v1/me",
      token: token)
    return try decode(CurrentAccount.self, from: await data(for: request))
  }

  /// Revokes the shared server-side bearer session before the native client clears its local authenticated state.
  func signOut(token: String) async throws {
    let request = try makeJSONRequest(
      body: EmptyRequest(),
      method: "POST",
      path: "/v1/auth/sign-out",
      token: token)
    _ = try await data(for: request)
  }

  /// Sends one atomic deletion request so the server owns any required Apple reauthorization, provider revocation, and permanent data cleanup.
  func deleteAccount(
    token: String,
    appleCredentials: AppleSignInCredentials? = nil,
    emailCredentials: EmailReauthenticationCredentials? = nil
  ) async throws -> AccountDeletionResponse {
    let request = try makeJSONRequest(
      body: AccountDeletionRequest(
        appleCredentials: appleCredentials.map { makeAppleRequestBody($0) },
        emailCredentials: emailCredentials),
      method: "DELETE",
      path: "/v1/me",
      token: token)
    return try decode(
      AccountDeletionResponse.self,
      from: await data(for: request, forbiddenError: .reauthenticationRequired))
  }

  /// Builds a request with the locale and optional bearer credential applied consistently to every native API call.
  private func makeRequest(path: String, token: String? = nil) -> URLRequest {
    var request = URLRequest(url: baseURL.appending(path: path))
    request.setValue(Locale.preferredLanguages.first ?? "en", forHTTPHeaderField: "Accept-Language")

    if let token {
      request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }

    return request
  }

  /// Encodes a typed JSON body without enabling URLSession's cookie storage or adding browser-only origin headers.
  private func makeJSONRequest<Body: Encodable>(
    body: Body,
    method: String,
    path: String,
    token: String? = nil
  ) throws -> URLRequest {
    var request = makeRequest(path: path, token: token)
    request.httpBody = try JSONEncoder().encode(body)
    request.httpMethod = method
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    return request
  }

  /// Converts transport and API failures into the small set of recovery states the native interface can act on.
  private func data(
    for request: URLRequest,
    forbiddenError: AccountAPIError? = nil
  ) async throws -> Data {
    let result: (Data, URLResponse)

    do {
      result = try await session.data(for: request)
    } catch {
      throw AccountAPIError.network
    }

    guard let response = result.1 as? HTTPURLResponse else {
      throw AccountAPIError.invalidResponse
    }

    guard 200..<300 ~= response.statusCode else {
      throw getAPIError(
        statusCode: response.statusCode,
        data: result.0,
        forbiddenError: forbiddenError)
    }

    return result.0
  }

  /// Decodes successful responses in one place so malformed server payloads never become a partially authenticated UI state.
  private func decode<Value: Decodable>(_ type: Value.Type, from data: Data) throws -> Value {
    do {
      return try JSONDecoder().decode(type, from: data)
    } catch {
      throw AccountAPIError.invalidResponse
    }
  }

  /// Maps both Better Auth and product API envelopes without exposing upstream error prose directly to users.
  private func getAPIError(
    statusCode: Int,
    data: Data,
    forbiddenError: AccountAPIError?
  ) -> AccountAPIError {
    let payload = try? JSONDecoder().decode(AccountErrorResponse.self, from: data)
    let code = payload?.code ?? payload?.error?.code
    let message = payload?.message ?? payload?.error?.message

    if code == "ACCOUNT_DELETION_APPLE_MISMATCH" {
      return .appleCredentialMismatch
    }

    if code == "ACCOUNT_DELETION_EMAIL_MISMATCH" {
      return .accountMismatch
    }

    if let code,
      [
        "ACCOUNT_DELETION_INVALID_OTP",
        "ACCOUNT_DELETION_OTP_EXPIRED",
        "ACCOUNT_DELETION_OTP_LOCKED",
      ].contains(code)
    {
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

    if code == "INVALID_OTP" || code == "OTP_EXPIRED" || message == "Invalid OTP" {
      return .invalidCode
    }

    if statusCode == 409 || code == "USERNAME_IS_ALREADY_TAKEN" {
      return .usernameTaken
    }

    if statusCode == 400 || statusCode == 422 {
      return .validation
    }

    return .invalidResponse
  }

  /// Builds the provider payload once so sign-in and sensitive-action reauthorization send exactly the same native Apple credential shape.
  private func makeAppleRequestBody(_ credentials: AppleSignInCredentials) -> AppleSignInRequest {
    let user = credentials.email.map {
      AppleIdentityUser(
        email: $0,
        name: AppleIdentityName(
          firstName: credentials.firstName ?? "",
          lastName: credentials.lastName ?? ""))
    }

    return AppleSignInRequest(
      authorizationCode: credentials.authorizationCode,
      idToken: credentials.identityToken,
      nonce: credentials.nonce,
      user: user)
  }
}

extension AccountAPI: AccountAPIClient {}

private struct EmailCodeRequest: Encodable {
  let email: String
  let type: String
}

private struct EmailCodeSignInRequest: Encodable {
  let email: String
  let otp: String
}

private struct AppleSignInRequest: Encodable {
  let authorizationCode: String
  let idToken: String
  let nonce: String
  let user: AppleIdentityUser?
}

private struct AccountDeletionRequest: Encodable {
  let appleCredentials: AppleSignInRequest?
  let emailCredentials: EmailReauthenticationCredentials?
}

private struct AppleIdentityUser: Encodable {
  let email: String
  let name: AppleIdentityName
}

private struct AppleIdentityName: Encodable {
  let firstName: String
  let lastName: String
}

private struct GoogleSignInRequest: Encodable {
  let idToken: GoogleIdentityToken
  let provider: String
}

private struct GoogleIdentityToken: Encodable {
  let token: String
}

private struct SessionTokenResponse: Decodable {
  let token: String
}

private struct ProfileUpdateRequest: Encodable {
  let name: String
  let username: String
}

private struct EmptyRequest: Encodable {}

private struct AccountErrorResponse: Decodable {
  let code: String?
  let error: AccountErrorDetails?
  let message: String?
}

private struct AccountErrorDetails: Decodable {
  let code: String?
  let message: String?
}
