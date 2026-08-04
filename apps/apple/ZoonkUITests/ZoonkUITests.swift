import XCTest

final class ZoonkUITests: XCTestCase {
  /// Proves that every primary destination is reachable through the native tab bar and presents the matching screen title.
  @MainActor
  func testPrimaryTabsNavigateToTheirScreens() {
    continueAfterFailure = false

    let app = XCUIApplication()
    app.launchArguments += ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
    app.launch()

    let screenTitles = ["Home", "New course", "Courses", "Progress", "Search"]

    for screenTitle in screenTitles {
      let tab = app.buttons[screenTitle].firstMatch
      XCTAssertTrue(tab.waitForExistence(timeout: 5), "Expected the \(screenTitle) tab to exist")
      tab.tap()
      XCTAssertTrue(
        app.navigationBars[screenTitle].waitForExistence(timeout: 5),
        "Expected the \(screenTitle) screen title to exist")
    }
  }
}
