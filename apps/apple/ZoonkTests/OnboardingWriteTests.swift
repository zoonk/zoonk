import XCTest

@testable import Zoonk

@MainActor
final class OnboardingWriteTests: XCTestCase {
  func testAWriteForTheCurrentSessionReturnsItsValue() async throws {
    let cache = AppCache(session: .preview(account: .onboardingTestAccount))

    let token = try await cache.onboardingWrite { identity in identity.bearerToken }

    XCTAssertEqual(token, "preview-session")
  }

  func testARefusalIsThrownAsItsReasonAndKeepsTheSession() async {
    let session = SessionStore.preview(account: .onboardingTestAccount)
    let cache = AppCache(session: session)
    let limit = OnboardingLimit(period: "day", resource: "activeGoals", tier: "free")

    do {
      _ = try await cache.onboardingWrite { _ -> Int in throw OnboardingError.goalLimit(limit) }
      XCTFail("A refusal is thrown")
    } catch {
      XCTAssertEqual(error as? OnboardingError, .goalLimit(limit))
    }

    XCTAssertNotNil(session.account, "A refusal isn't a sign-out")
  }

  func testATransportFailureIsThrownAsAFailure() async {
    let cache = AppCache(session: .preview(account: .onboardingTestAccount))

    do {
      _ = try await cache.onboardingWrite { _ -> Int in throw APIError.network }
      XCTFail("A failure is thrown")
    } catch {
      XCTAssertEqual(error as? OnboardingError, .failed(.network))
    }
  }

  func testUnauthorizedSignsThatSessionOutAndShowsNothing() async {
    let session = SessionStore.preview(account: .onboardingTestAccount)
    let cache = AppCache(session: session)

    do {
      _ = try await cache.onboardingWrite { _ -> Int in throw APIError.unauthorized }
      XCTFail("An unauthorized write is thrown")
    } catch {
      XCTAssertTrue(error is CancellationError, "Screens show nothing for it")
    }

    XCTAssertNil(session.account)
  }

  func testAResultForAnEndedSessionShowsNothing() async {
    let session = SessionStore.preview(account: .onboardingTestAccount)
    let cache = AppCache(session: session)

    do {
      _ = try await cache.onboardingWrite { identity -> Int in
        await session.expire(identity)
        return 1
      }
      XCTFail("A result for an ended session is thrown")
    } catch {
      XCTAssertTrue(error is CancellationError)
    }
  }
}

extension CurrentAccount {
  fileprivate static let onboardingTestAccount = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false),
      subscription: nil),
    user: AccountUser(
      displayUsername: "learner",
      email: "learner@zoonk.test",
      id: "onboarding-test-user",
      image: nil,
      name: "Learner",
      username: "learner"))
}
