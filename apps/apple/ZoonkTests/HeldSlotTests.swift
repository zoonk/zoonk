import SwiftUI
import XCTest

@testable import Zoonk

/// A gate that lifts by itself keeps its slot for the visit, so nothing below moves under the
/// learner's finger, and the height it keeps belongs to the width it was measured at.
@MainActor
final class HeldSlotTests: XCTestCase {
  func testALessonBudgetRefusalKeepsTheNextRowInPlaceAtTheInstant() async throws {
    let limit = HelpLimit.usedUp(tier: .free, availableAt: .now.addingTimeInterval(1))

    // Two lines of words and Subscribe before the instant; one line and nothing after.
    let moves = try await nextRowAtTheInstant {
      LimitNotice(limit: limit) { limit.mapLessonsWords(now: $0) }
    }

    XCTAssertNil(limit.mapLessonsWords(now: .now).line)
    XCTAssertEqual(moves.count, 1, "The next row moved: \(moves)")
  }

  func testAListeningQuestionsRefusalKeepsTheAnswersInPlaceAtTheInstant() async throws {
    let limit = HelpLimit.usedUp(tier: .free, availableAt: .now.addingTimeInterval(1))

    let moves = try await nextRowAtTheInstant {
      ListeningFailedNote(limit: limit, play: {})
    }

    XCTAssertEqual(moves.count, 1, "The answers moved: \(moves)")
  }

  func testALessonGateInPlaceKeepsWhatFollowsInPlaceAtTheInstant() async throws {
    let refusal = LessonRunRefusal.limitReached(
      tier: .free, period: .last30Days(availableAt: .now.addingTimeInterval(1)))

    let moves = try await nextRowAtTheInstant {
      LessonUnavailableView(refusal: refusal, isNotice: true, retry: {})
    }

    XCTAssertEqual(moves.count, 1, "What follows moved: \(moves)")
  }

  /// The way on holds Call again's place while the limit holds, so the screen stays still when
  /// Call again takes it.
  func testADroppedCallKeepsItsPlaceAtTheInstant() async throws {
    for tier in [LearnerTier.plus, .free] {
      let limit = HelpLimit.usedUp(tier: tier, availableAt: .now.addingTimeInterval(1.5))
      let window = try show(
        DroppedCallView(
          dropped: DroppedCall(reason: .limit, retry: nil), limit: limit, name: "Zu",
          onAction: { _ in }
        )
        .environment(AppRouter()))

      try await Task.sleep(for: .seconds(0.5))
      let before = try XCTUnwrap(inkTop(window))
      XCTAssertGreaterThan(before, 100, "The render is blank or misread")
      try await Task.sleep(for: .seconds(2))

      XCTAssertEqual(try XCTUnwrap(inkTop(window)), before, "\(tier)")
      window.isHidden = true
    }
  }

  /// The gate and a row after it, recording each place the row is drawn through the instant.
  private func nextRowAtTheInstant(_ gate: () -> some View) async throws -> [CGFloat] {
    var nextRow: [CGFloat] = []

    try show(
      VStack(alignment: .leading, spacing: 12) {
        gate()

        Text(verbatim: "When ownership is diluted")
          .onGeometryChange(for: CGFloat.self, of: { $0.frame(in: .global).minY }) {
            nextRow.append($0)
          }
      }
      .frame(width: 320)
      .environment(AppRouter()))

    try await Task.sleep(for: .seconds(2.5))
    return nextRow
  }

  func testAWidthChangeWhileGatedStartsAgainFromTheNaturalHeight() async throws {
    let width = Width(value: 160)
    var heights: [CGFloat] = []

    try show(
      Sized(width: width) {
        HeldSlot(gated: true) {
          Text(verbatim: "You'll have enough later today, or subscribe to make it now.")
        }
        .onGeometryChange(for: CGFloat.self, of: \.size.height) { heights.append($0) }
      })

    try await Task.sleep(for: .seconds(0.5))
    let narrow = try XCTUnwrap(heights.last)

    width.value = 800
    try await Task.sleep(for: .seconds(0.5))

    XCTAssertLessThan(try XCTUnwrap(heights.last), narrow)
  }
}

@Observable
private final class Width {
  var value: CGFloat

  init(value: CGFloat) {
    self.value = value
  }
}

private struct Sized<Content: View>: View {
  let width: Width
  @ViewBuilder let content: Content

  var body: some View {
    content.frame(width: width.value)
  }
}
