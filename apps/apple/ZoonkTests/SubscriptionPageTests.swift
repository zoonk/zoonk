import HTTPTypes
import OpenAPIRuntime
import SwiftUI
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

extension SubscriptionPageTests {
  @MainActor
  func testTwoSubscriptionsEachShowTheirOwnManagementAction() async throws {
    let dependencies = AppDependencies.hosted(transport: UnpaidWebsiteTransport())
    try readsWhatVoiceOverReads()
    let window = try show(
      PlusStatusView(
        subscription: AccountSubscription(plan: "plus", provider: "apple", status: "active")
      )
      .appDependencies(dependencies).environment(AppRouter()).zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: 1032, height: 1376)
    try await Task.sleep(for: .milliseconds(600))
    let words = spoken(in: window).joined(separator: " ")
    XCTAssertTrue(words.contains("Through the App Store"))
    XCTAssertTrue(words.contains("Manage in App Store"))
    XCTAssertTrue(words.contains("Through the website"))
    XCTAssertTrue(words.contains("Update your payment on the website, where you subscribed."))
    XCTAssertFalse(words.contains("Cancel Plus"))
  }
}

private struct UnpaidWebsiteTransport: ClientTransport {
  var state = "unpaid"
  func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws
    -> (HTTPResponse, HTTPBody?)
  {
    guard operationID == "getStripeSubscriptionCancellation" else { throw APIError.network }
    return (
      HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]),
      HTTPBody(Data("{\"state\":\"\(state)\",\"periodEnd\":null}".utf8))
    )
  }
}

extension SubscriptionPageTests {
  @MainActor
  func testRenewingWebsitePlusOpensManagement() async throws {
    try await websiteAction(state: "renewing", label: "Manage on the website")
  }

  @MainActor
  func testEndingWebsitePlusOpensManagement() async throws {
    try await websiteAction(state: "ending", label: "Manage on the website")
  }

  @MainActor
  func testFailedWebsitePlusOpensPayment() async throws {
    try await websiteAction(
      state: "unpaid", label: "Update your payment on the website, where you subscribed.")
  }

  @MainActor
  private func websiteAction(state: String, label: String) async throws {
    let dependencies = AppDependencies.hosted(transport: UnpaidWebsiteTransport(state: state))
    try readsWhatVoiceOverReads()
    let window = try show(
      PlusStatusView(
        subscription: AccountSubscription(plan: "plus", provider: "apple", status: "active")
      )
      .appDependencies(dependencies).environment(AppRouter()).zoonkStyles())
    for (size, width, height) in [("phone", 390.0, 844.0), ("large", 1032.0, 1376.0)] {
      window.frame = CGRect(x: 0, y: 0, width: width, height: height)
      window.rootViewController?.traitOverrides.horizontalSizeClass =
        width > 700 ? .regular : .compact
      try await Task.sleep(for: .milliseconds(600))
      try captureCallsRoundTwo("website-\(state)-\(size)")
    }
    let words = spoken(in: window).joined(separator: " ")
    XCTAssertTrue(words.contains(label), words)
    XCTAssertFalse(words.contains("You subscribed in the App Store."))
  }
}
