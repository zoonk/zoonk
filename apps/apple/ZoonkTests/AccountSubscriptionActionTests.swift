import XCTest

@testable import Zoonk

final class AccountSubscriptionActionTests: XCTestCase {
  func testFreeAccountCanSubscribeInApp() {
    XCTAssertEqual(makeAccess(subscription: nil).subscriptionAction, .subscribe)
  }

  func testAppleSubscriptionUsesNativeManagement() {
    XCTAssertEqual(
      makeAccess(subscription: makeSubscription(provider: "apple")).subscriptionAction,
      .manageAppStore)
  }

  func testGoogleSubscriptionUsesInformationalManagementGuidance() {
    XCTAssertEqual(
      makeAccess(subscription: makeSubscription(provider: "google")).subscriptionAction,
      .explainGooglePlayManagement)
  }

  func testUnknownSubscriptionProviderFallsBackToSupport() {
    XCTAssertEqual(
      makeAccess(subscription: makeSubscription(provider: "unknown")).subscriptionAction,
      .contactSupport)
  }

  private func makeAccess(subscription: AccountSubscription?) -> AccountAccess {
    AccountAccess(
      deletion: AccountDeletionRequirements(hasAppleAccount: false),
      subscription: subscription)
  }

  private func makeSubscription(provider: String) -> AccountSubscription {
    AccountSubscription(plan: "plus", provider: provider, status: "active")
  }
}
