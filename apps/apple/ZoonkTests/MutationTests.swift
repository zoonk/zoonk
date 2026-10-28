import XCTest

@testable import Zoonk

@MainActor
final class MutationTests: XCTestCase {
  func testAWriteForTheCurrentSessionIsDoneAndInvalidatesWhatItChanged() async {
    let cache = AppCache(session: .preview(account: .mutationTestAccount))
    let requests = Counter()
    let memory: Resource<Int> = cache.resource(audience: .signedIn, domains: [.memory]) { _ in
      requests.count += 1
      return requests.count
    }
    await memory.load()

    let result = await cache.mutate(invalidating: [.memory]) { identity in identity.bearerToken }
    await memory.load()

    XCTAssertEqual(result.value, "preview-session")
    XCTAssertEqual(memory.state, .loaded(2), "The changed domain is read again")
  }

  func testAFailureForTheCurrentSessionIsReported() async {
    let cache = AppCache(session: .preview(account: .mutationTestAccount))

    let result: MutationResult<Int> = await cache.mutate { _ in throw APIError.network }

    XCTAssertEqual(result.failure, .network)
  }

  func testUnauthorizedSignsThatSessionOutAndIsObsolete() async {
    let session = SessionStore.preview(account: .mutationTestAccount)
    let cache = AppCache(session: session)

    let result: MutationResult<Int> = await cache.mutate { _ in throw APIError.unauthorized }

    XCTAssertTrue(result.isObsolete)
    XCTAssertNil(session.account)
  }

  func testAResultForAnEndedSessionIsObsoleteNotAFailure() async throws {
    let session = SessionStore.preview(account: .mutationTestAccount)
    let cache = AppCache(session: session)

    let result: MutationResult<Int> = await cache.mutate { identity in
      await session.expire(identity)
      throw APIError.network
    }

    XCTAssertTrue(result.isObsolete)
  }

  func testCancellationIsObsolete() async {
    let cache = AppCache(session: .preview(account: .mutationTestAccount))

    let result: MutationResult<Int> = await cache.mutate { _ in throw CancellationError() }

    XCTAssertTrue(result.isObsolete)
  }
  func testACancelledTaskWhoseWriteStillReturnsIsObsoleteAndInvalidatesNothing() async {
    let cache = AppCache(session: .preview(account: .mutationTestAccount))
    let requests = Counter()
    let memory: Resource<Int> = cache.resource(audience: .signedIn, domains: [.memory]) { _ in
      requests.count += 1
      return requests.count
    }
    await memory.load()
    let gate = WriteGate()

    let task = Task {
      await cache.mutate(invalidating: [.memory]) { _ in
        await gate.wait()
        return 1
      }
    }
    await gate.waitUntilStarted()
    task.cancel()
    gate.open()
    let result = await task.value
    await memory.load()

    XCTAssertTrue(result.isObsolete)
    XCTAssertEqual(
      memory.state, .loaded(1), "A cancelled write changes nothing it would invalidate")
  }

  func testACancelledTaskWhoseWriteFailsIsObsoleteNotAFailure() async {
    let cache = AppCache(session: .preview(account: .mutationTestAccount))
    let gate = WriteGate()

    let task = Task {
      await cache.mutate { _ -> Int in
        await gate.wait()
        throw APIError.network
      }
    }
    await gate.waitUntilStarted()
    task.cancel()
    gate.open()

    let result = await task.value
    XCTAssertTrue(result.isObsolete)
  }
}

/// Holds a write until the test opens it, the way a slow request does. Not cancellation-aware, so
/// a write keeps running after its task is cancelled, as a URL request that's already sent does.
@MainActor
private final class WriteGate {
  private var started: CheckedContinuation<Void, Never>?
  private var isStarted = false
  private var waiting: CheckedContinuation<Void, Never>?

  func wait() async {
    isStarted = true
    started?.resume()
    started = nil
    await withCheckedContinuation { waiting = $0 }
  }

  func waitUntilStarted() async {
    guard !isStarted else {
      return
    }

    await withCheckedContinuation { started = $0 }
  }

  func open() {
    waiting?.resume()
    waiting = nil
  }
}

@MainActor
private final class Counter {
  var count = 0
}

extension MutationResult {
  fileprivate var value: Value? {
    if case .done(let value) = self { value } else { nil }
  }

  fileprivate var failure: APIError? {
    if case .failed(let error) = self { error } else { nil }
  }

  fileprivate var isObsolete: Bool {
    if case .obsolete = self { true } else { false }
  }
}

extension CurrentAccount {
  fileprivate static let mutationTestAccount = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false),
      subscription: nil),
    user: AccountUser(
      displayUsername: "learner",
      email: "learner@zoonk.test",
      id: "mutation-test-user",
      image: nil,
      name: "Learner",
      username: "learner"))
}
