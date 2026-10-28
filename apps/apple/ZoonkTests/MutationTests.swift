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
