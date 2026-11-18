import StoreKitTest
import UIKit
import Vision
import XCTest

private enum UITestScenario {
  case freeSubscription
  case progress
  case progressActivityUnauthorized

  var progressJSON: String? {
    switch self {
    case .progress, .progressActivityUnauthorized:
      progressUITestSnapshotJSON
    case .freeSubscription:
      nil
    }
  }

  var progressFailure: String? {
    switch self {
    case .progressActivityUnauthorized:
      "activity-unauthorized"
    case .freeSubscription, .progress:
      nil
    }
  }
}

private let uiTestAccountJSON = """
  {
    "account": {
      "deletion": { "hasAppleAccount": false },
      "subscription": null
    },
    "user": {
      "email": "ui-test@zoonk.test",
      "id": "7846d3f5-b9c4-4ded-b283-35f70a48af86",
      "image": null,
      "name": "UI Test User",
      "username": "ui_test_user"
    }
  }
  """

final class ZoonkUITests: XCTestCase {
  private var storeKitSession: SKTestSession?

  override func tearDown() {
    storeKitSession?.clearTransactions()
    storeKitSession?.resetToDefaultState()
    storeKitSession = nil
    super.tearDown()
  }

  @MainActor
  func testCertificatesTitleStaysOutOfBarAfterLoadingEmptyList() throws {
    try checkCertificatesTitle(json: "[]", loadedText: "No certificates yet")
  }

  @MainActor
  func testCertificatesTitleStaysOutOfBarAfterLoadingCertificate() throws {
    try checkCertificatesTitle(
      json: """
        [{"code":"APCERT000001","kind":"course","recipientName":"UI Test User",
          "completedOn":"2026-11-03","title":"Quantum physics from scratch",
          "topics":[],"canDo":[],"locked":true}]
        """, loadedText: "Quantum physics from scratch")
  }

  @MainActor
  private func checkCertificatesTitle(json: String, loadedText: String) throws {
    continueAfterFailure = false
    let app = makeApp(for: .freeSubscription)
    app.launchEnvironment["ZOONK_UI_TEST_CERTIFICATES"] = json
    addTeardownBlock { app.terminate() }
    launch(app)
    openAccount(in: app)
    let certificates = app.buttons["Certificates"].firstMatch
    XCTAssertTrue(certificates.waitForExistence(timeout: 5))
    certificates.tap()
    XCTAssertTrue(app.staticTexts[loadedText].firstMatch.waitForExistence(timeout: 5))
    let header = app.staticTexts["Certificates"].firstMatch
    XCTAssertTrue(header.exists)
    let screenshot = app.screenshot()
    let evidence = XCTAttachment(screenshot: screenshot)
    evidence.lifetime = .keepAlways
    add(evidence)
    let barImage = try XCTUnwrap(screenshot.image.cgImage)
    let recognition = VNRecognizeTextRequest()
    recognition.recognitionLevel = .accurate
    recognition.recognitionLanguages = ["en-US"]
    try VNImageRequestHandler(cgImage: barImage).perform([recognition])
    let barWords = recognition.results?.compactMap { $0.topCandidates(1).first?.string } ?? []
    XCTAssertEqual(
      barWords.filter { $0 == "Certificates" }.count, 1,
      "The visible page header must be the only Certificates title after loading: \(barWords)")
  }

  @MainActor
  func testGoalNameRemainsVisibleAtAccessibilitySizes() throws {
    for category in [
      "UICTContentSizeCategoryAccessibilityL", "UICTContentSizeCategoryAccessibilityXXXL",
    ] {
      let app = makeApp(for: .freeSubscription)
      app.launchArguments += [
        "-UIPreferredContentSizeCategoryName", category,
      ]
      addTeardownBlock { app.terminate() }
      launch(app)
      XCTAssertTrue(app.buttons["Plant growth"].firstMatch.waitForExistence(timeout: 10))
      let screenshot = app.screenshot()
      let attachment = XCTAttachment(screenshot: screenshot)
      attachment.lifetime = .keepAlways
      add(attachment)
      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .accurate
      request.recognitionLanguages = ["en-US"]
      request.regionOfInterest = CGRect(x: 0, y: 0.72, width: 1, height: 0.28)
      try VNImageRequestHandler(cgImage: XCTUnwrap(screenshot.image.cgImage)).perform([request])
      let words = request.results?.compactMap { $0.topCandidates(1).first?.string } ?? []
      XCTAssertTrue(
        words.contains { $0.contains("Plant") }, "The goal name must have visible text: \(words)")
      openLevel(in: app)
      XCTAssertTrue(
        app.navigationBars["Level"].firstMatch.waitForExistence(timeout: 5), app.debugDescription)
      app.terminate()
    }
  }

  @MainActor
  func testFreeAccountOpensNativeSubscriptionStore() throws {
    continueAfterFailure = false
    storeKitSession = try makeStoreKitSession()

    let app = makeApp(for: .freeSubscription)
    addTeardownBlock {
      app.terminate()
    }
    launch(app)
    openAccount(in: app)

    let subscription = app.buttons["Subscription"]
    XCTAssertTrue(subscription.waitForExistence(timeout: 5))
    subscription.tap()

    XCTAssertTrue(
      app.staticTexts["Subscription"].firstMatch.waitForExistence(timeout: 5),
      "Expected the free account to reach the native subscription screen")
    XCTAssertTrue(
      app.staticTexts["Plus"].firstMatch.waitForExistence(timeout: 5),
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

  @MainActor
  func testTabsAndStatisticsPassTheAccessibilityAudit() throws {
    continueAfterFailure = false

    let app = makeApp(for: .progress)
    launch(app)

    // Today and Plan have no fixtures, so they show the system's `ContentUnavailableView` for being
    // offline, whose title, message and button the audit finds don't follow Dynamic Type all the way.
    let offline = ["Check your connection and try again.", "Try again"]
    for destination in [
      (tabTitle: "Today", screenTitle: "Today", sizedBySystem: ["Today didn't load"] + offline),
      (tabTitle: "Plan", screenTitle: "Plan", sizedBySystem: ["Couldn't load your plan"] + offline),
      (tabTitle: "Zu", screenTitle: "Zu", sizedBySystem: []),
      (tabTitle: "Search", screenTitle: "Search", sizedBySystem: []),
    ] {
      app.primaryNavigationItem(destination.tabTitle).tap()
      XCTAssertTrue(
        app.navigationBars[destination.screenTitle].firstMatch.waitForExistence(timeout: 5),
        "Expected the \(destination.screenTitle) screen to render")
      try performAccessibilityAudit(in: app, sizedBySystem: destination.sizedBySystem)
    }

    openStatistics(in: app)
    XCTAssertTrue(
      statTile("Days studied", in: app).waitForExistence(timeout: 5),
      "Expected Search's Statistics row to open Statistics")
    // The calendar's title row swaps layouts as text grows (`ViewThatFits`), which the audit reads
    // as text that doesn't scale and is clipped; at the largest size the title and key show whole.
    try performAccessibilityAudit(in: app, skipping: [.dynamicType, .textClipped])
  }

  @MainActor
  func testStatisticsAuthenticationLossAsksToLogIn() {
    continueAfterFailure = false

    let app = makeApp(for: .progressActivityUnauthorized)
    launch(app)
    openStatistics(in: app)

    XCTAssertTrue(
      app.buttons["Log in"].firstMatch.waitForExistence(timeout: 5),
      "Expected authentication loss to sign the learner out, with the way to log in again")
  }

  @MainActor
  private func statTile(_ name: String, in app: XCUIApplication) -> XCUIElement {
    app.buttons.matching(
      NSPredicate(format: "label == %@ OR label BEGINSWITH %@", name, "\(name),")
    ).firstMatch
  }

  /// Skips what the audit misreads:
  /// - Contrast: on the simulator it measures pixels under iOS 26's glass bars and scroll edge
  ///   effects and fails primary text on the system background.
  /// - Dynamic Type and clipping in system bars and the search field, which keep their size (a long
  ///   press shows the Large Content Viewer) and truncate to their width, and in the elements
  ///   labeled `sizedBySystem`, which another system view sizes.
  /// - Dynamic Type in labels no element covers, when the window shows iPad's floating tab bar: its
  ///   tab names are labels inside its buttons, which XCUITest can't find, and keep their size as
  ///   the iPhone's tab bar does.
  /// - Hit areas of elements that aren't controls, such as a chart's key.
  @MainActor
  private func performAccessibilityAudit(
    in app: XCUIApplication, skipping skipped: XCUIAccessibilityAuditType = [],
    sizedBySystem labels: [String] = []
  ) throws {
    let systemSized =
      [app.navigationBars.firstMatch, app.tabBars.firstMatch, app.searchFields.firstMatch]
      + labels.map { app.descendants(matching: .any)[$0].firstMatch }
    // Frames carry floating-point noise: Zu's bar starts at y 61.99999999999999 and its account
    // button at 61.99999999999997.
    let frames = systemSized.filter(\.exists).map { $0.frame.insetBy(dx: -0.01, dy: -0.01) }

    let showsFloatingTabBar = app.buttons["ToggleSideBar"].exists

    try app.performAccessibilityAudit(for: .all.subtracting(skipped.union(.contrast))) { issue in
      guard let element = issue.element else {
        return showsFloatingTabBar && issue.auditType == .dynamicType
      }

      switch issue.auditType {
      case .dynamicType, .textClipped:
        return frames.contains { $0.contains(element.frame) }
      case .hitRegion:
        return [.other, .staticText, .image].contains(element.elementType)
      default:
        return false
      }
    }
  }

  @MainActor
  private func launch(_ app: XCUIApplication) {
    app.launch()

    let fixtureFailure = app.staticTexts["ui-test-fixture-failure"]
    if fixtureFailure.exists {
      continueAfterFailure = false
      XCTFail(fixtureFailure.label)
    }
  }

  @MainActor
  private func makeApp(for scenario: UITestScenario) -> XCUIApplication {
    let app = XCUIApplication()
    app.launchArguments += ["--ui-testing"]
    // Reads without a fixture fail as offline, whatever runs on the machine.
    app.launchEnvironment["ZOONK_API_BASE_URL"] = "http://127.0.0.1:1"
    app.launchEnvironment["ZOONK_UI_TEST_ACCOUNT"] = uiTestAccountJSON
    app.launchEnvironment["ZOONK_UI_TEST_SUMMARY"] = learnerSummaryUITestJSON
    app.launchEnvironment["ZOONK_UI_TEST_BUDDY"] = buddyStatusUITestJSON

    if let progressJSON = scenario.progressJSON {
      app.launchEnvironment["ZOONK_UI_TEST_PROGRESS"] = progressJSON
    }

    if let progressFailure = scenario.progressFailure {
      app.launchEnvironment["ZOONK_UI_TEST_PROGRESS_FAILURE"] = progressFailure
    }

    return app
  }

  @MainActor
  private func openStatistics(in app: XCUIApplication) {
    app.primaryNavigationItem("Search").tap()
    let statistics = app.buttons["Statistics"].firstMatch
    XCTAssertTrue(statistics.waitForExistence(timeout: 5), "Expected Search to list Statistics")
    statistics.tap()
  }

  /// The level chip is in the bar, or in the bar's More menu where text is too large for both it
  /// and the goal's name.
  @MainActor
  private func openLevel(in app: XCUIApplication) {
    let level = app.buttons.matching(NSPredicate(format: "label ENDSWITH %@", "Level 12"))
      .firstMatch

    if !level.waitForExistence(timeout: 2) {
      let more = app.buttons["More"].firstMatch
      XCTAssertTrue(more.waitForExistence(timeout: 5), app.debugDescription)
      more.tap()
      XCTAssertTrue(level.waitForExistence(timeout: 5), app.debugDescription)
    }

    level.tap()
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
    // A sidebar item with a badge reads its count after its title.
    let sidebarItem = collectionViews.cells.matching(
      NSPredicate(format: "label == %@ OR label BEGINSWITH %@", title, "\(title), ")
    ).firstMatch
    return sidebarItem.exists ? sidebarItem : buttons[title].firstMatch
  }
}
