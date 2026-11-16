import SwiftUI
import XCTest

@testable import Zoonk

@MainActor
final class MockChooserVisitTests: XCTestCase {
  func testAMockStartThatFailsAfterLeavingSaysNothing() async throws {
    let visit = try await PageVisit(in: self, goal: .exam, holding: "startAnytimeMock") {
      MockChooserScreen()
    }
    try await visit.settle()
    try activate(
      where: { $0.hasPrefix(String(localized: "The full exam", table: "Mock")) },
      in: visit.window)
    try await visit.settle()
    try await visit.activate(String(localized: "Start", table: "Mock"))
    try await visit.settle()
    let sent = await visit.server.writes
    XCTAssertTrue(sent.contains("startAnytimeMock"), "Start must reach the API: \(sent)")
    guard sent.contains("startAnytimeMock") else { return }
    try await visit.failAfterLeaving()
    visit.assertSaysNothingOf(
      String(localized: "We couldn't start the mock exam. Try again.", table: "Mock"))
  }

  func testANotEnoughQuestionsDecisionEndsWithTheVisit() async throws {
    let visit = try await PageVisit(in: self, goal: .exam) { MockChooserScreen() }
    await visit.server.setMockStartResult(
      #"{"error":{"code":"NOT_ENOUGH_QUESTIONS","message":"Not enough questions"}}"#)
    try await visit.settle()
    try activate(
      where: { $0.hasPrefix(String(localized: "The full exam", table: "Mock")) },
      in: visit.window)
    try await visit.settle()
    try await visit.activate(String(localized: "Start", table: "Mock"))
    try await visit.settle()
    let failure = String(
      localized: "Not enough questions for this one yet. Pick another.", table: "Mock")
    visit.assertSays(failure)
    try await visit.leaveAndComeBack()
    visit.assertSaysNothingOf(failure)
  }

  func testAMockStartFailureEndsWithTheVisit() async throws {
    let visit = try await PageVisit(in: self, goal: .exam) { MockChooserScreen() }
    try await visit.settle()
    try activate(
      where: { $0.hasPrefix(String(localized: "The full exam", table: "Mock")) },
      in: visit.window)
    try await visit.settle()
    try await visit.activate(String(localized: "Start", table: "Mock"))
    try await visit.settle()
    let failure = String(localized: "We couldn't start the mock exam. Try again.", table: "Mock")
    visit.assertSays(failure)
    try await visit.leaveAndComeBack()
    visit.assertSaysNothingOf(failure)
  }

}
