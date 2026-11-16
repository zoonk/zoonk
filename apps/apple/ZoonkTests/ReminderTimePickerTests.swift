import SwiftUI
import XCTest

@testable import Zoonk

/// The reminder offer under a finished day, a time picked while the window crosses the width where
/// the summary is two panes: the card is drawn again on the other side, with the time picked.
@MainActor
final class ReminderTimePickerTests: XCTestCase {
  func testAPickedTimeHoldsWhenTheSummarySplitsIntoPanes() async throws {
    try await holds(from: 420, to: 1376)
  }

  func testAPickedTimeHoldsWhenTheSummaryJoinsItsPanes() async throws {
    try await holds(from: 1376, to: 420)
  }

  private func holds(from: CGFloat, to: CGFloat) async throws {
    let window = try show(
      SummaryOffer()
        .appDependencies(.hosted())
        .environment(AppRouter())
        .zoonkStyles())
    window.frame = CGRect(x: 0, y: 0, width: from, height: 1032)
    try await waitForLayout(in: window)
    try await waitForTestCondition("The time picker did not appear") {
      timePicker(in: window) != nil
    }

    let picker = try XCTUnwrap(timePicker(in: window), "The offer asks for a time")
    picker.date = ReminderTime.date("07:30")
    picker.sendActions(for: .valueChanged)

    window.frame = CGRect(x: 0, y: 0, width: to, height: 1032)
    try await waitForLayout(in: window)
    try await waitForTestCondition("The selected time did not survive resize") {
      timePicker(in: window).map { ReminderTime.string($0.date) } == "07:30"
    }

    let shown = try XCTUnwrap(timePicker(in: window), "The offer still asks for a time")
    XCTAssertEqual(ReminderTime.string(shown.date), "07:30", "The picked time holds")
  }

  private func timePicker(in view: UIView) -> UIDatePicker? {
    if let picker = view as? UIDatePicker, picker.window != nil, !picker.isHidden {
      return picker
    }

    return view.subviews.lazy.compactMap { self.timePicker(in: $0) }.first
  }
}

/// The summary's offer as `SessionSummaryView` holds it: in state above its panes, drawn in the
/// numbers on whichever side shows them.
private struct SummaryOffer: View {
  @State private var offer = ReminderOfferState(
    time: "19:00", timeZone: "Etc/GMT", claim: .claimed)

  var body: some View {
    PaneSplit {
      card
    } secondary: {
      Color.clear
    } single: {
      card
    }
  }

  private var card: some View {
    ZoonkList {
      Section {
        ReminderOfferCard(offer: $offer)
      }
    }
  }
}
