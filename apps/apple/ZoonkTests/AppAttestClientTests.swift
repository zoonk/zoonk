import DeviceCheck
import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

final class AppAttestClientTests: XCTestCase {
  func testAttestsOnceAndSignsAFreshChallengeForEveryRequest() async throws {
    let service = FakeAppAttestService()
    let api = FakeAppAttestAPI()
    let client = AppAttestClient(api: api, service: service, defaultsSuite: makeDefaultsSuite())

    let first = await client.proof()
    let second = await client.proof()

    XCTAssertEqual(first?.keyID, "key-1")
    XCTAssertEqual(first?.challenge, "challenge-2")
    XCTAssertEqual(second?.challenge, "challenge-3")
    XCTAssertEqual(second?.keyID, "key-1")
    let generatedKeys = await service.generatedKeys
    let registrations = await api.registrations
    XCTAssertEqual(generatedKeys, 1)
    XCTAssertEqual(registrations, ["key-1 challenge-1"])
  }

  func testReplacesAKeyAppleNoLongerKnows() async throws {
    let suite = makeDefaultsSuite()
    let service = FakeAppAttestService(invalidKeys: ["key-1"])
    let api = FakeAppAttestAPI()
    let defaults = UserDefaults(suiteName: suite)!
    defaults.set("key-1", forKey: "appAttest.keyID")
    defaults.set(true, forKey: "appAttest.isRegistered")
    let client = AppAttestClient(api: api, service: service, defaultsSuite: suite)

    let proof = await client.proof()

    XCTAssertEqual(proof?.keyID, "key-1-new")
    let registrations = await api.registrations
    XCTAssertEqual(registrations.count, 1)
  }

  func testKeepsTheKeyWhenAppleAsksToRetryAttestationLater() async throws {
    let suite = makeDefaultsSuite()
    let service = FakeAppAttestService(attestationErrors: [DCError(.serverUnavailable)])
    let api = FakeAppAttestAPI()
    let client = AppAttestClient(api: api, service: service, defaultsSuite: suite)

    let unavailable = await client.proof()
    let proof = await client.proof()

    XCTAssertNil(unavailable)
    XCTAssertEqual(proof?.keyID, "key-1")
    let generatedKeys = await service.generatedKeys
    XCTAssertEqual(generatedKeys, 1)
  }

  func testSendsNoProofWhereTheDeviceCantAttest() async {
    let api = FakeAppAttestAPI()
    let client = AppAttestClient(
      api: api, service: FakeAppAttestService(isSupported: false),
      defaultsSuite: makeDefaultsSuite())

    let proof = await client.proof()

    XCTAssertNil(proof)
    let challenges = await api.issuedChallenges
    XCTAssertEqual(challenges, 0)
  }

  func testEmailSignInCarriesTheProofInItsHeaders() async throws {
    let proof = AppAttestProof(assertion: "assertion", challenge: "challenge", keyID: "key")
    let api = AccountAPI(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!,
        transport: AppAttestHeaderTransport(expected: proof)),
      appAttest: StaticAppAttestProof(proof: proof))

    try await api.sendEmailCode(email: "learner@zoonk.test")
  }

  private func makeDefaultsSuite() -> String {
    let suite = "AppAttestClientTests.\(UUID().uuidString)"
    addTeardownBlock { UserDefaults().removePersistentDomain(forName: suite) }
    return suite
  }
}

private actor FakeAppAttestService: AppAttestService {
  nonisolated let isSupported: Bool
  private(set) var generatedKeys = 0
  private var attestationErrors: [Error]
  private var invalidKeys: Set<String>

  init(isSupported: Bool = true, attestationErrors: [Error] = [], invalidKeys: Set<String> = []) {
    self.isSupported = isSupported
    self.attestationErrors = attestationErrors
    self.invalidKeys = invalidKeys
  }

  func generateKey() async throws -> String {
    generatedKeys += 1
    return invalidKeys.isEmpty ? "key-\(generatedKeys)" : "key-1-new"
  }

  func attestKey(_ keyId: String, clientDataHash: Data) async throws -> Data {
    if !attestationErrors.isEmpty {
      throw attestationErrors.removeFirst()
    }

    return Data("attestation".utf8)
  }

  func generateAssertion(_ keyId: String, clientDataHash: Data) async throws -> Data {
    if invalidKeys.contains(keyId) {
      throw DCError(.invalidKey)
    }

    return Data("assertion".utf8)
  }
}

private actor FakeAppAttestAPI: AppAttestAPIClient {
  private(set) var issuedChallenges = 0
  private(set) var registrations: [String] = []

  func challenge() async throws -> String {
    issuedChallenges += 1
    return "challenge-\(issuedChallenges)"
  }

  func registerKey(keyID: String, attestation: String, challenge: String) async throws {
    registrations.append("\(keyID) \(challenge)")
  }
}

private struct StaticAppAttestProof: AppAttestProving {
  let proof: AppAttestProof

  func proof() async -> AppAttestProof? {
    proof
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
