import XCTest

@testable import Zoonk

@MainActor
final class PlusAccessStoreTests: XCTestCase {
  func testAdultReachesTheOfferWithTheCurrentSession() async {
    let api = PlusAccessAPIStub(accessResults: [.success(.allowed)])
    let store = PlusAccessStore(api: api, session: makeSession())

    await store.load()

    XCTAssertEqual(store.state, .loaded(.allowed))
    let tokens = await api.accessTokens
    XCTAssertEqual(tokens, ["preview-session"])
  }

  func testTransientFailureCanBeRetried() async {
    let api = PlusAccessAPIStub(
      accessResults: [
        .failure(PlusAccessFailure.network),
        .success(.needsGuardianApproval),
      ])
    let store = PlusAccessStore(api: api, session: makeSession())

    await store.load()
    XCTAssertEqual(store.state, .failed(.network))

    await store.load()
    XCTAssertEqual(store.state, .loaded(.needsGuardianApproval))
  }

  func testFailedRefreshKeepsTheLastAnswer() async {
    let api = PlusAccessAPIStub(
      accessResults: [
        .success(.needsGuardianApproval),
        .failure(PlusAccessFailure.unavailable),
      ])
    let store = PlusAccessStore(api: api, session: makeSession())

    await store.load()
    await store.load()

    XCTAssertEqual(store.state, .loaded(.needsGuardianApproval))
  }

  func testUnauthorizedCheckExpiresTheSession() async {
    let session = makeSession()
    let store = PlusAccessStore(
      api: PlusAccessAPIStub(accessResults: [.failure(PlusAccessFailure.unauthorized)]),
      session: session)

    await store.load()

    XCTAssertNil(session.account)
    XCTAssertEqual(store.state, .idle)
  }

  func testLateAnswerCannotReachAnExpiredSession() async throws {
    let requestStarted = expectation(description: "Plus check started")
    let api = SuspendedPlusAccessAPI(requestDidStart: requestStarted.fulfill)
    let session = makeSession()
    let store = PlusAccessStore(api: api, session: session)
    let authenticatedSession = try XCTUnwrap(session.authenticatedSession)
    let request = Task { await store.load() }
    await fulfillment(of: [requestStarted], timeout: 1)

    await session.expire(authenticatedSession)
    await api.resolve(with: .allowed)
    await request.value

    XCTAssertEqual(store.state, .idle)
  }

  func testAnswerIsHiddenOnceItsSessionEnds() async throws {
    let session = makeSession()
    let store = PlusAccessStore(
      api: PlusAccessAPIStub(accessResults: [.success(.allowed)]),
      session: session)
    let authenticatedSession = try XCTUnwrap(session.authenticatedSession)

    await store.load()
    await session.expire(authenticatedSession)

    XCTAssertEqual(store.state, .idle)
  }

  func testApprovalRequestReportsWhetherGuardiansWereAsked() async {
    let api = PlusAccessAPIStub(
      accessResults: [.success(.needsGuardianApproval)],
      approvalResults: [.success(.noGuardian), .success(.requested)])
    let store = PlusAccessStore(api: api, session: makeSession())

    await store.load()
    await store.requestApproval()
    XCTAssertEqual(store.approvalRequest, .noGuardian)

    await store.requestApproval()
    XCTAssertEqual(store.approvalRequest, .requested)
    XCTAssertEqual(store.state, .loaded(.needsGuardianApproval))
  }

  func testApprovalThatIsNoLongerNeededOpensTheOffer() async {
    let api = PlusAccessAPIStub(
      accessResults: [.success(.needsGuardianApproval), .success(.allowed)],
      approvalResults: [.success(.notNeeded)])
    let store = PlusAccessStore(api: api, session: makeSession())

    await store.load()
    await store.requestApproval()

    XCTAssertEqual(store.state, .loaded(.allowed))
    XCTAssertEqual(store.approvalRequest, .idle)
  }

  func testFailedApprovalRequestCanBeRetried() async {
    let api = PlusAccessAPIStub(
      accessResults: [.success(.needsGuardianApproval)],
      approvalResults: [.failure(PlusAccessFailure.network), .success(.requested)])
    let store = PlusAccessStore(api: api, session: makeSession())

    await store.load()
    await store.requestApproval()
    XCTAssertEqual(store.approvalRequest, .failed(.network))

    await store.requestApproval()
    XCTAssertEqual(store.approvalRequest, .requested)
  }

  func testUnauthorizedApprovalRequestExpiresTheSession() async {
    let session = makeSession()
    let store = PlusAccessStore(
      api: PlusAccessAPIStub(
        accessResults: [.success(.needsGuardianApproval)],
        approvalResults: [.failure(PlusAccessFailure.unauthorized)]),
      session: session)

    await store.load()
    await store.requestApproval()

    XCTAssertNil(session.account)
    XCTAssertEqual(store.approvalRequest, .idle)
    XCTAssertEqual(store.state, .idle)
  }

  private func makeSession() -> SessionStore {
    .preview(
      account: CurrentAccount(
        account: AccountAccess(
          deletion: AccountDeletionRequirements(hasAppleAccount: false),
          subscription: nil),
        user: AccountUser(
          displayUsername: "learner",
          email: "learner@zoonk.test",
          id: "plus-access-test-user",
          image: nil,
          name: "Learner",
          username: "learner")))
  }
}

private actor PlusAccessAPIStub: PlusAccessAPIClient {
  private var accessResults: [Result<PlusPurchaseAccess, Error>]
  private var approvalResults: [Result<PlusApprovalRequestResult, Error>]
  private(set) var accessTokens: [String] = []

  init(
    accessResults: [Result<PlusPurchaseAccess, Error>],
    approvalResults: [Result<PlusApprovalRequestResult, Error>] = []
  ) {
    self.accessResults = accessResults
    self.approvalResults = approvalResults
  }

  func getPlusPurchaseAccess(token: String) async throws -> PlusPurchaseAccess {
    accessTokens.append(token)
    return try takeFirst(from: &accessResults).get()
  }

  func requestPlusApproval(token: String) async throws -> PlusApprovalRequestResult {
    try takeFirst(from: &approvalResults).get()
  }

  private func takeFirst<Value>(
    from results: inout [Result<Value, Error>]
  ) -> Result<Value, Error> {
    results.isEmpty ? .failure(PlusAccessFailure.unavailable) : results.removeFirst()
  }
}

/// Holds the Plus check open so a test can end the session before the answer arrives.
private actor SuspendedPlusAccessAPI: PlusAccessAPIClient {
  private let requestDidStart: @Sendable () -> Void
  private var continuation: CheckedContinuation<PlusPurchaseAccess, Never>?

  init(requestDidStart: @escaping @Sendable () -> Void) {
    self.requestDidStart = requestDidStart
  }

  func getPlusPurchaseAccess(token: String) async throws -> PlusPurchaseAccess {
    await withCheckedContinuation { continuation in
      self.continuation = continuation
      requestDidStart()
    }
  }

  func requestPlusApproval(token: String) async throws -> PlusApprovalRequestResult {
    .requested
  }

  func resolve(with access: PlusPurchaseAccess) {
    continuation?.resume(returning: access)
    continuation = nil
  }
}
