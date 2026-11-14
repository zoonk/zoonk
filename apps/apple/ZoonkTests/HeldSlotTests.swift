import SwiftUI
import XCTest

@testable import Zoonk

/// A gate that lifts by itself keeps its slot for the visit, so nothing below moves under the
/// learner's finger, and the height it keeps belongs to the width it was measured at.
@MainActor
final class HeldSlotTests: XCTestCase {
  func testALessonBudgetRefusalKeepsTheNextRowInPlaceAtTheInstant() async throws {
    let opening = Date.now.addingTimeInterval(1)
    let limit = HelpLimit.usedUp(tier: .free, availableAt: opening)
    var nextRow: [CGFloat] = []

    // Two lines of words and Subscribe before the instant; one line and nothing after.
    try show(
      VStack(alignment: .leading, spacing: 12) {
        LimitNotice(limit: limit) { limit.mapLessonsWords(now: $0) }

        Text(verbatim: "When ownership is diluted")
          .onGeometryChange(for: CGFloat.self, of: { $0.frame(in: .global).minY }) {
            nextRow.append($0)
          }
      }
      .frame(width: 320)
      .environment(AppRouter()))

    try await Task.sleep(for: .seconds(2.5))

    XCTAssertNil(limit.mapLessonsWords(now: .now).line)
    XCTAssertEqual(nextRow.count, 1, "The next row moved: \(nextRow)")
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
