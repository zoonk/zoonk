import StoreKitTest
import UIKit
import XCTest

private enum UITestScenario: Equatable {
  case appleSubscription
  case freeSubscription
  case googleSubscription
  case catalog
  case progress
  case progressActivityFailure
  case progressActivityUnauthorized
  case progressEmpty
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
    case .catalog, .progress, .progressActivityFailure, .progressActivityUnauthorized,
      .progressEmpty:
      accountJSON(provider: nil)
    case .signedOut:
      nil
    }
  }

  var launchArguments: [String] {
    ["-AppleLanguages", "(en)", "-AppleLocale", "en_US", "--ui-testing"]
      + (self == .requiredSetup ? ["--ui-testing-account-sheet"] : [])
  }

  var progressJSON: String? {
    switch self {
    case .progress, .progressActivityFailure, .progressActivityUnauthorized:
      progressUITestSnapshotJSON
    case .progressEmpty:
      progressEmptyUITestSnapshotJSON
    case .appleSubscription, .catalog, .freeSubscription, .googleSubscription, .requiredSetup,
      .signedOut:
      nil
    }
  }

  var progressFailure: String? {
    switch self {
    case .progressActivityFailure:
      "activity-network"
    case .progressActivityUnauthorized:
      "activity-unauthorized"
    case .appleSubscription, .catalog, .freeSubscription, .googleSubscription, .progress,
      .progressEmpty, .requiredSetup, .signedOut:
      nil
    }
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

    let accountButton = app.navigationBars.buttons["Log in"].firstMatch
    XCTAssertTrue(
      accountButton.waitForExistence(timeout: 5), "Expected the account button to exist")
    accountButton.tap()

    for method in ["Continue with Apple", "Continue with Google", "Continue with email"] {
      XCTAssertTrue(
        app.buttons[method].waitForExistence(timeout: 5),
        "Expected the login screen to offer \(method)")
    }

    XCTAssertFalse(
      app.navigationBars["Account"].exists,
      "Expected the sign-in sheet to avoid a redundant Account title")
  }

  @MainActor
  func testPrimaryScreenShowsTitleAndLogIn() {
    continueAfterFailure = false

    let app = makeApp()
    app.launch()

    let navigationBar = app.navigationBars["Today"]
    let logInButton = navigationBar.buttons["Log in"]

    XCTAssertTrue(
      navigationBar.waitForExistence(timeout: 5), "Expected the native screen title to exist")
    XCTAssertTrue(logInButton.exists, "Expected a visitor's Log in button to exist")
  }

  @MainActor
  func testSignInMethodsUseConsistentGeometry() {
    continueAfterFailure = false

    let app = makeApp()
    app.launch()
    app.navigationBars.buttons["Log in"].firstMatch.tap()

    let appleButton = app.buttons["Continue with Apple"]
    let googleButton = app.buttons["Continue with Google"]
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

    let accountButton = app.navigationBars.buttons["Log in"].firstMatch
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
      app.staticTexts["Subscribe to Zoonk Plus"].waitForExistence(timeout: 5),
      "Expected the subscription screen to use main's Plus offer")
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

    // As on main, deletion lives on the profile, which the account's own row opens.
    let profile = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "@")).firstMatch
    XCTAssertTrue(
      profile.waitForExistence(timeout: 5), "Expected the settings hub to open the profile")
    profile.tap()

    let deleteAccountButton = app.buttons["Delete my account"]
    XCTAssertTrue(
      deleteAccountButton.waitForExistence(timeout: 5),
      "Expected the profile to offer account deletion")
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

    let signOutButton = app.buttons["Log out"]
    XCTAssertTrue(
      signOutButton.waitForExistence(timeout: 5),
      "Expected the settings hub to offer Log out")
    signOutButton.tap()

    XCTAssertTrue(
      app.staticTexts["Zoonk couldn't connect. Check your connection and try again."]
        .waitForExistence(timeout: 5),
      "Expected tapping sign out to start the API request immediately")
  }

  /// Proves every tab root renders, that Statistics opens from the level button, and that a top
  /// tab bar's Study item opens the Study places, in both orientations.
  @MainActor
  func testShellTabsAndStudyPlacesRender() {
    continueAfterFailure = false

    let app = makeApp(for: .progress)
    app.launch()

    let tabs = [
      (tabTitle: "Today", screenTitle: "Today"),
      (tabTitle: "Plan", screenTitle: "Plan"),
      (tabTitle: "Zu", screenTitle: "Zu"),
      (tabTitle: "Search", screenTitle: "Search"),
    ]

    addTeardownBlock { @MainActor in XCUIDevice.shared.orientation = .portrait }

    for orientation in [UIDeviceOrientation.portrait, .landscapeLeft] {
      XCUIDevice.shared.orientation = orientation

      for destination in tabs {
        let tab = app.primaryNavigationItem(destination.tabTitle)
        XCTAssertTrue(
          tab.waitForExistence(timeout: 5), "Expected the \(destination.tabTitle) tab to exist")
        tab.tap()

        XCTAssertTrue(
          app.navigationBars[destination.screenTitle].firstMatch.waitForExistence(timeout: 5),
          "Expected the \(destination.screenTitle) screen to render")
      }

      // A top tab bar (iPad) shows the Study places as one item opening the first of them.
      let study = app.buttons["Study"].firstMatch
      if study.exists {
        study.tap()
        XCTAssertTrue(
          app.navigationBars["Mistakes notebook"].firstMatch.waitForExistence(timeout: 5),
          "Expected Study to open the mistakes notebook")
      }

      app.primaryNavigationItem("Today").tap()
      openStatistics(in: app)
      XCTAssertTrue(
        app.navigationBars["Statistics"].waitForExistence(timeout: 5),
        "Expected the level button to push Statistics")
      app.navigationBars.buttons.firstMatch.tap()
    }
  }

  /// Proves the catalog lists only the categories that have courses, filters by one, and leads to
  /// a course's landing page and a chapter's page with their ways in.
  @MainActor
  func testCourseCatalogOpensCoursesAndChaptersWithTheirWayIn() {
    continueAfterFailure = false

    let app = makeApp(for: .catalog)
    app.launch()

    openCatalog(in: app)

    XCTAssertTrue(
      app.buttons["Build my plan"].waitForExistence(timeout: 5),
      "Expected the catalog's goal box for goals no course covers")

    let categorySelector = app.scrollViews["Course categories"]
    XCTAssertTrue(
      categorySelector.waitForExistence(timeout: 5),
      "Expected the catalog to expose its category selector")

    let scienceCategory = app.buttons["Science"]
    categorySelector.scrollToReveal(scienceCategory)
    XCTAssertTrue(scienceCategory.waitForExistence(timeout: 2))
    XCTAssertTrue(app.buttons["Math"].exists)
    XCTAssertFalse(
      app.buttons["Technology"].exists,
      "Expected a category without courses to stay out of the catalog")
    scienceCategory.tap()

    XCTAssertTrue(
      app.staticTexts["Courses in Science"].waitForExistence(timeout: 5),
      "Expected the catalog's title to name the chosen category")

    let nonScienceCourse = app.staticTexts["Everyday Numbers"].firstMatch
    let filteredCatalog = XCTNSPredicateExpectation(
      predicate: NSPredicate(format: "exists == false"),
      object: nonScienceCourse)
    XCTAssertEqual(
      XCTWaiter.wait(for: [filteredCatalog], timeout: 5),
      .completed,
      "Expected Science to remove courses from other categories")

    XCTAssertTrue(
      app.staticTexts["3 lessons · 18 min"].waitForExistence(timeout: 5),
      "Expected a course to state its lessons and their time")

    let course = app.staticTexts["How Plants Grow"].firstMatch
    XCTAssertTrue(course.waitForExistence(timeout: 5))
    course.tap()

    XCTAssertTrue(
      app.staticTexts["Grow a plant from root to leaf."].waitForExistence(timeout: 5),
      "Expected the course page to lead with its promise")
    XCTAssertTrue(app.buttons["Build my plan"].exists, "Expected the course's way in")
    XCTAssertTrue(
      app.buttons["Try a lesson"].exists,
      "Expected the course to offer its first written lesson to try")

    app.buttons["Course options"].tap()
    XCTAssertTrue(
      app.buttons["Send feedback"].waitForExistence(timeout: 2),
      "Expected the course's options to offer feedback")
    app.tap()

    app.swipeUp()
    XCTAssertTrue(
      app.staticTexts["Explain how water reaches a leaf"].waitForExistence(timeout: 5),
      "Expected the course page to say what it makes someone able to do")

    let chapter = app.buttons.matching(
      NSPredicate(format: "label CONTAINS %@", "Roots and Water")
    ).firstMatch
    if !chapter.exists {
      app.swipeUp()
    }
    XCTAssertTrue(
      chapter.waitForExistence(timeout: 5),
      "Expected the outline's first level to be open with its chapters")
    XCTAssertTrue(
      app.staticTexts["Beginner"].exists && app.staticTexts["Intermediate"].exists,
      "Expected the outline to group chapters by level")
    chapter.tap()

    XCTAssertTrue(
      app.staticTexts["Where this chapter sits in the course"].waitForExistence(timeout: 5),
      "Expected the chapter page to place the chapter in its course")
    XCTAssertTrue(app.staticTexts["Chapter 1 of 2 · Beginner"].exists)
    XCTAssertTrue(app.buttons["Build my plan"].exists, "Expected the chapter's way in")

    app.swipeUp()
    XCTAssertTrue(
      app.staticTexts["Follow the Water"].waitForExistence(timeout: 5),
      "Expected the chapter to list its lessons")
    XCTAssertTrue(
      app.staticTexts["Explain how roots hold a plant in place"].exists,
      "Expected the chapter to say what it teaches")
  }

  /// Editing a search moves between matching and empty results without retaining the previous query's feedback.
  @MainActor
  func testCatalogSearchUpdatesWhenTheQueryChanges() {
    continueAfterFailure = false

    let app = makeApp(for: .catalog)
    app.launch()
    openCatalog(in: app)
    let searchField = app.searchFields["Search all courses"]
    XCTAssertTrue(searchField.waitForExistence(timeout: 5))
    searchField.tap()
    searchField.typeText("water")
    XCTAssertTrue(app.staticTexts["Roots and Water"].waitForExistence(timeout: 5))

    let suffix = "zznomatch"
    searchField.typeText(suffix)
    let emptyDescription = app.staticTexts.matching(
      NSPredicate(format: "label CONTAINS %@", "water" + suffix)
    ).firstMatch
    XCTAssertTrue(emptyDescription.waitForExistence(timeout: 5))
    XCTAssertFalse(app.staticTexts["Roots and Water"].exists)

    searchField.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: suffix.count))
    XCTAssertTrue(app.staticTexts["Roots and Water"].waitForExistence(timeout: 5))
    XCTAssertFalse(emptyDescription.exists)
    XCTAssertEqual(searchField.value as? String, "water")

    let screenshot = XCTAttachment(screenshot: app.screenshot())
    screenshot.lifetime = .keepAlways
    add(screenshot)
  }

  /// Proves catalog search searches beyond the selected category and opens a chapter in its course.
  @MainActor
  func testCoursesSearchFindsCoursesAndChapters() {
    continueAfterFailure = false

    let app = makeApp(for: .catalog)
    app.launch()
    openCatalog(in: app)

    let searchField = app.searchFields["Search all courses"]
    XCTAssertTrue(searchField.waitForExistence(timeout: 5))
    searchField.tap()
    searchField.typeText("water")

    XCTAssertFalse(
      app.scrollViews["Course categories"].exists,
      "Expected active catalog search to put results directly below the search field")
    XCTAssertTrue(
      app.staticTexts["Chapters"].waitForExistence(timeout: 5),
      "Expected catalog search to group chapter matches")
    XCTAssertTrue(app.staticTexts["Roots and Water"].exists)
    XCTAssertTrue(app.staticTexts["How Plants Grow"].exists)

    app.staticTexts["Roots and Water"].firstMatch.tap()
    XCTAssertTrue(
      app.staticTexts["Chapter 1 of 2 · Beginner"].waitForExistence(timeout: 10),
      "Expected a chapter search result to read its course and its place there")
  }

  @MainActor
  func testStatisticsPresentsEmptyAndFailureRecoveryStates() {
    continueAfterFailure = false

    let emptyApp = makeApp(for: .progressEmpty)
    emptyApp.launch()
    openStatistics(in: emptyApp)
    XCTAssertTrue(
      emptyApp.staticTexts["Start learning to track your progress"].waitForExistence(timeout: 5),
      "Expected a learner without study to be asked to start")
    XCTAssertTrue(emptyApp.buttons["Go to Today"].exists, "Expected the way to Today")
    emptyApp.terminate()

    let failedApp = makeApp(for: .progressActivityFailure)
    failedApp.launch()
    openStatistics(in: failedApp)
    XCTAssertTrue(
      failedApp.staticTexts["You're offline"].waitForExistence(timeout: 5),
      "Expected a network failure to show a recoverable state")
    XCTAssertTrue(failedApp.buttons["Try again"].exists, "Expected an explicit retry action")
  }

  @MainActor
  func testStatisticsAuthenticationLossAsksToLogIn() {
    continueAfterFailure = false

    let app = makeApp(for: .progressActivityUnauthorized)
    app.launch()
    openStatistics(in: app)

    XCTAssertTrue(
      app.buttons["Log in"].firstMatch.waitForExistence(timeout: 5),
      "Expected authentication loss to sign the learner out, with the way to log in again")
  }

  /// Every stat opens from its tile: a pushed page on a phone, the section's tab on an iPad.
  @MainActor
  func testStatisticsOpensEveryStat() {
    continueAfterFailure = false

    let app = makeApp(for: .progress)
    app.launch()
    openStatistics(in: app)
    XCTAssertTrue(
      statTile("Study days", in: app).waitForExistence(timeout: 5),
      "Expected the overview's tiles to appear")

    let isPad = UIDevice.current.userInterfaceIdiom == .pad
    let stats = [
      (tile: "Level", title: "Level", content: "Belt progression"),
      (tile: "Energy", title: "Energy", content: "Days with full Energy"),
      (tile: "Study days", title: "Activity", content: "Any day you studied"),
      (tile: "Score", title: "Score", content: "Of all your answers"),
      (tile: "Patterns", title: "Patterns", content: "Throughout the week"),
    ]

    for stat in stats {
      // A wide screen shows the patterns beside Score's trend, opened from "See all".
      let tile =
        isPad && stat.tile == "Patterns" ? app.buttons["See all"] : statTile(stat.tile, in: app)
      XCTAssertTrue(
        tile.waitForExistence(timeout: 5), "Expected the overview to open \(stat.title)")
      tile.tap()
      XCTAssertTrue(
        app.staticTexts[stat.content].waitForExistence(timeout: 5),
        "Expected \(stat.title) to show its numbers")

      if isPad {
        XCTAssertTrue(
          app.buttons[stat.title].isSelected, "Expected \(stat.title)'s tab to be selected")
        app.buttons["Overview"].tap()
      } else {
        XCTAssertTrue(app.navigationBars[stat.title].exists, "Expected \(stat.title) to be pushed")
        app.navigationBars.buttons["Statistics"].firstMatch.tap()
      }
    }
  }

  /// The year of study is one control: its readout starts on the newest day studied and follows a tap.
  @MainActor
  func testStatisticsCalendarReadsOutTheDayPicked() {
    continueAfterFailure = false

    let app = makeApp(for: .progress)
    app.launch()
    openStatistics(in: app)

    let calendar = app.descendants(matching: .any)["Activity by day"]
    XCTAssertTrue(calendar.waitForExistence(timeout: 5), "Expected the overview's calendar")
    XCTAssertEqual(calendar.value as? String, "Aug 20 · 9 activities")

    // The year scrolls from its newest edge, so tap a day near that edge, a few days earlier.
    calendar.coordinate(withNormalizedOffset: CGVector(dx: 0.97, dy: 0.4)).tap()
    XCTAssertNotEqual(
      calendar.value as? String, "Aug 20 · 9 activities", "Expected a tap to pick another day")
  }

  /// A tile is one button named by its stat, its number and line as its value ("Level": "4, Green
  /// belt"); the phone's Patterns row names its best day and time too ("Patterns, Morning").
  @MainActor
  private func statTile(_ name: String, in app: XCUIApplication) -> XCUIElement {
    app.buttons.matching(
      NSPredicate(format: "label == %@ OR label BEGINSWITH %@", name, "\(name),")
    ).firstMatch
  }

  /// Creates one isolated app process from scenario data owned by the UI-test target rather than the distributable app.
  @MainActor
  private func makeApp(for scenario: UITestScenario = .signedOut) -> XCUIApplication {
    let app = XCUIApplication()
    app.launchArguments += scenario.launchArguments
    app.launchEnvironment["ZOONK_UI_TEST_CATALOG"] = courseCatalogUITestSnapshotJSON

    if let accountJSON = scenario.accountJSON {
      app.launchEnvironment["ZOONK_UI_TEST_ACCOUNT"] = accountJSON
    }

    if let progressJSON = scenario.progressJSON {
      app.launchEnvironment["ZOONK_UI_TEST_PROGRESS"] = progressJSON
    }

    if scenario.accountJSON != nil {
      app.launchEnvironment["ZOONK_UI_TEST_SUMMARY"] = learnerSummaryUITestJSON
      app.launchEnvironment["ZOONK_UI_TEST_BUDDY"] = buddyStatusUITestJSON
    }

    if let progressFailure = scenario.progressFailure {
      app.launchEnvironment["ZOONK_UI_TEST_PROGRESS_FAILURE"] = progressFailure
    }

    return app
  }

  /// Opens the catalog the way a learner does, from the goal switcher's "Explore courses".
  @MainActor
  private func openCatalog(in app: XCUIApplication) {
    let goalSwitcher = app.buttons[uiTestGoalTitle].firstMatch
    XCTAssertTrue(
      goalSwitcher.waitForExistence(timeout: 5), "Expected the goal switcher to exist")
    goalSwitcher.tap()
    app.buttons["Explore courses"].tap()
  }

  /// Opens Statistics from the level button on the tab root's toolbar.
  @MainActor
  private func openStatistics(in app: XCUIApplication) {
    let levelButton = app.buttons.matching(
      NSPredicate(format: "label ENDSWITH %@", "Statistics")
    ).firstMatch
    XCTAssertTrue(levelButton.waitForExistence(timeout: 5), "Expected the level button to exist")
    levelButton.tap()
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

extension XCUIApplication {
  @MainActor
  fileprivate func primaryNavigationItem(_ title: String) -> XCUIElement {
    let sidebarItem = collectionViews.cells.matching(NSPredicate(format: "label == %@", title))
      .firstMatch
    return sidebarItem.exists ? sidebarItem : buttons[title].firstMatch
  }
}

extension XCUIElement {
  @MainActor
  fileprivate func scrollToReveal(_ element: XCUIElement) {
    for _ in 0..<8 {
      if element.exists,
        frame.contains(CGPoint(x: element.frame.midX, y: element.frame.midY))
      {
        return
      }

      swipeLeft(velocity: .fast)
    }
  }
}
