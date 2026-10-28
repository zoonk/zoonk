import CryptoKit
import DeviceCheck
import Foundation

/// The App Attest proof a request carries where a browser would carry BotID's: an assertion this install's attested key signed over a fresh server challenge.
struct AppAttestProof: Equatable, Sendable {
  let assertion: String
  let challenge: String
  let keyID: String
}

protocol AppAttestProving: Sendable {
  /// Returns `nil` when the device can't attest (the simulator, some Macs) or attestation fails, so the request goes without proof and the server decides.
  func proof() async -> AppAttestProof?
}

protocol AppAttestService: Sendable {
  var isSupported: Bool { get }
  func generateKey() async throws -> String
  func attestKey(_ keyId: String, clientDataHash: Data) async throws -> Data
  func generateAssertion(_ keyId: String, clientDataHash: Data) async throws -> Data
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
  enum Failure: Error {
    case rejected
  }

  let clients: APIClientFactory

  func challenge() async throws -> String {
    switch try await clients.makeClient().createAppAttestChallenge(.init()) {
    case .created(let response):
      return try response.body.json.challenge
    case .tooManyRequests, .internalServerError, .undocumented:
      throw Failure.rejected
    }
  }

  func registerKey(keyID: String, attestation: String, challenge: String) async throws {
    let output = try await clients.makeClient().createAppAttestKey(
      .init(body: .json(.init(attestation: attestation, challenge: challenge, keyId: keyID))))

    switch output {
    case .noContent:
      return
    case .badRequest, .tooManyRequests, .internalServerError, .undocumented:
      throw Failure.rejected
    }
  }
}

/// Attests one key per install with Apple and the server, then signs a fresh server challenge for each request that needs bot proof. The key ID lives in `UserDefaults` because the key itself never outlives the install: a reinstall clears both, and a restore from backup leaves a stale ID that the first assertion replaces.
actor AppAttestClient: AppAttestProving {
  private static let keyIDKey = "appAttest.keyID"
  private static let registeredKey = "appAttest.isRegistered"

  private let api: any AppAttestAPIClient
  private let service: any AppAttestService
  private let defaults: UserDefaults
  private var registration: Task<String, Error>?

  /// Tests pass their own `defaultsSuite`; the app keeps the key ID in the standard defaults.
  init(
    api: any AppAttestAPIClient,
    service: any AppAttestService = DeviceAppAttestService(),
    defaultsSuite: String? = nil
  ) {
    self.api = api
    self.service = service
    self.defaults = defaultsSuite.flatMap(UserDefaults.init(suiteName:)) ?? .standard
  }

  func proof() async -> AppAttestProof? {
    guard service.isSupported else {
      return nil
    }

    return try? await makeProof(replacingInvalidKey: true)
  }

  private func makeProof(replacingInvalidKey: Bool) async throws -> AppAttestProof {
    let keyID = try await registeredKeyID()
    let challenge = try await api.challenge()

    do {
      let assertion = try await service.generateAssertion(
        keyID, clientDataHash: Self.clientDataHash(challenge))

      return AppAttestProof(
        assertion: assertion.base64EncodedString(), challenge: challenge, keyID: keyID)
    } catch let error as DCError where error.code == .invalidKey && replacingInvalidKey {
      forgetKey()
      return try await makeProof(replacingInvalidKey: false)
    }
  }

  /// Shares one registration between concurrent requests, so an install never attests two keys at once.
  private func registeredKeyID() async throws -> String {
    if defaults.bool(forKey: Self.registeredKey), let keyID = defaults.string(forKey: Self.keyIDKey)
    {
      return keyID
    }

    if let registration {
      return try await registration.value
    }

    let task = Task { try await register() }
    registration = task
    defer { registration = nil }

    return try await task.value
  }

  /// Keeps a generated key across failures Apple says to retry later, and drops it on any other attestation error, as Apple asks.
  private func register() async throws -> String {
    let keyID = try await generatedKeyID()
    let challenge = try await api.challenge()

    do {
      let attestation = try await service.attestKey(
        keyID, clientDataHash: Self.clientDataHash(challenge))

      try await api.registerKey(
        keyID: keyID, attestation: attestation.base64EncodedString(), challenge: challenge)
    } catch let error as DCError where error.code != .serverUnavailable {
      forgetKey()
      throw error
    }

    defaults.set(true, forKey: Self.registeredKey)
    return keyID
  }

  private func generatedKeyID() async throws -> String {
    if let keyID = defaults.string(forKey: Self.keyIDKey) {
      return keyID
    }

    let keyID = try await service.generateKey()
    defaults.set(keyID, forKey: Self.keyIDKey)
    return keyID
  }

  private func forgetKey() {
    defaults.removeObject(forKey: Self.keyIDKey)
    defaults.removeObject(forKey: Self.registeredKey)
  }

  /// The server hashes the challenge's UTF-8 bytes the same way.
  private static func clientDataHash(_ challenge: String) -> Data {
    Data(SHA256.hash(data: Data(challenge.utf8)))
  }
}
