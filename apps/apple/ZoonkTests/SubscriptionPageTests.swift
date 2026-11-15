import XCTest

@testable import Zoonk

final class SubscriptionPageTests: XCTestCase {
  /// The buddy's line names the monthly cap when the plan has one, and ends after "a day" when not.
  func testTheFreePlansBuddyLineNamesItsMonthlyCap() throws {
    let plan = { (month: Int?) in
      try JSONDecoder().decode(
        FreePlan.self,
        from: Data(
          #"{"tutorMessagesPerDay":10,"tutorMessagesPer30Days":\#(month.map(String.init) ?? "null")}"#
            .utf8))
    }

    XCTAssertEqual(
      try plan(100).buddyLine.map { String(localized: $0) },
      "An AI study buddy: 10 messages a day, up to 100 a month")
    XCTAssertEqual(
      try plan(nil).buddyLine.map { String(localized: $0) },
      "An AI study buddy: 10 messages a day")
  }

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
