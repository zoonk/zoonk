import SwiftUI
import XCTest

@testable import Zoonk

/// Where the sidebar lists a page, opening it marks that page's own row, as main's sidebar does,
/// never the tab it was opened from (main's `getActiveTab`).
@MainActor
final class SidebarPlaceTests: XCTestCase {
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

  /// The place sits on top of whatever Today already had pushed.
  func testAResizeShowsTheSamePageOverAnEarlierPage() {
    let router = AppRouter()
    router.sidebarTabs = Set(AppTab.sidebarPlaces)
    router.open(.chapter(chapterId: "chapter"))
    router.open(.mistakes)
    router.open(.mistakePractice())
    router.present(.feedback(screen: "practice"))
    let shown = router.shown

    router.leaveStudyTab(keepingPlace: true)
    router.sidebarTabs = []
    XCTAssertEqual(router.shown, shown)

    router.sidebarTabs = Set(AppTab.sidebarPlaces)
    XCTAssertEqual(router.shown, shown)
    XCTAssertEqual(router.selectedTab, .mistakes)

    var below = NavigationPath()
    below.append(AppRoute.chapter(chapterId: "chapter"))
    XCTAssertEqual(router.path(for: .today).wrappedValue, below)
  }

  /// A chapter opened from a mind map stays open as the window narrows and widens again.
  func testAResizeKeepsAPagePushedOnASidebarPlace() {
    let router = AppRouter()
    router.sidebarTabs = Set(AppTab.sidebarPlaces)
    router.open(.subject(subjectKey: "math"))
    router.open(.mindMaps())
    router.open(.chapter(chapterId: "chapter"))
    router.present(.feedback(screen: "chapter"))
    let shown = router.shown

    router.leaveStudyTab(keepingPlace: true)
    router.sidebarTabs = []
    XCTAssertEqual(
      router.path(for: .today).wrappedValue,
      path(.subject(subjectKey: "math"), .mindMaps(), .chapter(chapterId: "chapter")))
    XCTAssertEqual(router.shown, shown)

    router.sidebarTabs = Set(AppTab.sidebarPlaces)
    XCTAssertEqual(router.selectedTab, .mindMaps)
    XCTAssertEqual(router.path(for: .mindMaps).wrappedValue, path(.chapter(chapterId: "chapter")))
    XCTAssertEqual(router.path(for: .today).wrappedValue, path(.subject(subjectKey: "math")))
    XCTAssertEqual(router.shown, shown)
  }

  /// Back from the chapter on the narrow window shows the mind maps, and widening keeps them.
  func testAResizeKeepsOnlyThePagesStillOpen() {
    let router = AppRouter()
    router.sidebarTabs = Set(AppTab.sidebarPlaces)
    router.open(.mindMaps())
    router.open(.chapter(chapterId: "chapter"))

    router.leaveStudyTab(keepingPlace: true)
    router.sidebarTabs = []
    router.path(for: .today).wrappedValue = path(.mindMaps())
    router.sidebarTabs = Set(AppTab.sidebarPlaces)

    XCTAssertEqual(router.selectedTab, .mindMaps)
    XCTAssertEqual(router.path(for: .mindMaps).wrappedValue, NavigationPath())
  }

  /// Today's link to the mock exams pushes the page itself, not through the router.
  func testAResizeMovesAPlaceALinkOpenedToItsOwnRow() {
    let router = AppRouter()
    router.path(for: .today).wrappedValue = path(.chapter(chapterId: "chapter"), .mockChooser)

    router.sidebarTabs = Set(AppTab.sidebarPlaces)

    XCTAssertEqual(router.selectedTab, .mockExam)
    XCTAssertEqual(router.path(for: .today).wrappedValue, path(.chapter(chapterId: "chapter")))
  }

  /// The catalog pushes a course itself, so the router doesn't know the pages over Mistakes. The
  /// narrow window shows Mistakes, and widening it again shows the course with its back stack.
  func testAResizeKeepsPagesTheRouterDidntPush() {
    let router = AppRouter()
    router.sidebarTabs = Set(AppTab.sidebarPlaces)
    router.open(.mistakes)
    router.open(.catalog)
    router.push("course")
    router.present(.feedback(screen: "course"))
    let pages = router.path(for: .mistakes).wrappedValue
    let shown = router.shown

    router.leaveStudyTab(keepingPlace: true)
    router.sidebarTabs = []
    XCTAssertEqual(router.path(for: .today).wrappedValue, path(.mistakes))
    XCTAssertEqual(router.shown, shown)

    router.sidebarTabs = Set(AppTab.sidebarPlaces)
    XCTAssertEqual(router.selectedTab, .mistakes)
    XCTAssertEqual(router.path(for: .mistakes).wrappedValue, pages)
    XCTAssertEqual(router.shown, shown)
  }

  private func path(_ routes: AppRoute...) -> NavigationPath {
    NavigationPath(routes)
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
