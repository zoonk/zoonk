import CryptoKit
import DeviceCheck
import Foundation

/// The App Attest proof a request carries where a browser would carry BotID's: an assertion this install's attested key signed over the request and a fresh server challenge.
struct AppAttestProof: Equatable, Sendable {
  let assertion: String
  let challenge: String
  let keyID: String
}

/// A request an assertion proves. The server rebuilds the same client data from the request it receives (`getAppAttestClientData` in `packages/auth/src/app-attest/app-attest-contract.ts`), so a proof made for one email or operation fails on another.
enum AppAttestRequest: Equatable, Sendable {
  case guest
  case emailCode(email: String)
  case emailSession(email: String, code: String)

  /// One value per line: the version, the challenge, the operation, then its fields exactly as the request body sends them.
  func clientData(challenge: String) -> String {
    let (operation, fields): (String, [String]) =
      switch self {
      case .guest: ("guest", [])
      case .emailCode(let email): ("email-code", [email])
      case .emailSession(let email, let code): ("email-session", [email, code])
      }

    return (["zoonk-app-attest:1", challenge, operation] + fields).joined(separator: "\n")
  }
}

protocol AppAttestProving: Sendable {
  /// Returns `nil` when the device can't attest (the simulator, some Macs) or attestation fails, so the request goes without proof and the server decides.
  func proof(for request: AppAttestRequest) async -> AppAttestProof?
}

protocol AppAttestService: Sendable {
  var isSupported: Bool { get }
  func generateKey() async throws -> String
  func attestKey(_ keyId: String, clientDataHash: Data) async throws -> Data
  func generateAssertion(_ keyId: String, clientDataHash: Data) async throws -> Data
}

/// The server answers a key it won't register with `rejected` (a bad attestation or a spent challenge); anything else is worth retrying with the same attestation.
enum AppAttestAPIFailure: Error {
  case rejected
  case unavailable
}

protocol AppAttestAPIClient: Sendable {
  func challenge() async throws -> String
  func registerKey(keyID: String, attestation: String, challenge: String) async throws
}

/// Reads `DCAppAttestService.shared` on each call so no non-sendable service crosses actors.
struct DeviceAppAttestService: AppAttestService {
  var isSupported: Bool { DCAppAttestService.shared.isSupported }

  func generateKey() async throws -> String {
    try await DCAppAttestService.shared.generateKey()
  }

  func attestKey(_ keyId: String, clientDataHash: Data) async throws -> Data {
    try await DCAppAttestService.shared.attestKey(keyId, clientDataHash: clientDataHash)
  }

  func generateAssertion(_ keyId: String, clientDataHash: Data) async throws -> Data {
    try await DCAppAttestService.shared.generateAssertion(keyId, clientDataHash: clientDataHash)
  }
}

struct AppAttestAPI: AppAttestAPIClient {
  let clients: APIClientFactory

  func challenge() async throws -> String {
    switch try await clients.makeClient().createAppAttestChallenge(.init()) {
    case .created(let response):
      return try response.body.json.challenge
    case .tooManyRequests, .internalServerError, .undocumented:
      throw AppAttestAPIFailure.unavailable
    }
  }

  func registerKey(keyID: String, attestation: String, challenge: String) async throws {
    let output = try await clients.makeClient().createAppAttestKey(
      .init(body: .json(.init(attestation: attestation, challenge: challenge, keyId: keyID))))

    switch output {
    case .noContent:
      return
    case .badRequest:
      throw AppAttestAPIFailure.rejected
    case .tooManyRequests, .internalServerError, .undocumented:
      throw AppAttestAPIFailure.unavailable
    }
  }
}

/// Where this install's key is on its way to being registered, kept across launches so a step that failed is retried as Apple and the server need: the same challenge after Apple asks to retry, and the same attestation after an upload fails (Apple attests a key only once).
struct AppAttestKeyState: Codable, Equatable {
  enum Stage: Codable, Equatable {
    case generated
    /// Apple was unavailable: retry with this key and this challenge's hash while the server still accepts it.
    case attestationPending(challenge: String, issuedAt: Date)
    /// Apple attested the key; the server hasn't registered it yet.
    case attested(challenge: String, attestation: String)
    case registered
  }

  var keyID: String
  var stage: Stage
}

/// Attests one key per install with Apple and the server, then signs each request that needs bot proof over a fresh server challenge. The key's state lives in `UserDefaults` because the key itself never outlives the install: a reinstall clears both, and a restore from backup leaves a stale key that the first assertion replaces.
actor AppAttestClient: AppAttestProving {
  /// A step Apple or the server won't take with this key: the install starts over with a new one.
  private struct KeyRefused: Error {}

  private static let stateKey = "appAttest.keyState"
  /// Challenges last five minutes on the server; a retry needs time to reach it.
  private static let challengeReuseWindow: TimeInterval = 240

  private let api: any AppAttestAPIClient
  private let service: any AppAttestService
  private let defaults: UserDefaults
  private let now: @Sendable () -> Date
  private var registration: Task<String, Error>?

  /// Tests pass their own `defaultsSuite` and clock; the app keeps the state in the standard defaults.
  init(
    api: any AppAttestAPIClient,
    service: any AppAttestService = DeviceAppAttestService(),
    defaultsSuite: String? = nil,
    now: @escaping @Sendable () -> Date = Date.init
  ) {
    self.api = api
    self.service = service
    self.defaults = defaultsSuite.flatMap(UserDefaults.init(suiteName:)) ?? .standard
    self.now = now
  }

  func proof(for request: AppAttestRequest) async -> AppAttestProof? {
    guard service.isSupported else {
      return nil
    }

    return try? await makeProof(for: request, replacingInvalidKey: true)
  }

  private func makeProof(
    for request: AppAttestRequest,
    replacingInvalidKey: Bool
  ) async throws -> AppAttestProof {
    let keyID = try await registeredKeyID()
    let challenge = try await api.challenge()

    do {
      let assertion = try await service.generateAssertion(
        keyID, clientDataHash: Self.hash(request.clientData(challenge: challenge)))

      return AppAttestProof(
        assertion: assertion.base64EncodedString(), challenge: challenge, keyID: keyID)
    } catch let error as DCError where error.code == .invalidKey && replacingInvalidKey {
      save(nil)
      return try await makeProof(for: request, replacingInvalidKey: false)
    }
  }

  /// Shares one registration between concurrent requests, so an install never attests two keys at once.
  private func registeredKeyID() async throws -> String {
    if let state = storedState, state.stage == .registered {
      return state.keyID
    }

    if let registration {
      return try await registration.value
    }

    let task = Task { try await register(startingOverOnce: true) }
    registration = task
    defer { registration = nil }

    return try await task.value
  }

  /// Takes the key from wherever the last attempt left it. When Apple or the server refuses it for good, the install starts over with a new key within the same request.
  private func register(startingOverOnce: Bool) async throws -> String {
    do {
      var state = try await storedOrNewState()

      switch state.stage {
      case .generated:
        state = try await attest(state, challenge: api.challenge(), issuedAt: now())
      case .attestationPending(let challenge, let issuedAt):
        guard now().timeIntervalSince(issuedAt) < Self.challengeReuseWindow else {
          throw KeyRefused()
        }

        state = try await attest(state, challenge: challenge, issuedAt: issuedAt)
      case .attested, .registered:
        break
      }

      if case .attested(let challenge, let attestation) = state.stage {
        do {
          try await api.registerKey(
            keyID: state.keyID, attestation: attestation, challenge: challenge)
        } catch AppAttestAPIFailure.rejected {
          throw KeyRefused()
        }

        state.stage = .registered
        save(state)
      }

      return state.keyID
    } catch is KeyRefused {
      save(nil)

      guard startingOverOnce else {
        throw KeyRefused()
      }

      return try await register(startingOverOnce: false)
    }
  }

  /// Apple attests a key once: the attestation is kept until the server registers it. When Apple asks to retry later, the challenge is kept too, because the retry must sign the same hash.
  private func attest(
    _ state: AppAttestKeyState,
    challenge: String,
    issuedAt: Date
  ) async throws -> AppAttestKeyState {
    var state = state

    do {
      let attestation = try await service.attestKey(
        state.keyID, clientDataHash: Self.hash(challenge))

      state.stage = .attested(challenge: challenge, attestation: attestation.base64EncodedString())
      save(state)
      return state
    } catch let error as DCError where error.code == .serverUnavailable {
      state.stage = .attestationPending(challenge: challenge, issuedAt: issuedAt)
      save(state)
      throw error
    } catch is DCError {
      throw KeyRefused()
    }
  }

  private func storedOrNewState() async throws -> AppAttestKeyState {
    if let state = storedState {
      return state
    }

    let state = AppAttestKeyState(keyID: try await service.generateKey(), stage: .generated)
    save(state)
    return state
  }

  private var storedState: AppAttestKeyState? {
    defaults.data(forKey: Self.stateKey).flatMap {
      try? JSONDecoder().decode(AppAttestKeyState.self, from: $0)
    }
  }

  private func save(_ state: AppAttestKeyState?) {
    guard let state, let data = try? JSONEncoder().encode(state) else {
      defaults.removeObject(forKey: Self.stateKey)
      return
    }

    defaults.set(data, forKey: Self.stateKey)
  }

  /// The server hashes the same UTF-8 bytes.
  private static func hash(_ clientData: String) -> Data {
    Data(SHA256.hash(data: Data(clientData.utf8)))
  }
}
