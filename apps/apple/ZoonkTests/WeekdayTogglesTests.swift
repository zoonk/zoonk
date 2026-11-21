import SwiftUI
import XCTest

@testable import Zoonk

final class WeekdayTogglesTests: XCTestCase {
  /// The narrowest iPhone's list row, 390pt less the page's margins.
  private let phoneRow: CGFloat = 358

  func testTheWeekSharesOneRowOnAPhoneAtTheDefaultSizeInEveryLanguage() {
    for identifier in ["en_US", "pt_BR", "de_DE", "es_ES", "fr_FR", "ja_JP", "ko_KR", "pl_PL"] {
      XCTAssertTrue(
        WeekdayToggles.fits(
          width: phoneRow, typeSize: .large, legibility: nil, locale: Locale(identifier: identifier)
        ), identifier)
    }
  }

  func testTheWeekBecomesAListWhereSevenNamesCantShareARow() {
    XCTAssertFalse(
      WeekdayToggles.fits(
        width: phoneRow, typeSize: .accessibility1, legibility: nil,
        locale: Locale(identifier: "en_US")))
    XCTAssertFalse(
      WeekdayToggles.fits(
        width: 200, typeSize: .large, legibility: nil, locale: Locale(identifier: "en_US")),
      "a narrow pane")
  }

  /// VoiceOver reads each day as a switch named for its whole weekday, Monday first, on or off.
  @MainActor
  func testEachDayReadsAsItsWholeWeekdayAndWhetherItsOn() async throws {
    try await readsWhatVoiceOverReads()
    let window = try show(
      List {
        Section {
          WeekdayToggles(isOn: { $0 == 1 }, onToggle: { _, _ in })
        }
      }
      .frame(width: 390)
      .zoonkStyles())
    try await waitForLayout(in: window)

    try await waitForTestCondition("The days weren't read: \(spoken(in: window))") {
      spoken(in: window).contains("Sunday")
    }
    XCTAssertEqual(
      spoken(in: window),
      ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"])
    XCTAssertEqual(spokenValues(in: window), ["1", "0", "0", "0", "0", "0", "0"])
  }
}
