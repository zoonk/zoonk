import StoreKitTest
import XCTest

private enum UITestScenario: Equatable {
  case appleSubscription
  case freeSubscription
  case googleSubscription
  case requiredSetup
  case signedOut

  var accountJSON: String? {
    switch self {
    case .requiredSetup:
      requiredSetupAccountJSON
    case .appleSubscription:
      accountJSON(provider: "apple")
    case .freeSubscription:
      accountJSON(provider: nil)
    case .googleSubscription:
      accountJSON(provider: "google")
    case .signedOut:
      nil
    }
  }

  var launchArguments: [String] {
    ["-AppleLanguages", "(en)", "-AppleLocale", "en_US", "--ui-testing"]
      + (self == .requiredSetup ? ["--ui-testing-account-sheet"] : [])
  }

  private var requiredSetupAccountJSON: String {
    return """
      {
        "account": {
          "deletion": { "hasAppleAccount": false },
          "subscription": { "plan": "plus", "provider": "google", "status": "active" }
        },
        "user": {
          "displayUsername": null,
          "email": "ui-test@zoonk.test",
          "id": "7846d3f5-b9c4-4ded-b283-35f70a48af86",
          "image": null,
          "name": "",
          "username": null
        }
      }
      """
  }

  private func accountJSON(provider: String?) -> String {
    let subscription =
      provider.map {
        #"{ "plan": "plus", "provider": "\#($0)", "status": "active" }"#
      } ?? "null"

    return """
      {
        "account": {
          "deletion": { "hasAppleAccount": false },
          "subscription": \(subscription)
        },
        "user": {
          "displayUsername": "ui_test_user",
          "email": "ui-test@zoonk.test",
          "id": "7846d3f5-b9c4-4ded-b283-35f70a48af86",
          "image": null,
          "name": "UI Test User",
          "username": "ui_test_user"
        }
      }
      """
  }
}

final class ZoonkUITests: XCTestCase {
  private var storeKitSession: SKTestSession?

  override func tearDown() {
    storeKitSession?.clearTransactions()
    storeKitSession?.resetToDefaultState()
    storeKitSession = nil
    super.tearDown()
  }

  /// Proves that the account affordance opens directly to the sign-in methods configured in this test build without an extra navigation step.
  @MainActor
  func testAccountSheetOffersEverySignInMethod() {
    continueAfterFailure = false

    let app = makeApp()
    app.launch()

    let accountButton = app.buttons["Account"]
    XCTAssertTrue(
      accountButton.waitForExistence(timeout: 5), "Expected the account button to exist")
    accountButton.tap()

    for method in ["Continue with Apple", "Sign in with Google", "Continue with email"] {
      XCTAssertTrue(
        app.buttons[method].waitForExistence(timeout: 5),
        "Expected the login screen to offer \(method)")
    }

    XCTAssertFalse(
      app.navigationBars["Account"].exists,
      "Expected the sign-in sheet to avoid a redundant Account title")
  }

  @MainActor
  func testPrimaryScreenShowsTitleAndAccountAction() {
    continueAfterFailure = false

    let app = makeApp()
    app.launch()

    let navigationBar = app.navigationBars["Home"]
    let accountButton = app.buttons["Account"]

    XCTAssertTrue(
      navigationBar.waitForExistence(timeout: 5), "Expected the native screen title to exist")
    XCTAssertTrue(accountButton.exists, "Expected the account button to exist")
  }

  @MainActor
  func testSignInMethodsUseConsistentGeometry() {
    continueAfterFailure = false

    let app = makeApp()
    app.launch()
    app.buttons["Account"].tap()

    let appleButton = app.buttons["Continue with Apple"]
    let googleButton = app.buttons["Sign in with Google"]
    let emailButton = app.buttons["Continue with email"]

    for button in [appleButton, googleButton, emailButton] {
      XCTAssertTrue(button.waitForExistence(timeout: 5))
    }

    XCTAssertEqual(googleButton.frame.height, appleButton.frame.height, accuracy: 1)
    XCTAssertEqual(emailButton.frame.height, appleButton.frame.height, accuracy: 1)
  }

  /// Proves the accessible email field uses the email keyboard, preserves lowercase input, and submits through the keyboard action.
  @MainActor
  func testEmailSignInUsesAccessibleEmailKeyboard() {
    continueAfterFailure = false

    let app = makeApp()
    app.launchEnvironment["ZOONK_API_BASE_URL"] = "http://127.0.0.1:1"
    app.launch()

    let accountButton = app.buttons["Account"]
    XCTAssertTrue(
      accountButton.waitForExistence(timeout: 5), "Expected the account button to exist")
    accountButton.tap()

    let emailSignInButton = app.buttons["Continue with email"]
    XCTAssertTrue(
      emailSignInButton.waitForExistence(timeout: 5),
      "Expected the account sheet to offer email sign-in")
    emailSignInButton.tap()

    let emailField = app.textFields["Email"]
    XCTAssertTrue(
      emailField.waitForExistence(timeout: 5), "Expected the email sign-in field to exist")
    XCTAssertTrue(emailField.isHittable, "Expected the email sign-in field to be interactive")
    emailField.tap()

    XCTAssertTrue(
      app.keys["@"].waitForExistence(timeout: 5),
      "Expected the email address keyboard to expose the at-sign key")

    emailField.typeText("test@example.com")
    XCTAssertEqual(emailField.value as? String, "test@example.com")

    emailField.typeText("\n")

    XCTAssertTrue(
      app.staticTexts["Zoonk couldn't connect. Check your connection and try again."]
        .waitForExistence(timeout: 5),
      "Expected the keyboard action to submit the email code request")
  }

  /// Proves required profile setup cannot be dismissed before the user saves a valid profile.
  @MainActor
  func testRequiredProfileSetupOnlyOffersSave() {
    continueAfterFailure = false

    let app = makeApp(for: .requiredSetup)
    app.launch()

    let setupNavigationBar = app.navigationBars["Finish setup"]
    XCTAssertTrue(
      setupNavigationBar.waitForExistence(timeout: 5),
      "Expected required profile setup to open directly")
    XCTAssertTrue(
      app.buttons["Save"].exists,
      "Expected required profile setup to offer its save action")
    XCTAssertFalse(
      app.buttons["Close"].exists,
      "Expected required profile setup to omit the account sheet close action")

    setupNavigationBar.swipeDown(velocity: .fast)

    XCTAssertTrue(
      setupNavigationBar.waitForExistence(timeout: 2),
      "Expected required profile setup to reject interactive dismissal")
  }

  /// Proves a free account reaches Apple's localized subscription store instead of an external checkout.
  @MainActor
  func testFreeAccountOpensNativeSubscriptionStore() throws {
    continueAfterFailure = false
    storeKitSession = try makeStoreKitSession()

    let app = makeApp(for: .freeSubscription)
    addTeardownBlock {
      app.terminate()
    }
    app.launch()
    openAccount(in: app)

    let subscription = app.buttons["Subscription"]
    XCTAssertTrue(subscription.waitForExistence(timeout: 5))
    XCTAssertEqual(subscription.value as? String, "Free")
    subscription.tap()

    XCTAssertTrue(
      app.navigationBars["Zoonk Plus"].waitForExistence(timeout: 5),
      "Expected the free account to reach the native subscription screen")
    XCTAssertTrue(
      app.staticTexts["Learn anything. It’s all included."].waitForExistence(timeout: 5),
      "Expected the subscription screen to use the product's Plus value proposition")
    XCTAssertTrue(
      app.staticTexts["Plus Monthly"].waitForExistence(timeout: 5),
      "Expected StoreKit to load the localized monthly subscription")
    XCTAssertTrue(
      app.staticTexts["Plus Yearly"].waitForExistence(timeout: 5),
      "Expected StoreKit to load the localized yearly subscription")
    XCTAssertTrue(
      app.buttons["Restore Purchases"].waitForExistence(timeout: 5),
      "Expected a semantic App Store restore action")
    XCTAssertFalse(
      app.buttons["Close"].exists,
      "Expected navigation Back to be the only way out of the pushed subscription screen")
  }

  /// Proves App Store ownership is visible before the native subscription-management sheet opens.
  @MainActor
  func testAppleSubscriptionShowsAppStoreManagement() {
    continueAfterFailure = false

    let app = makeApp(for: .appleSubscription)
    app.launch()
    openAccount(in: app)

    let subscription = app.buttons["Subscription"]
    XCTAssertTrue(subscription.waitForExistence(timeout: 5))
    XCTAssertEqual(subscription.value as? String, "App Store")
  }

  /// Proves a Google-owned subscription remains visible while iOS explains management without linking to an external purchase surface.
  @MainActor
  func testGoogleSubscriptionShowsInformationalManagement() {
    continueAfterFailure = false

    let app = makeApp(for: .googleSubscription)
    app.launch()
    openAccount(in: app)

    let subscription = app.buttons["Subscription"]
    XCTAssertTrue(subscription.waitForExistence(timeout: 5))
    XCTAssertEqual(subscription.value as? String, "Google Play")
    subscription.tap()

    XCTAssertTrue(
      app.alerts["Managed on Google Play"].waitForExistence(timeout: 5),
      "Expected informational Google Play management guidance")
    XCTAssertTrue(
      app.staticTexts[
        "Use Google Play on an Android device to change or cancel this subscription."
      ].exists,
      "Expected guidance without an external Google Play purchase link")
  }

  /// Proves that account deletion is a deliberate native flow: the account option opens a dedicated screen and the irreversible request still requires confirmation.
  @MainActor
  func testAccountDeletionRequiresConfirmation() {
    continueAfterFailure = false

    let app = makeApp(for: .googleSubscription)
    app.launch()

    let accountButton = app.buttons["Account"]
    XCTAssertTrue(
      accountButton.waitForExistence(timeout: 5), "Expected the account button to exist")
    accountButton.tap()

    let deleteAccountButton = app.buttons["Delete account"]
    XCTAssertTrue(
      deleteAccountButton.waitForExistence(timeout: 5),
      "Expected the signed-in account sheet to offer account deletion")
    deleteAccountButton.tap()

    XCTAssertTrue(
      app.navigationBars["Delete account"].waitForExistence(timeout: 5),
      "Expected account deletion to open a dedicated screen")
    XCTAssertTrue(
      app.staticTexts["Managed on Google Play"].waitForExistence(timeout: 5),
      "Expected deletion to explain which store still owns billing")

    app.buttons["Delete account"].tap()

    let confirmation = app.sheets["Delete your Zoonk account?"]
    XCTAssertTrue(
      confirmation.waitForExistence(timeout: 5),
      "Expected permanent deletion to require confirmation")
    XCTAssertTrue(
      confirmation.buttons["Delete account"].exists,
      "Expected the confirmation to contain the final destructive action")
  }

  /// Proves that signing out starts immediately instead of adding a confirmation step for a reversible action.
  @MainActor
  func testSignOutStartsImmediately() {
    continueAfterFailure = false

    let app = makeApp(for: .googleSubscription)
    app.launchEnvironment["ZOONK_API_BASE_URL"] = "http://127.0.0.1:1"
    app.launch()

    let accountButton = app.buttons["Account"]
    XCTAssertTrue(
      accountButton.waitForExistence(timeout: 5), "Expected the account button to exist")
    accountButton.tap()

    let signOutButton = app.buttons["Sign out"]
    XCTAssertTrue(
      signOutButton.waitForExistence(timeout: 5),
      "Expected the signed-in account sheet to offer sign out")
    signOutButton.tap()

    XCTAssertTrue(
      app.staticTexts["Zoonk couldn't connect. Check your connection and try again."]
        .waitForExistence(timeout: 5),
      "Expected tapping sign out to start the API request immediately")
  }

  /// Proves that every primary destination is reachable through the native tab bar and presents the matching screen heading.
  @MainActor
  func testPrimaryTabsNavigateToTheirScreens() {
    continueAfterFailure = false

    let app = makeApp()
    app.launch()

    let destinations = [
      (tabTitle: "Home", screenTitle: "Home"),
      (tabTitle: "New", screenTitle: "New course"),
      (tabTitle: "Courses", screenTitle: "Courses"),
      (tabTitle: "Progress", screenTitle: "Progress"),
      (tabTitle: "Search", screenTitle: "Search"),
    ]

    for destination in destinations {
      let tab = app.buttons[destination.tabTitle].firstMatch
      XCTAssertTrue(
        tab.waitForExistence(timeout: 5), "Expected the \(destination.tabTitle) tab to exist")
      XCTAssertTrue(tab.isHittable, "Expected the \(destination.tabTitle) tab to be hittable")
      tab.tap()

      let selectedTab = XCTNSPredicateExpectation(
        predicate: NSPredicate(format: "isSelected == true"),
        object: tab)
      XCTAssertEqual(
        XCTWaiter.wait(for: [selectedTab], timeout: 5),
        .completed,
        "Expected the \(destination.tabTitle) tab to become selected")

      XCTAssertTrue(
        app.navigationBars[destination.screenTitle].firstMatch.waitForExistence(timeout: 5),
        "Expected the \(destination.screenTitle) screen heading to exist")
    }
  }

  /// Creates one isolated app process from scenario data owned by the UI-test target rather than the distributable app.
  @MainActor
  private func makeApp(for scenario: UITestScenario = .signedOut) -> XCUIApplication {
    let app = XCUIApplication()
    app.launchArguments += scenario.launchArguments

    if let accountJSON = scenario.accountJSON {
      app.launchEnvironment["ZOONK_UI_TEST_ACCOUNT"] = accountJSON
    }

    return app
  }

  @MainActor
  private func openAccount(in app: XCUIApplication) {
    let accountButton = app.buttons["Account"]
    XCTAssertTrue(
      accountButton.waitForExistence(timeout: 5), "Expected the account button to exist")
    accountButton.tap()
  }

  private func makeStoreKitSession() throws -> SKTestSession {
    let configurationURL = try XCTUnwrap(
      Bundle(for: ZoonkUITests.self).url(
        forResource: "Subscriptions", withExtension: "storekit"),
      "Expected the UI-test bundle to contain Subscriptions.storekit")
    let session = try SKTestSession(contentsOf: configurationURL)
    session.resetToDefaultState()
    session.clearTransactions()
    session.disableDialogs = true
    return session
  }
}
