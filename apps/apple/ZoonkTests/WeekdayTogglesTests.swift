import SwiftUI
import XCTest

@testable import Zoonk

final class WeekdayTogglesTests: XCTestCase {
  /// The narrowest iPhone's list row, 390pt less the page's margins.
  private let phoneRow: CGFloat = 358

  private func names(
    width: CGFloat? = nil, _ typeSize: DynamicTypeSize = .large, _ identifier: String = "en_US"
  ) -> WeekdayToggles.Names? {
    WeekdayToggles.names(
      width: width ?? phoneRow, typeSize: typeSize, legibility: nil,
      locale: Locale(identifier: identifier))
  }

  /// Polish's "niedz." is too wide for a seventh of the narrowest iPhone, so its days show their
  /// letters rather than seven rows.
  func testTheWeekSharesOneRowOnAPhoneAtTheDefaultSizeInEveryLanguage() {
    for identifier in ["en_US", "pt_BR", "de_DE", "es_ES", "fr_FR", "ja_JP", "ko_KR", "tr_TR"] {
      XCTAssertEqual(names(.large, identifier), .short, identifier)
    }

    XCTAssertEqual(names(.large, "pl_PL"), .narrow)
  }

  func testTheWeekShowsLettersThenAListAsTheTextGrows() {
    XCTAssertEqual(names(.xxxLarge), .narrow)
    XCTAssertNil(names(.accessibility1), "at an accessibility size, full names in a list")
    XCTAssertNil(names(width: 100), "a pane too narrow for letters")
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
