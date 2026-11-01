import XCTest

@testable import Zoonk

final class SubscriptionPageTests: XCTestCase {
  func testLearnerWithoutPlusGetsTheOffer() {
    XCTAssertEqual(SubscriptionPage(current: nil, openedPlan: nil, boughtHere: false), .offer)
  }

  func testPlusFromAnyProviderRefusesAnotherPurchase() {
    for provider in ["apple", "google", "stripe", "zoonk"] {
      let plus = makeSubscription(provider: provider)

      XCTAssertEqual(
        SubscriptionPage(current: plus, openedPlan: nil, boughtHere: false),
        .plan(plus, refusesPurchase: true),
        provider)
    }
  }

  func testPlusBoughtHereShowsThePlanWithoutRefusing() {
    let plus = makeSubscription(provider: "apple")

    XCTAssertEqual(
      SubscriptionPage(current: plus, openedPlan: nil, boughtHere: true),
      .plan(plus, refusesPurchase: false))
  }

  func testPlusEndingOnItsPlanKeepsThePlan() {
    let plus = makeSubscription(provider: "stripe")

    XCTAssertEqual(
      SubscriptionPage(current: nil, openedPlan: plus, boughtHere: false),
      .plan(plus, refusesPurchase: true))
  }

  private func makeSubscription(provider: String) -> AccountSubscription {
    AccountSubscription(plan: "plus", provider: provider, status: "active")
  }
}
