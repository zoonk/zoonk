import XCTest

private enum UITestScenario: Equatable {
  case requiredSetup
  case signedIn
  case signedOut

  var accountJSON: String? {
    switch self {
    case .requiredSetup:
      requiredSetupAccountJSON
    case .signedIn:
      signedInAccountJSON
    case .signedOut:
      nil
    }
  }

  var launchArguments: [String] {
    ["-AppleLanguages", "(en)", "-AppleLocale", "en_US", "--ui-testing"]
      + (self == .requiredSetup ? ["--ui-testing-account-sheet"] : [])
  }

  private var requiredSetupAccountJSON: String {
    """
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

  private var signedInAccountJSON: String {
    """
    {
      "account": {
        "deletion": { "hasAppleAccount": false },
        "subscription": { "plan": "plus", "provider": "google", "status": "active" }
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

  /// Proves the accessible email field uses the email keyboard and accepts lowercase input without changing what the user typed.
  @MainActor
  func testEmailSignInUsesAccessibleEmailKeyboard() {
    continueAfterFailure = false

    let app = makeApp()
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
  }

  /// Proves required profile setup cannot be dismissed from its toolbar before the user saves a valid profile.
  @MainActor
  func testRequiredProfileSetupOnlyOffersSave() {
    continueAfterFailure = false

    let app = makeApp(for: .requiredSetup)
    app.launch()

    XCTAssertTrue(
      app.navigationBars["Finish setup"].waitForExistence(timeout: 5),
      "Expected required profile setup to open directly")
    XCTAssertTrue(
      app.buttons["Save"].exists,
      "Expected required profile setup to offer its save action")
    XCTAssertFalse(
      app.buttons["Close"].exists,
      "Expected required profile setup to omit the account sheet close action")
  }

  /// Proves that account deletion is a deliberate native flow: the account option opens a dedicated screen and the irreversible request still requires confirmation.
  @MainActor
  func testAccountDeletionRequiresConfirmation() {
    continueAfterFailure = false

    let app = makeApp(for: .signedIn)
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
      app.buttons["Manage Google Play subscription"].waitForExistence(timeout: 5),
      "Expected deletion to preserve management access for store-owned billing")

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

    let app = makeApp(for: .signedIn)
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

  /// Proves that every primary destination is reachable through the native tab bar and presents the matching screen title.
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
        app.staticTexts[destination.screenTitle].firstMatch.waitForExistence(timeout: 5),
        "Expected the \(destination.screenTitle) screen title to exist")
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
}
