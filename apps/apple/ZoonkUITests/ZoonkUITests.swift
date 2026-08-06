import XCTest

final class ZoonkUITests: XCTestCase {
  /// Proves that the account affordance opens directly to every supported sign-in method without an extra navigation step.
  @MainActor
  func testAccountSheetOffersEverySignInMethod() {
    continueAfterFailure = false

    let app = XCUIApplication()
    app.launchArguments += ["-AppleLanguages", "(en)", "-AppleLocale", "en_US", "--ui-testing"]
    app.launch()

    let accountButton = app.buttons["Account"]
    XCTAssertTrue(
      accountButton.waitForExistence(timeout: 5), "Expected the account button to exist")
    accountButton.tap()

    XCTAssertTrue(
      app.navigationBars["Account"].waitForExistence(timeout: 5),
      "Expected the account sheet to open")

    for method in ["Continue with Apple", "Sign in with Google", "Continue with email"] {
      XCTAssertTrue(
        app.buttons[method].waitForExistence(timeout: 5),
        "Expected the login screen to offer \(method)")
    }
  }

  /// Proves the accessible email field uses the email keyboard and accepts lowercase input without changing what the user typed.
  @MainActor
  func testEmailSignInUsesAccessibleEmailKeyboard() {
    continueAfterFailure = false

    let app = XCUIApplication()
    app.launchArguments += ["-AppleLanguages", "(en)", "-AppleLocale", "en_US", "--ui-testing"]
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

  /// Proves that account deletion is a deliberate native flow: the account option opens a dedicated screen and the irreversible request still requires confirmation.
  @MainActor
  func testAccountDeletionRequiresConfirmation() {
    continueAfterFailure = false

    let app = XCUIApplication()
    app.launchArguments += [
      "-AppleLanguages", "(en)", "-AppleLocale", "en_US", "--ui-testing",
      "--ui-testing-signed-in",
    ]
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

  /// Proves that every primary destination is reachable through the native tab bar and presents the matching screen title.
  @MainActor
  func testPrimaryTabsNavigateToTheirScreens() {
    continueAfterFailure = false

    let app = XCUIApplication()
    app.launchArguments += ["-AppleLanguages", "(en)", "-AppleLocale", "en_US", "--ui-testing"]
    app.launch()

    let screenTitles = ["Home", "New course", "Courses", "Progress", "Search"]

    for screenTitle in screenTitles {
      let tab = app.buttons[screenTitle].firstMatch
      XCTAssertTrue(tab.waitForExistence(timeout: 5), "Expected the \(screenTitle) tab to exist")
      XCTAssertTrue(tab.isHittable, "Expected the \(screenTitle) tab to be hittable")
      tab.tap()

      let selectedTab = XCTNSPredicateExpectation(
        predicate: NSPredicate(format: "isSelected == true"),
        object: tab)
      XCTAssertEqual(
        XCTWaiter.wait(for: [selectedTab], timeout: 5),
        .completed,
        "Expected the \(screenTitle) tab to become selected")

      XCTAssertTrue(
        app.staticTexts[screenTitle].firstMatch.waitForExistence(timeout: 5),
        "Expected the \(screenTitle) screen title to exist")
    }
  }
}
