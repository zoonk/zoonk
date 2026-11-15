import SwiftUI
import XCTest

@testable import Zoonk

/// A capture's `type` rule compares these names, so one role always gets one name.
final class LayoutCaptureTests: XCTestCase {
  func testNamesEachRoleByTheDesignSystem() {
    XCTAssertEqual(TypeStyle.rowTitle.layoutName, "rowTitle")
    XCTAssertEqual(TypeStyle.meta.layoutName, "meta")
    XCTAssertEqual(TypeStyle.data.layoutName, "data")
  }

  /// `note` and `smallButton` differ only in weight, so a weight change on either could match both.
  func testNamesAWeightChangeByItsRoleTheSameEveryTime() {
    XCTAssertEqual(TypeStyle.note.weight(.semibold).layoutName, "note semibold")
    XCTAssertEqual(TypeStyle.meta.weight(.medium).layoutName, "meta medium")
  }

  /// The capitals come from the role's font only when that font drew the text: a goal's name can
  /// be Japanese or end in an emoji, which other faces draw.
  @MainActor
  func testTakesTheFontsCapitalsOnlyForTextItsFaceDrew() {
    let font = TypeStyle.body.layoutFont(.large, legibility: nil)

    XCTAssertTrue(LayoutFaces.drewOnly(font, drawnLines("Reading comprehension")))
    XCTAssertFalse(LayoutFaces.drewOnly(font, drawnLines("日本語の練習")))
    XCTAssertFalse(LayoutFaces.drewOnly(font, drawnLines("ENEM 2027 🎯")))
    XCTAssertFalse(LayoutFaces.drewOnly(font, []), "nothing showed what drew it")
  }

  func testGroupsRowsOutsideAListWhileTheyTouch() {
    let rows = [
      CGRect(x: 16, y: 100, width: 300, height: 44),
      CGRect(x: 16, y: 144, width: 300, height: 44),
      // Apart from the first two: 12pt of space.
      CGRect(x: 16, y: 200, width: 300, height: 44),
      // Touching, but narrower: another column.
      CGRect(x: 16, y: 244, width: 200, height: 44),
    ]

    XCTAssertEqual(LayoutStacks.groups(rows), [[0, 1], [2], [3]])
  }

  func testAPartUnderABarOrPastTheScreenDoesNotShow() {
    let list = LayoutViewports.Viewport(
      frame: CGRect(x: 0, y: 0, width: 420, height: 912),
      visible: CGRect(x: 0, y: 100, width: 420, height: 700))
    let viewports = LayoutViewports(
      window: CGRect(x: 0, y: 60, width: 420, height: 820), scrolls: [list])

    XCTAssertTrue(viewports.shows(CGRect(x: 20, y: 400, width: 100, height: 20)))
    XCTAssertFalse(viewports.shows(CGRect(x: 20, y: 90, width: 100, height: 20)), "under the bar")
    XCTAssertFalse(
      viewports.shows(CGRect(x: 20, y: 910, width: 100, height: 33)), "past the screen")
  }

  /// A chevron the system draws after a row is read, and one that can't be read is still written.
  func testReadsTheRoomAfterARow() {
    let room = CGRect(x: 380, y: 100, width: 20, height: 44)
    let chevron = CGRect(x: 390, y: 116, width: 7, height: 12)

    XCTAssertEqual(LayoutSystemEnd.read(room: room, shown: true, ink: chevron), .glyph(chevron))
    XCTAssertEqual(LayoutSystemEnd.read(room: room, shown: true, ink: nil), .none)
    XCTAssertEqual(
      LayoutSystemEnd.read(
        room: CGRect(x: 400, y: 100, width: 1, height: 44), shown: true, ink: nil),
      .none, "no room for one")
    XCTAssertEqual(
      LayoutSystemEnd.read(
        room: room, shown: true, ink: CGRect(x: 398, y: 102, width: 2, height: 40)),
      .none, "a scroll indicator")
    XCTAssertEqual(
      LayoutSystemEnd.read(
        room: room, shown: true, ink: CGRect(x: 382, y: 104, width: 18, height: 36)),
      .unreadable(clipped: false), "an accessory at an accessibility size, or one content runs into"
    )
    XCTAssertEqual(
      LayoutSystemEnd.read(room: room, shown: false, ink: chevron), .unreadable(clipped: true))
  }

  @MainActor
  private func drawnLines(_ words: String) -> [DrawnLine] {
    let part = UUID()
    let renderer = ImageRenderer(
      content: Text(verbatim: words).typeStyle(.body).textRenderer(LayoutRunsProbe(part: part)))
    _ = renderer.uiImage
    return LayoutRuns.shared.lines(of: part)
  }
}
