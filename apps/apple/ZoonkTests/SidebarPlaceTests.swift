import XCTest

@testable import Zoonk

/// Where the sidebar lists a page, opening it marks that page's own row, as main's sidebar does,
/// never the tab it was opened from (main's `getActiveTab`).
@MainActor
final class SidebarPlaceTests: XCTestCase {
  func testAPageTheSidebarListsMarksItsOwnRow() {
    let router = AppRouter()
    router.sidebarTabs = Set(AppTab.sidebarPlaces)

    router.open(.mistakes)
    XCTAssertEqual(router.selectedTab, .mistakes)

    router.open(.statistics(section: .score))
    XCTAssertEqual(router.selectedTab, .stats(.score))
  }

  /// The overview opens with Level beside it, so Level's row is the one it marks.
  func testTheStatisticsOverviewMarksLevel() {
    let router = AppRouter()
    router.sidebarTabs = Set(AppTab.sidebarPlaces)

    router.open(.statistics())

    XCTAssertEqual(router.selectedTab, .stats(.level))
  }

  func testWithoutASidebarAPageOpensOnTheTabItCameFrom() {
    let router = AppRouter()

    router.open(.mistakes)

    XCTAssertEqual(router.selectedTab, .today)
  }

  func testAPlaceTheSidebarDoesntListOpensOnTheTabItCameFrom() {
    let router = AppRouter()
    router.sidebarTabs = Set(AppTab.stats)

    router.open(.speaking)

    XCTAssertEqual(router.selectedTab, .today)
  }
}
