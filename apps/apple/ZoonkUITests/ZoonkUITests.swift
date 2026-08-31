import StoreKitTest
import UIKit
import XCTest

private enum UITestScenario: Equatable {
  case appleSubscription
  case freeSubscription
  case googleSubscription
  case catalog
  case progress
  case progressActivityUnauthorized
  case progressDaypartOnly
  case progressEmpty
  case progressOverviewFailure
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
    case .catalog, .progress, .progressActivityUnauthorized, .progressDaypartOnly, .progressEmpty,
      .progressOverviewFailure:
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
    case .progress, .progressActivityUnauthorized, .progressOverviewFailure:
      progressUITestSnapshotJSON
    case .progressDaypartOnly:
      progressDaypartOnlyUITestSnapshotJSON
    case .progressEmpty:
      progressEmptyUITestSnapshotJSON
    case .appleSubscription, .catalog, .freeSubscription, .googleSubscription, .requiredSetup,
      .signedOut:
      nil
    }
  }

  var progressFailure: String? {
    switch self {
    case .progressActivityUnauthorized:
      "activity-unauthorized"
    case .progressOverviewFailure:
      "overview-network"
    case .appleSubscription, .catalog, .freeSubscription, .googleSubscription, .progress,
      .progressDaypartOnly, .progressEmpty, .requiredSetup, .signedOut:
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

  /// Proves the account shortcut names the public destination it opens instead of promising an unimplemented learner library.
  @MainActor
  func testBrowseCoursesAccountActionOpensThePublicCatalog() {
    continueAfterFailure = false

    let app = makeApp(for: .freeSubscription)
    app.launch()
    openAccount(in: app)

    let browseCourses = app.buttons["Browse courses"]
    XCTAssertTrue(
      browseCourses.waitForExistence(timeout: 5),
      "Expected the account sheet to describe the public catalog destination")
    browseCourses.tap()

    XCTAssertTrue(
      app.staticTexts["How Plants Grow"].firstMatch.waitForExistence(timeout: 5),
      "Expected the account shortcut to open the deterministic public catalog")
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

    XCTAssertFalse(app.buttons["Search"].exists, "Expected search to no longer be a primary tab")
  }

  /// Proves the public catalog filters by category and keeps course, chapter, and lesson navigation inside the native Courses stack.
  @MainActor
  func testCourseCatalogNavigatesToLessonPlaceholderAndBack() {
    continueAfterFailure = false

    let app = makeApp(for: .catalog)
    app.launch()

    let coursesTab = app.buttons["Courses"].firstMatch
    XCTAssertTrue(coursesTab.waitForExistence(timeout: 5))
    coursesTab.tap()

    let categorySelector = app.scrollViews["Course categories"]
    XCTAssertTrue(
      categorySelector.waitForExistence(timeout: 5),
      "Expected the catalog to expose its category selector")

    let scienceCategory = app.buttons["Science"]
    categorySelector.scrollToReveal(scienceCategory)

    XCTAssertTrue(
      scienceCategory.waitForExistence(timeout: 2),
      "Expected the App Store-style category selector to expose Science")
    XCTAssertTrue(
      categorySelector.frame.contains(
        CGPoint(x: scienceCategory.frame.midX, y: scienceCategory.frame.midY)),
      "Expected Science to be fully reachable inside the category selector")
    scienceCategory.tap()

    let nonScienceCourse = app.staticTexts["Everyday Numbers"].firstMatch
    let filteredCatalog = XCTNSPredicateExpectation(
      predicate: NSPredicate(format: "exists == false"),
      object: nonScienceCourse)
    XCTAssertEqual(
      XCTWaiter.wait(for: [filteredCatalog], timeout: 5),
      .completed,
      "Expected Science to remove courses from other categories")

    let course = app.staticTexts["How Plants Grow"].firstMatch
    XCTAssertTrue(
      course.waitForExistence(timeout: 5),
      "Expected Science to load its deterministic fixture course")
    course.tap()

    XCTAssertFalse(
      app.staticTexts["Zoonk AI"].exists,
      "Expected course authorship to stay inside progressive disclosure")
    XCTAssertFalse(
      app.staticTexts["Created with AI"].exists,
      "Expected the AI disclosure to stay inside progressive disclosure")

    let courseDescription = app.buttons.matching(
      NSPredicate(format: "label CONTAINS %@", "Discover how roots")
    ).firstMatch
    XCTAssertTrue(
      courseDescription.waitForExistence(timeout: 2),
      "Expected the course description to reveal expanded information")
    courseDescription.tap()

    XCTAssertTrue(
      app.staticTexts["Zoonk AI"].waitForExistence(timeout: 2),
      "Expected the course information popover to identify its author")
    XCTAssertTrue(
      app.staticTexts["Created with AI"].exists,
      "Expected the course information popover to disclose AI authorship")
    XCTAssertFalse(app.staticTexts["Organization"].exists)
    XCTAssertFalse(app.staticTexts["Categories"].exists)
    app.buttons["Done"].tap()

    app.buttons["More options"].tap()
    XCTAssertFalse(
      app.buttons["Course information"].exists,
      "Expected information to be attached to the course description instead of duplicated")
    XCTAssertTrue(
      app.buttons["Send feedback"].waitForExistence(timeout: 2),
      "Expected the course action menu to expose feedback")
    app.tap()

    let courseContinue = app.buttons["Continue, 33% complete"]
    XCTAssertTrue(
      courseContinue.waitForExistence(timeout: 2),
      "Expected the course action to use Main's continuation label and progress")

    if app.frame.width > 600 {
      let courseTitle = app.staticTexts["How Plants Grow"].firstMatch
      XCTAssertEqual(
        courseContinue.frame.minX,
        courseTitle.frame.minX,
        accuracy: 1,
        "Expected the primary course action to align with the hero text on iPad")
    }

    courseContinue.tap()

    XCTAssertTrue(
      app.staticTexts["Lesson player coming soon"].waitForExistence(timeout: 5),
      "Expected the course continuation action to open the next lesson directly")
    app.navigationBars.firstMatch.buttons["How Plants Grow"].tap()

    let chapter = app.buttons.matching(
      NSPredicate(format: "label CONTAINS %@", "Roots and Water")
    ).firstMatch
    XCTAssertTrue(
      chapter.waitForExistence(timeout: 5),
      "Expected the course to expose its first chapter")
    XCTAssertTrue(
      app.staticTexts["1. Roots and Water"].exists,
      "Expected the chapter number to be part of the title instead of a separate leading column")
    XCTAssertTrue(
      chapter.label.contains("1/2 done"),
      "Expected the chapter row to expose learner progress instead of a lesson count")
    XCTAssertFalse(chapter.label.contains("2 lessons"))
    chapter.tap()

    XCTAssertFalse(
      app.staticTexts["Created with AI"].exists,
      "Expected the chapter AI disclosure to stay inside progressive disclosure")

    let chapterDescription = app.buttons.matching(
      NSPredicate(format: "label CONTAINS %@", "See how plants anchor")
    ).firstMatch
    XCTAssertTrue(
      chapterDescription.waitForExistence(timeout: 2),
      "Expected the chapter description to reveal expanded information")
    chapterDescription.tap()

    XCTAssertTrue(
      app.staticTexts["Created with AI"].waitForExistence(timeout: 2),
      "Expected the chapter information popover to disclose AI authorship")
    XCTAssertFalse(app.staticTexts["Organization"].exists)
    XCTAssertFalse(app.staticTexts["Categories"].exists)
    app.buttons["Done"].tap()

    app.buttons["More options"].tap()
    XCTAssertFalse(
      app.buttons["Chapter information"].exists,
      "Expected information to be attached to the chapter description instead of duplicated")
    XCTAssertTrue(
      app.buttons["Send feedback"].waitForExistence(timeout: 2),
      "Expected the chapter action menu to expose feedback")
    app.tap()

    let chapterContinue = app.buttons["Continue, 50% complete"]
    XCTAssertTrue(
      chapterContinue.waitForExistence(timeout: 2),
      "Expected the chapter action to use Main's continuation label and progress")

    if app.frame.width > 600 {
      let chapterTitle = app.staticTexts["1. Roots and Water"].firstMatch
      XCTAssertEqual(
        chapterContinue.frame.minX,
        chapterTitle.frame.minX,
        accuracy: 1,
        "Expected the primary chapter action to align with the hero text on iPad")
    }

    let completedLesson = app.buttons.matching(
      NSPredicate(format: "label CONTAINS %@", "Meet the Roots")
    ).firstMatch
    XCTAssertTrue(
      app.staticTexts["1. Meet the Roots"].exists,
      "Expected the lesson number to be part of the title instead of a separate leading column")
    XCTAssertTrue(completedLesson.label.contains("Completed"))
    XCTAssertEqual(
      completedLesson.value as? String,
      "Explanation",
      "Expected VoiceOver to identify the lesson kind independently from its title")

    let nextLesson = app.buttons.matching(
      NSPredicate(format: "label CONTAINS %@", "Follow the Water")
    ).firstMatch
    XCTAssertTrue(nextLesson.label.contains("Not started"))
    XCTAssertEqual(
      nextLesson.value as? String,
      "Practice",
      "Expected VoiceOver to identify the lesson kind independently from its title")
    chapterContinue.tap()

    XCTAssertTrue(
      app.staticTexts["Lesson player coming soon"].waitForExistence(timeout: 5),
      "Expected the chapter continuation action to open the next lesson directly")
    XCTAssertTrue(app.navigationBars["Follow the Water"].exists)

    let chapterBackButton = app.navigationBars.firstMatch.buttons["Roots and Water"]
    XCTAssertTrue(
      chapterBackButton.waitForExistence(timeout: 5),
      "Expected the lesson placeholder to retain the native chapter back action")
    chapterBackButton.tap()

    XCTAssertTrue(
      app.staticTexts["2. Follow the Water"].waitForExistence(timeout: 5),
      "Expected Back to return to the chapter's lesson list")
  }

  /// Proves catalog search replaces the removed Search tab and searches beyond the selected category.
  @MainActor
  func testCoursesSearchFindsCoursesAndChapters() {
    continueAfterFailure = false

    let app = makeApp(for: .catalog)
    app.launch()
    app.buttons["Courses"].firstMatch.tap()

    let searchField = app.searchFields["Search courses and chapters"]
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
      app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "1. Roots and Water"))
        .firstMatch.waitForExistence(timeout: 10),
      "Expected a chapter search result to load its canonical position and metadata")
  }

  /// Proves an empty category turns unmet demand into the existing course-creation flow.
  @MainActor
  func testEmptyCategoryOffersCourseCreation() {
    continueAfterFailure = false

    let app = makeApp(for: .catalog)
    app.launch()
    app.buttons["Courses"].firstMatch.tap()

    XCTAssertTrue(
      app.staticTexts["How Plants Grow"].firstMatch.waitForExistence(timeout: 10),
      "Expected the catalog to finish loading before changing categories")

    let categorySelector = app.scrollViews["Course categories"]
    XCTAssertTrue(categorySelector.waitForExistence(timeout: 5))

    let technologyCategory = app.buttons["Technology"]
    categorySelector.scrollToReveal(technologyCategory)
    XCTAssertTrue(
      categorySelector.frame.contains(
        CGPoint(x: technologyCategory.frame.midX, y: technologyCategory.frame.midY)),
      "Expected the far-right Technology category to be reachable")
    technologyCategory.tap()

    XCTAssertTrue(
      app.staticTexts["No Technology courses yet"].waitForExistence(timeout: 5),
      "Expected the empty category to offer recovery")
    app.buttons["Create a course about Technology"].tap()

    XCTAssertTrue(
      app.navigationBars["New course"].waitForExistence(timeout: 5),
      "Expected the empty category action to open the existing New course screen")
    XCTAssertTrue(
      app.buttons["New"].firstMatch.isSelected,
      "Expected New to become the selected primary tab")
  }

  /// Proves searching chapters replaces the detail header so filtered content remains visible while the keyboard is open.
  @MainActor
  func testCourseSearchKeepsFilteredChaptersVisible() {
    continueAfterFailure = false

    let app = makeApp(for: .catalog)
    app.launch()
    openPlantsCourse(in: app)

    XCTAssertFalse(app.searchFields["Search chapters"].exists)
    app.buttons["Search"].tap()
    let searchField = app.searchFields["Search chapters"]
    XCTAssertTrue(searchField.waitForExistence(timeout: 5))
    searchField.tap()
    searchField.typeText("leaves")

    let courseContinue = app.buttons.matching(
      NSPredicate(format: "label BEGINSWITH %@", "Continue")
    ).firstMatch
    let hiddenCourseHeader = XCTNSPredicateExpectation(
      predicate: NSPredicate(format: "exists == false"),
      object: courseContinue)
    XCTAssertEqual(
      XCTWaiter.wait(for: [hiddenCourseHeader], timeout: 5),
      .completed,
      "Expected active search to remove the detail header between search and results")
    XCTAssertTrue(
      app.staticTexts["2. Leaves and Light"].waitForExistence(timeout: 5),
      "Expected the matching chapter to remain visible above the keyboard")
    XCTAssertTrue(
      app.staticTexts["2. Leaves and Light"].isHittable,
      "Expected the filtered chapter to remain directly interactive during search")
    XCTAssertFalse(app.staticTexts["1. Roots and Water"].exists)
  }

  /// Proves lesson filtering uses the same compact search hierarchy as chapter filtering.
  @MainActor
  func testChapterSearchKeepsFilteredLessonsVisible() {
    continueAfterFailure = false

    let app = makeApp(for: .catalog)
    app.launch()
    openPlantsCourse(in: app)
    app.staticTexts["1. Roots and Water"].firstMatch.tap()

    XCTAssertFalse(app.searchFields["Search lessons"].exists)
    app.buttons["Search"].tap()
    let searchField = app.searchFields["Search lessons"]
    XCTAssertTrue(searchField.waitForExistence(timeout: 5))
    searchField.tap()
    searchField.typeText("water")

    let chapterContinue = app.buttons.matching(
      NSPredicate(format: "label BEGINSWITH %@", "Continue")
    ).firstMatch
    let hiddenChapterHeader = XCTNSPredicateExpectation(
      predicate: NSPredicate(format: "exists == false"),
      object: chapterContinue)
    XCTAssertEqual(
      XCTWaiter.wait(for: [hiddenChapterHeader], timeout: 5),
      .completed,
      "Expected active search to remove the detail header between search and results")
    XCTAssertTrue(
      app.staticTexts["2. Follow the Water"].waitForExistence(timeout: 5),
      "Expected the matching lesson to remain visible above the keyboard")
    XCTAssertTrue(
      app.staticTexts["2. Follow the Water"].isHittable,
      "Expected the filtered lesson to remain directly interactive during search")
    XCTAssertFalse(app.staticTexts["1. Meet the Roots"].exists)
  }

  @MainActor
  func testProgressSignInActionPresentsTheAccountSheet() {
    continueAfterFailure = false

    let app = makeApp()
    app.launch()
    app.buttons["Progress"].firstMatch.tap()
    app.buttons["Sign in"].tap()

    XCTAssertTrue(
      app.buttons["Continue with Apple"].waitForExistence(timeout: 5),
      "Expected Progress sign-in to present the account sheet")
  }

  @MainActor
  func testProgressOverviewPresentsAnAvailableDaypartWithoutAWeekday() {
    continueAfterFailure = false

    let app = makeApp(for: .progressDaypartOnly)
    app.launch()
    app.buttons["Progress"].firstMatch.tap()

    XCTAssertTrue(
      app.staticTexts["Morning"].waitForExistence(timeout: 5),
      "Expected the overview to preserve an available strongest time")
    XCTAssertFalse(
      app.staticTexts["Keep answering to discover your strongest learning patterns."].exists,
      "Expected valid daypart data to avoid the missing-pattern state")
  }

  @MainActor
  func testProgressOverviewPresentsEmptyAndFailureRecoveryStates() {
    continueAfterFailure = false

    let emptyApp = makeApp(for: .progressEmpty)
    emptyApp.launch()
    emptyApp.buttons["Progress"].firstMatch.tap()
    XCTAssertTrue(
      emptyApp.staticTexts["Your progress starts here"].waitForExistence(timeout: 5),
      "Expected an empty learner to receive progress guidance")
    emptyApp.terminate()

    let failedApp = makeApp(for: .progressOverviewFailure)
    failedApp.launch()
    failedApp.buttons["Progress"].firstMatch.tap()
    XCTAssertTrue(
      failedApp.staticTexts["You're offline"].waitForExistence(timeout: 5),
      "Expected a network failure to show a recoverable state")
    XCTAssertTrue(failedApp.buttons["Try again"].exists, "Expected an explicit retry action")
  }

  @MainActor
  func testProgressAuthenticationLossReturnsToSignInRecovery() {
    continueAfterFailure = false

    let app = makeApp(for: .progressActivityUnauthorized)
    app.launch()
    app.buttons["Progress"].firstMatch.tap()
    XCTAssertTrue(app.staticTexts["At a glance"].waitForExistence(timeout: 5))
    app.staticTexts["Activity"].firstMatch.tap()

    XCTAssertTrue(
      app.staticTexts["Sign in to see your progress"].waitForExistence(timeout: 5),
      "Expected authentication loss to leave the loading detail and return to recovery")
  }

  @MainActor
  func testProgressDetailTitleAdaptsToTheDevice() {
    continueAfterFailure = false

    let app = makeApp(for: .progress)
    app.launch()
    app.buttons["Progress"].firstMatch.tap()
    XCTAssertTrue(app.staticTexts["At a glance"].waitForExistence(timeout: 5))
    app.staticTexts["Level"].firstMatch.tap()
    XCTAssertTrue(app.staticTexts["Belt journey"].waitForExistence(timeout: 5))

    let title = app.navigationBars.firstMatch.staticTexts["Level"]

    if UIDevice.current.userInterfaceIdiom == .pad {
      XCTAssertFalse(title.exists, "Expected iPad to omit the centered detail title")
    } else {
      XCTAssertTrue(title.exists, "Expected iPhone to keep the title aligned with its back action")
    }
  }

  /// Proves that the native Progress summary exposes every metric and pushes details within the existing tab's navigation stack.
  @MainActor
  func testProgressOverviewNavigatesToEveryMetric() {
    continueAfterFailure = false

    let app = makeApp(for: .progress)
    app.launch()

    app.buttons["Progress"].firstMatch.tap()
    XCTAssertTrue(
      app.staticTexts["At a glance"].waitForExistence(timeout: 5),
      "Expected the loaded Progress summary to appear")

    let destinations = [
      (title: "Activity", loadedContent: "Learning activity"),
      (title: "Score", loadedContent: "Weekly trend"),
      (title: "Patterns", loadedContent: "Weekly rhythm"),
      (title: "Level", loadedContent: "Belt journey"),
      (title: "Energy", loadedContent: "Energy history"),
    ]

    for destination in destinations {
      let destinationTitle = app.staticTexts[destination.title].firstMatch
      XCTAssertTrue(
        destinationTitle.waitForExistence(timeout: 5),
        "Expected the Progress summary to include \(destination.title)")
      destinationTitle.tap()

      XCTAssertTrue(
        app.navigationBars.firstMatch.waitForExistence(timeout: 5),
        "Expected \(destination.title) to open in the native navigation stack")
      XCTAssertTrue(
        app.staticTexts[destination.loadedContent].waitForExistence(timeout: 5),
        "Expected \(destination.title) to finish loading its fixture content")
      let backButton = app.navigationBars.firstMatch.buttons["Progress"]
      XCTAssertTrue(
        backButton.exists,
        "Expected \(destination.title) to retain the native Progress back action")
      backButton.tap()
    }
  }

  /// Proves contribution days expose their exact date and value through the same tap interaction on both progress calendars.
  @MainActor
  func testProgressContributionCalendarsRevealSelectedDayDetails() {
    continueAfterFailure = false

    assertContributionDetails(
      destination: "Activity",
      date: "August 20, 2026",
      details: "Lessons completed: 9")
    assertContributionDetails(
      destination: "Energy",
      date: "August 20, 2026",
      details: "Energy: 82%")
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

    if let progressFailure = scenario.progressFailure {
      app.launchEnvironment["ZOONK_UI_TEST_PROGRESS_FAILURE"] = progressFailure
    }

    return app
  }

  @MainActor
  private func assertContributionDetails(destination: String, date: String, details: String) {
    let app = makeApp(for: .progress)
    app.launch()

    app.buttons["Progress"].firstMatch.tap()
    XCTAssertTrue(
      app.staticTexts["At a glance"].waitForExistence(timeout: 5),
      "Expected the loaded Progress summary to appear")
    app.staticTexts[destination].firstMatch.tap()

    let contributionDay = app.buttons[date]
    XCTAssertTrue(
      contributionDay.waitForExistence(timeout: 5),
      "Expected the \(destination) calendar to expose \(date) as an interactive day")
    contributionDay.tap()

    XCTAssertTrue(
      app.staticTexts[details].waitForExistence(timeout: 5),
      "Expected the selected \(destination) day to reveal its exact value")

    app.terminate()
  }

  @MainActor
  private func openPlantsCourse(in app: XCUIApplication) {
    let coursesTab = app.buttons["Courses"].firstMatch
    XCTAssertTrue(coursesTab.waitForExistence(timeout: 5))
    coursesTab.tap()

    let course = app.staticTexts["How Plants Grow"].firstMatch
    XCTAssertTrue(course.waitForExistence(timeout: 10))
    course.tap()
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
