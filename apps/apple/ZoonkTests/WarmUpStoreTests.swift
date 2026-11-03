import XCTest

@testable import Zoonk

@MainActor
final class WarmUpStoreTests: XCTestCase {
  func testAGuessSendsLaterWaitsToTheNextCardAndNeverBack() {
    let store = makeStore(session: .preview(account: .warmUpTestAccount))

    store.guessed(card: 1, deckID: "deck")
    // Another window still showing the first card.
    store.guessed(card: 0, deckID: "deck")

    XCTAssertEqual(store.firstUnguessed(deckID: "deck"), 2)
    XCTAssertEqual(store.firstUnguessed(deckID: "other"), 0)
  }

  func testAnotherSessionStartsEveryDeckOver() async throws {
    let session = SessionStore.preview(account: .warmUpTestAccount)
    let store = makeStore(session: session)
    store.guessed(card: 0, deckID: "deck")

    await session.expire(try XCTUnwrap(session.authenticatedSession))

    XCTAssertEqual(store.firstUnguessed(deckID: "deck"), 0)
  }

  private func makeStore(session: SessionStore) -> WarmUpStore {
    WarmUpStore(api: WarmUpAPIStub(), cache: AppCache(session: session))
  }
}

private struct WarmUpAPIStub: WarmUpAPIClient {
  func deck(id: String, token: String) async throws -> WarmUpDeck? {
    nil
  }
}

extension CurrentAccount {
  fileprivate static let warmUpTestAccount = CurrentAccount(
    account: AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false),
      subscription: nil),
    user: AccountUser(
      displayUsername: "learner",
      email: "learner@zoonk.test",
      id: "warm-up-test-user",
      image: nil,
      name: "Learner",
      username: "learner"))
}
