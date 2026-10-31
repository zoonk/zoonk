import CryptoKit
import DeviceCheck
import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

final class AppAttestClientTests: XCTestCase {
  func testAttestsOnceAndSignsEachRequestOverAFreshChallenge() async throws {
    let service = FakeAppAttestService()
    let api = FakeAppAttestAPI()
    let client = AppAttestClient(api: api, service: service, defaultsSuite: makeDefaultsSuite())
    let request = AppAttestRequest.emailCode(email: "ana@zoonk.test")

    let first = await client.proof(for: request)
    let second = await client.proof(for: .guest)

    XCTAssertEqual(first?.keyID, "key-1")
    XCTAssertEqual(first?.challenge, "challenge-2")
    XCTAssertEqual(second?.challenge, "challenge-3")
    let generatedKeys = await service.generatedKeys
    let registrations = await api.registrations
    let assertionHashes = await service.assertionHashes
    XCTAssertEqual(generatedKeys, 1)
    XCTAssertEqual(registrations, ["key-1 challenge-1"])
    XCTAssertEqual(
      assertionHashes,
      [
        hash(request.clientData(challenge: "challenge-2")),
        hash(AppAttestRequest.guest.clientData(challenge: "challenge-3")),
      ])
  }

  func testSignsTheRequestAsTheServerRebuildsIt() {
    XCTAssertEqual(
      AppAttestRequest.emailSession(email: "ana@zoonk.test", code: "123456")
        .clientData(challenge: "abc"),
      "zoonk-app-attest:1\nabc\nemail-session\nana@zoonk.test\n123456")
    XCTAssertEqual(
      AppAttestRequest.guest.clientData(challenge: "abc"), "zoonk-app-attest:1\nabc\nguest")
  }

  func testReplacesAKeyAppleNoLongerKnows() async throws {
    let suite = makeDefaultsSuite()
    let first = AppAttestClient(
      api: FakeAppAttestAPI(), service: FakeAppAttestService(), defaultsSuite: suite)
    _ = await first.proof(for: .guest)

    let service = FakeAppAttestService(forgottenKeys: ["key-1"], firstKey: 2)
    let api = FakeAppAttestAPI()
    let client = AppAttestClient(api: api, service: service, defaultsSuite: suite)

    let proof = await client.proof(for: .guest)

    XCTAssertEqual(proof?.keyID, "key-2")
    let registrations = await api.registrations
    XCTAssertEqual(registrations, ["key-2 challenge-2"])
  }

  func testRetriesAttestationWithTheSameChallengeWhenAppleAsks() async throws {
    let service = FakeAppAttestService(attestationErrors: [DCError(.serverUnavailable)])
    let api = FakeAppAttestAPI()
    let client = AppAttestClient(api: api, service: service, defaultsSuite: makeDefaultsSuite())

    let unavailable = await client.proof(for: .guest)
    let proof = await client.proof(for: .guest)

    XCTAssertNil(unavailable)
    XCTAssertEqual(proof?.keyID, "key-1")
    let generatedKeys = await service.generatedKeys
    let attestationHashes = await service.attestationHashes
    let registrations = await api.registrations
    XCTAssertEqual(generatedKeys, 1)
    XCTAssertEqual(attestationHashes, [hash("challenge-1"), hash("challenge-1")])
    XCTAssertEqual(registrations, ["key-1 challenge-1"])
  }

  func testStartsOverWhenAppleAsksToRetryAfterTheChallengeExpired() async throws {
    let clock = TestClock()
    let service = FakeAppAttestService(attestationErrors: [DCError(.serverUnavailable)])
    let api = FakeAppAttestAPI()
    let client = AppAttestClient(
      api: api, service: service, defaultsSuite: makeDefaultsSuite(), now: clock.now)

    _ = await client.proof(for: .guest)
    clock.advance(by: 300)
    let proof = await client.proof(for: .guest)

    XCTAssertEqual(proof?.keyID, "key-2")
    let registrations = await api.registrations
    XCTAssertEqual(registrations, ["key-2 challenge-2"])
  }

  func testRegistersTheSameAttestationAfterItsUploadFailed() async throws {
    let service = FakeAppAttestService()
    let api = FakeAppAttestAPI(registrationErrors: [AppAttestAPIFailure.unavailable])
    let client = AppAttestClient(api: api, service: service, defaultsSuite: makeDefaultsSuite())

    let failed = await client.proof(for: .guest)
    let proof = await client.proof(for: .guest)

    XCTAssertNil(failed)
    XCTAssertEqual(proof?.keyID, "key-1")
    let attestationHashes = await service.attestationHashes
    let registrations = await api.registrations
    XCTAssertEqual(attestationHashes.count, 1)
    XCTAssertEqual(registrations, ["key-1 challenge-1"])
  }

  func testStartsOverInTheSameRequestWhenTheServerRefusesTheKey() async throws {
    let service = FakeAppAttestService()
    let api = FakeAppAttestAPI(registrationErrors: [AppAttestAPIFailure.rejected])
    let client = AppAttestClient(api: api, service: service, defaultsSuite: makeDefaultsSuite())

    let proof = await client.proof(for: .guest)

    XCTAssertEqual(proof?.keyID, "key-2")
    let registrations = await api.registrations
    XCTAssertEqual(registrations, ["key-2 challenge-2"])
  }

  func testSendsNoProofWhereTheDeviceCantAttest() async {
    let api = FakeAppAttestAPI()
    let client = AppAttestClient(
      api: api, service: FakeAppAttestService(isSupported: false),
      defaultsSuite: makeDefaultsSuite())

    let proof = await client.proof(for: .guest)

    XCTAssertNil(proof)
    let challenges = await api.issuedChallenges
    XCTAssertEqual(challenges, 0)
  }

  func testEmailSignInCarriesTheProofForItsOwnEmail() async throws {
    let proof = AppAttestProof(assertion: "assertion", challenge: "challenge", keyID: "key")
    let prover = RecordingAppAttestProof(proof: proof)
    let api = AccountAPI(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!,
        transport: AppAttestHeaderTransport(expected: proof)),
      appAttest: prover)

    try await api.sendEmailCode(email: "learner@zoonk.test")

    let requests = await prover.requests
    XCTAssertEqual(requests, [.emailCode(email: "learner@zoonk.test")])
  }

  private func hash(_ text: String) -> Data {
    Data(SHA256.hash(data: Data(text.utf8)))
  }

  private func makeDefaultsSuite() -> String {
    let suite = "AppAttestClientTests.\(UUID().uuidString)"
    addTeardownBlock { UserDefaults().removePersistentDomain(forName: suite) }
    return suite
  }
}

/// Behaves like `DCAppAttestService`: a key is attested once, and a key it no longer knows can't sign.
private actor FakeAppAttestService: AppAttestService {
  nonisolated let isSupported: Bool
  private(set) var generatedKeys = 0
  private(set) var attestationHashes: [Data] = []
  private(set) var assertionHashes: [Data] = []
  private var attestationErrors: [Error]
  private var attestedKeys: Set<String> = []
  private let forgottenKeys: Set<String>
  private let firstKey: Int

  init(
    isSupported: Bool = true,
    attestationErrors: [Error] = [],
    forgottenKeys: Set<String> = [],
    firstKey: Int = 1
  ) {
    self.isSupported = isSupported
    self.attestationErrors = attestationErrors
    self.forgottenKeys = forgottenKeys
    self.firstKey = firstKey
  }

  func generateKey() async throws -> String {
    generatedKeys += 1
    return "key-\(firstKey + generatedKeys - 1)"
  }

  func attestKey(_ keyId: String, clientDataHash: Data) async throws -> Data {
    attestationHashes.append(clientDataHash)

    if !attestationErrors.isEmpty {
      throw attestationErrors.removeFirst()
    }

    guard attestedKeys.insert(keyId).inserted else {
      throw DCError(.invalidKey)
    }

    return Data("attestation".utf8)
  }

  func generateAssertion(_ keyId: String, clientDataHash: Data) async throws -> Data {
    if forgottenKeys.contains(keyId) {
      throw DCError(.invalidKey)
    }

    assertionHashes.append(clientDataHash)
    return Data("assertion".utf8)
  }
}

private actor FakeAppAttestAPI: AppAttestAPIClient {
  private(set) var issuedChallenges = 0
  private(set) var registrations: [String] = []
  private var registrationErrors: [Error]

  init(registrationErrors: [Error] = []) {
    self.registrationErrors = registrationErrors
  }

  func challenge() async throws -> String {
    issuedChallenges += 1
    return "challenge-\(issuedChallenges)"
  }

  func registerKey(keyID: String, attestation: String, challenge: String) async throws {
    if !registrationErrors.isEmpty {
      throw registrationErrors.removeFirst()
    }

    registrations.append("\(keyID) \(challenge)")
  }
}

private final class TestClock: @unchecked Sendable {
  private var current = Date(timeIntervalSince1970: 1_800_000_000)
  private let lock = NSLock()

  var now: @Sendable () -> Date {
    { [self] in lock.withLock { current } }
  }

  func advance(by seconds: TimeInterval) {
    lock.withLock { current += seconds }
  }
}

private actor RecordingAppAttestProof: AppAttestProving {
  let proof: AppAttestProof
  private(set) var requests: [AppAttestRequest] = []

  init(proof: AppAttestProof) {
    self.proof = proof
  }

  func proof(for request: AppAttestRequest) async -> AppAttestProof? {
    requests.append(request)
    return proof
  }
}

private struct AppAttestHeaderTransport: ClientTransport {
  let expected: AppAttestProof

  func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String)
    async throws -> (HTTPResponse, HTTPBody?)
  {
    XCTAssertEqual(operationID, "createEmailSignInCode")
    XCTAssertEqual(
      request.headerFields[HTTPField.Name("x-app-attest-assertion")!], expected.assertion)
    XCTAssertEqual(
      request.headerFields[HTTPField.Name("x-app-attest-challenge")!], expected.challenge)
    XCTAssertEqual(request.headerFields[HTTPField.Name("x-app-attest-key-id")!], expected.keyID)
    return (HTTPResponse(status: .noContent), nil)
  }
}
