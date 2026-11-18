import SwiftUI
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

  /// A link the app opens as it starts arrives before the sidebar lists its places.
  func testAPageOpenedBeforeTheSidebarListsItMovesToItsOwnRow() {
    let router = AppRouter()

    router.open(.mindMaps())
    router.sidebarTabs = Set(AppTab.sidebarPlaces)
    XCTAssertEqual(router.selectedTab, .mindMaps)

    router.sidebarTabs = []
    router.select(.today)
    XCTAssertEqual(router.path(for: .today).wrappedValue, NavigationPath())

    router.open(.statistics())
    router.sidebarTabs = Set(AppTab.sidebarPlaces)
    XCTAssertEqual(router.selectedTab, .stats(.level))
  }

  /// Narrowing the window and widening it again keeps what the learner started open.
  func testAResizeKeepsAPracticeStartedFromASidebarPlace() {
    let router = AppRouter()
    router.sidebarTabs = Set(AppTab.sidebarPlaces)
    router.open(.mistakes)
    router.open(.mistakePractice())

    router.leaveStudyTab(keepingPlace: true)
    router.sidebarTabs = []
    router.sidebarTabs = Set(AppTab.sidebarPlaces)

    XCTAssertEqual(router.selectedTab, .mistakes)
    XCTAssertEqual(router.tasks, [.mistakePractice()])
  }

  /// What closes a sheet on navigation sees a resize as staying on the same page.
  func testAResizeShowsTheSamePage() {
    let router = AppRouter()
    router.sidebarTabs = Set(AppTab.sidebarPlaces)
    router.open(.mistakes)
    router.open(.mistakePractice())
    router.present(.feedback(screen: "practice"))
    let shown = router.shown

    router.leaveStudyTab(keepingPlace: true)
    router.sidebarTabs = []
    XCTAssertEqual(router.shown, shown)

    router.sidebarTabs = Set(AppTab.sidebarPlaces)
    XCTAssertEqual(router.shown, shown)

    router.select(.plan)
    XCTAssertNotEqual(router.shown, shown)
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
