import Foundation
import SwiftUI
import XCTest

@testable import Zoonk

final class AppNavigationTests: XCTestCase {
  func testLinksToMainPagesOpenTheirRoutes() throws {
    let links: [(String, AppLink)] = [
      ("https://www.zoonk.com/today", .tab(.today)),
      ("https://www.zoonk.com/pt/plan", .tab(.plan)),
      ("https://www.zoonk.com/stats", .route(.statistics)),
      (
        "https://www.zoonk.com/plan/biology%20basics",
        .route(.subject(subjectKey: "biology basics"))
      ),
      ("https://www.zoonk.com/content/chapters/c1", .route(.chapter(chapterId: "c1"))),
      ("https://www.zoonk.com/mock/new", .route(.mockChooser)),
      ("https://www.zoonk.com/mock/placement/g1", .route(.placementMock(goalId: "g1"))),
      ("https://www.zoonk.com/mock/b1?session=s1", .route(.mock(blockId: "b1", sessionId: "s1"))),
      (
        "https://www.zoonk.com/learn/l1?session=s1",
        .route(.lesson(lessonId: "l1", sessionId: "s1"))
      ),
      ("https://www.zoonk.com/learn/l1?session=", .route(.lesson(lessonId: "l1"))),
      ("https://www.zoonk.com/mistakes/practice?skill=k1", .route(.mistakePractice(skillId: "k1"))),
      ("https://www.zoonk.com/start/course/c1", .route(.courseStart(courseId: "c1"))),
      (
        "https://www.zoonk.com/start/course/c1?chapter=ch1",
        .route(.courseStart(courseId: "c1", chapterId: "ch1"))
      ),
      ("https://www.zoonk.com/start/g1", .route(.goalSetup(goalId: "g1"))),
      ("https://www.zoonk.com/start?draft=d1", .route(.startGoal(draftId: "d1"))),
      ("https://www.zoonk.com/de/plan-link/p1", .route(.planLink(planId: "p1"))),
      ("https://www.zoonk.com/session", .route(.session)),
      ("https://www.zoonk.com/session?block=b1", .block(blockId: "b1")),
    ]

    for (url, expected) in links {
      XCTAssertEqual(AppLink(url: try XCTUnwrap(URL(string: url))), expected, url)
    }
  }

  func testLinksWithoutAPlaceInTheAppAreLeftAlone() throws {
    for url in [
      "https://www.zoonk.com/pricing",
      "https://www.zoonk.com/learn",
      "https://www.zoonk.com/content/chapters/c1/extra",
      "com.googleusercontent.apps.123:/oauth2redirect?code=1",
    ] {
      XCTAssertNil(AppLink(url: try XCTUnwrap(URL(string: url))), url)
    }
  }

  @MainActor
  func testTasksStackAndCloseFromTheOneDismissed() {
    let router = AppRouter()

    router.open(.session)
    router.open(.lesson(lessonId: "l1", sessionId: "s1"))
    router.open(.checkpoint(blockId: "b1"))
    router.task(at: 1).wrappedValue = nil

    XCTAssertEqual(router.tasks, [.session])
  }

  @MainActor
  func testATaskOpenedBeneathAnotherShowsOnceUncovered() async {
    let router = AppRouter()

    router.open(.lesson(lessonId: "l1", sessionId: "s1"), over: .session)
    XCTAssertEqual(router.tasks, [.session], "The session is in place first, without animation")

    for _ in 0..<100 where router.tasks.count < 2 {
      await Task.yield()
    }

    XCTAssertEqual(router.tasks, [.session, .lesson(lessonId: "l1", sessionId: "s1")])
    XCTAssertTrue(router.isHidden(taskAt: 0), "The session waits out of sight under the lesson")
    XCTAssertFalse(router.isHidden(taskAt: 1))

    router.dismissTask()
    XCTAssertFalse(router.isHidden(taskAt: 0), "Closing the lesson shows the session")

    router.open(.essay(blockId: "b1"))
    XCTAssertFalse(router.isHidden(taskAt: 0), "Once shown, it stays shown under later tasks")
  }

  @MainActor
  func testEachWindowPlaysItsOwnQuestionBlock() {
    let first = AppRouter()
    let second = AppRouter()

    first.openStudy(.questionBlock(sessionID: "s1", blockID: "b1"))
    second.openStudy(.questionBlock(sessionID: "s1", blockID: "b2"))
    second.playback.leave()

    XCTAssertEqual(first.playback.playingBlockID, "b1", "Another window's block leaves this one's")
    XCTAssertEqual(first.tasks, [.session])
    XCTAssertNil(second.playback.playingBlockID)
  }

  @MainActor
  func testPushesLandOnTheSelectedTabAfterClosingTasks() {
    let router = AppRouter(selectedTab: .plan)

    router.open(.lesson(lessonId: "l1"))
    router.open(.chapter(chapterId: "c1"))

    XCTAssertEqual(router.tasks, [])
    XCTAssertEqual(router.path(for: .plan).wrappedValue.count, 1)
    XCTAssertEqual(router.path(for: .today).wrappedValue.count, 0)
  }

  @MainActor
  func testOpeningTheSelectedStudyPlaceReturnsToItsRoot() {
    let router = AppRouter(selectedTab: .exam)

    router.open(.mockChooser)
    router.open(.exam)

    XCTAssertEqual(router.path(for: .exam).wrappedValue.count, 0)
  }

  @MainActor
  func testAStudyPlaceThatCantStaySelectedMovesToToday() {
    let compact = AppRouter(selectedTab: .exam)
    compact.leaveStudyTab(keepingPlace: true)

    XCTAssertEqual(compact.selectedTab, .today)
    XCTAssertEqual(compact.path(for: .today).wrappedValue.count, 1)

    let removed = AppRouter(selectedTab: .exam)
    removed.leaveStudyTab(keepingPlace: false)

    XCTAssertEqual(removed.selectedTab, .today)
    XCTAssertEqual(removed.path(for: .today).wrappedValue.count, 0)
  }

  @MainActor
  func testTheAppSheetShowsOnTheTopmostLayer() {
    let router = AppRouter()
    router.open(.session)
    router.open(.lesson(lessonId: "l1", sessionId: "s1"))
    router.present(.subscription)

    XCTAssertNil(router.sheet(presentedBy: 0).wrappedValue)
    XCTAssertNil(router.sheet(presentedBy: 1).wrappedValue)
    XCTAssertEqual(router.sheet(presentedBy: 2).wrappedValue, .subscription)

    router.sheet(presentedBy: 1).wrappedValue = nil
    XCTAssertEqual(router.sheet, .subscription, "A covered layer can't dismiss the sheet")

    router.sheet(presentedBy: 2).wrappedValue = nil
    XCTAssertNil(router.sheet)
  }
}
