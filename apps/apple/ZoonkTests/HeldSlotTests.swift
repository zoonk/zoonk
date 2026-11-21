import SwiftUI
import XCTest

@testable import Zoonk

@MainActor
final class HeldSlotTests: XCTestCase {
  func testOpeningAPracticeCallKeepsTheNextRowInPlace() async throws {
    let session = SessionStore.preview(account: .planTestAccount)
    let cache = AppCache(session: session)
    let clients = APIClientFactory.live(baseURL: AppConfiguration.current.apiBaseURL)
    let start = CallStart()
    let learner = LearnerSummaryStore(api: LearnerSummaryAPI(clients: clients), cache: cache)
    let voice = VoiceServices(clients: clients, cache: cache)
    let router = AppRouter()
    try await checkOpening(action: "Start call", anchor: "Words") { date in
      List {
        PracticeCallSection(
          conversation: .init(
            character: nil, defaultMinutes: 5, minutes: [], paused: false, plusMinutes: [],
            limit: .init(availableAt: date, period: "rolling30Days", tier: .plus)),
          chapterId: "chapter", goalId: nil, minutes: .constant(nil), start: start,
          onStarted: { _ in })
        Section { Text(verbatim: "Words") }
      }
      .environment(learner)
      .environment(voice)
      .environment(router)
    }
  }

  func testACallOpeningKeepsEndCallInPlace() async throws {
    let router = AppRouter()
    for tier in [LearnerTier.plus, .free] {
      try await checkOpening(action: "Call again", anchor: "End call", waitForExpiry: true) {
        date in
        DroppedCallView(
          dropped: DroppedCall(reason: .limit, retry: nil),
          limit: .usedUp(tier: tier, availableAt: date),
          name: "Zu", onAction: { _ in }
        ).environment(router)
      }
    }
  }

  private func checkOpening(
    action: String, anchor: String, waitForExpiry: Bool = false,
    @ViewBuilder content: @escaping (Date) -> some View
  ) async throws {
    try await readsWhatVoiceOverReads()
    let opening = Opening()
    let window = try show(AtOpening(opening: opening, content: content))
    defer { window.isHidden = true }

    func element(_ label: String) -> NSObject? {
      accessibilityElements(in: window).first {
        $0.isAccessibilityElement && $0.accessibilityLabel == label
          && $0.accessibilityFrame.height > 0
      }
    }
    func actionIsEnabled() -> Bool {
      guard let button = element(action) else { return false }
      return !button.accessibilityTraits.contains(.notEnabled)
    }

    try await waitForTestCondition("The gated screen did not appear") {
      element(anchor) != nil && !actionIsEnabled()
    }
    if waitForExpiry { opening.date = .now.addingTimeInterval(1.5) }
    try await waitForLayout(in: window)
    _ = window.snapshotView(afterScreenUpdates: true)
    let before = try XCTUnwrap(element(anchor)).accessibilityFrame
    if !waitForExpiry { opening.date = .now.addingTimeInterval(-3600) }
    try await waitForTestCondition("The action did not open") { actionIsEnabled() }
    XCTAssertEqual(try XCTUnwrap(element(anchor)).accessibilityFrame, before, anchor)
  }

  func testOpeningTheGateKeepsTheClosedHeight() async throws {
    let gate = Gate()
    try show(MeasuredSlot(gate: gate))

    try await waitForTestCondition("The closed slot did not measure") {
      gate.contentHeight > 0 && gate.slotHeights.last == gate.contentHeight
    }
    let closedHeight = gate.contentHeight

    gate.isClosed = false
    try await waitForTestCondition("The shorter content did not lay out") {
      gate.contentHeight < closedHeight
    }

    XCTAssertEqual(gate.slotHeights, [closedHeight])
  }

  func testAWidthChangeWhileGatedStartsAgainFromTheNaturalHeight() async throws {
    let gate = Gate()
    try show(MeasuredSlot(gate: gate))

    try await waitForTestCondition("The narrow slot did not measure") {
      gate.contentHeight > 0 && gate.slotHeights.last == gate.contentHeight
    }
    let narrow = gate.contentHeight

    gate.width = 800
    try await waitForTestCondition("The wider slot did not shrink to the content's height") {
      gate.contentHeight < narrow && gate.slotHeights.last == gate.contentHeight
    }
  }
}

@Observable
private final class Opening {
  var date = Date.now.addingTimeInterval(3600)
}

private struct AtOpening<Content: View>: View {
  let opening: Opening
  @ViewBuilder let content: (Date) -> Content

  var body: some View { content(opening.date) }
}

@Observable
private final class Gate {
  var isClosed = true
  var width: CGFloat = 160
  var contentHeight: CGFloat = 0
  var slotHeights: [CGFloat] = []
}

private struct MeasuredSlot: View {
  let gate: Gate

  var body: some View {
    let notice = "You'll have enough later today, or subscribe to create it now."
    HeldSlot(gated: gate.isClosed) {
      Text(verbatim: gate.isClosed ? notice : "Ready")
        .onGeometryChange(for: CGFloat.self, of: \.size.height) { gate.contentHeight = $0 }
    }
    .frame(width: gate.width)
    .onGeometryChange(for: CGFloat.self, of: \.size.height) { gate.slotHeights.append($0) }
  }
}
