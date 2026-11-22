import SwiftUI
import XCTest

@testable import Zoonk

@MainActor
final class MockChooserVisitTests: XCTestCase {
  func testAnOptionWaitingForAnExamChoiceReplacesStartUntilAnotherOptionIsPicked() async throws {
    let router = AppRouter()
    let visit = try await PageVisit(in: self, goal: .exam, router: router) { MockChooserScreen() }
    let start = String(localized: "Start", table: "Mock")
    let choose = String(localized: "Choose on Today", table: "Mock")
    let pickWritten = { (label: String) in
      label.hasPrefix(String(localized: "Half the exam", table: "Mock"))
    }

    try await activate(where: pickWritten, in: visit.window)
    try await visit.assertSays(choose)
    visit.assertSaysNothingOf(start)

    try await activate(
      where: { $0.hasPrefix(String(localized: "The full exam", table: "Mock")) },
      in: visit.window)
    try await visit.assertSays(start)
    visit.assertSaysNothingOf(choose)

    try await activate(where: pickWritten, in: visit.window)
    router.selectedTab = .exam
    try await visit.activate(choose)
    XCTAssertEqual(router.selectedTab, .today)
  }

  func testAMockStartThatFailsAfterLeavingSaysNothing() async throws {
    let visit = try await PageVisit(in: self, goal: .exam, holding: "startAnytimeMock") {
      MockChooserScreen()
    }
    try await activate(
      where: { $0.hasPrefix(String(localized: "The full exam", table: "Mock")) },
      in: visit.window)
    try await visit.activate(String(localized: "Start", table: "Mock"))
    try await visit.server.waitForHeldRequest()
    let sent = await visit.server.writes
    XCTAssertTrue(sent.contains("startAnytimeMock"), "Start must reach the API: \(sent)")
    guard sent.contains("startAnytimeMock") else { return }
    try await visit.failAfterLeaving()
    visit.assertSaysNothingOf(
      String(localized: "We couldn't start the mock exam. Try again.", table: "Mock"))
  }

  func testAMockStartFailureEndsWithTheVisit() async throws {
    let visit = try await PageVisit(in: self, goal: .exam) { MockChooserScreen() }
    try await activate(
      where: { $0.hasPrefix(String(localized: "The full exam", table: "Mock")) },
      in: visit.window)
    try await visit.activate(String(localized: "Start", table: "Mock"))
    let failure = String(localized: "We couldn't start the mock exam. Try again.", table: "Mock")
    try await visit.assertSays(failure)
    try await visit.leaveAndComeBack()
    visit.assertSaysNothingOf(failure)
  }

}
