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

@MainActor
final class WebPlusVisitTests: XCTestCase {
  func testScrollingAwayWhileRenewalFailsKeepsTheFailureForReturn() async throws {
    let server = RenewalFailure()
    let dependencies = AppDependencies.hosted(transport: server)
    let window = try show(
      PlusStatusView(
        subscription: AccountSubscription(plan: "plus", provider: "stripe", status: "active")
      )
      .appDependencies(dependencies).environment(AppRouter()).zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: 420, height: 250)
    try readsWhatVoiceOverReads()
    try await waitForTestCondition("The subscription scroll view did not appear") {
      !requestViews(UIScrollView.self, in: window).isEmpty
    }
    let scroll = try XCTUnwrap(requestViews(UIScrollView.self, in: window).first)
    try await waitForTestCondition("Keep Plus did not appear at the end of the page") {
      scroll.setContentOffset(
        CGPoint(x: 0, y: max(0, scroll.contentSize.height - scroll.bounds.height)), animated: false)
      return spoken(in: window).contains(String(localized: "Keep Plus", table: "Subscriptions"))
    }
    try await activate(String(localized: "Keep Plus", table: "Subscriptions"), in: window)
    try await server.waitForRequest()
    scroll.setContentOffset(.zero, animated: false)
    try await waitForTestCondition("Keep Plus did not scroll out of view") {
      !spoken(in: window).contains(String(localized: "Keep Plus", table: "Subscriptions"))
    }
    await server.release()
    try await waitForTestCondition("Renewal failure did not appear") {
      scroll.setContentOffset(
        CGPoint(x: 0, y: max(0, scroll.contentSize.height - scroll.bounds.height)), animated: false)
      return spoken(in: window).contains { $0.contains("We couldn't keep Plus") }
    }
    XCTAssertTrue(
      spoken(in: window).contains { $0.contains("We couldn't keep Plus") }, "\(spoken(in: window))")
  }
}

private actor RenewalFailure: ClientTransport {
  private var held: TestContinuation<Void>?
  func send(_ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String) async throws
    -> (HTTPResponse, HTTPBody?)
  {
    if operationID == "getStripeSubscriptionCancellation" {
      return (
        HTTPResponse(status: .ok, headerFields: [.contentType: "application/json"]),
        HTTPBody(#"{"state":"ending","periodEnd":"2027-01-01T00:00:00.000Z"}"#)
      )
    }
    if operationID == "resumeStripeSubscription" {
      await withTestVoidContinuation {
        held = $0
      }
    }
    throw APIError.network
  }
  func waitForRequest(file: StaticString = #filePath, line: UInt = #line) async throws {
    try await waitForTestCondition("Renewal was not requested", file: file, line: line) {
      await self.isHeld
    }
  }

  private var isHeld: Bool { held != nil }
  func release() {
    held?.resume()
    held = nil
  }
}
