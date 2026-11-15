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
    let font = TypeStyle.body.uiFont(.large, legibility: nil)

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
    let viewports = LayoutViewports(window: CGRect(x: 0, y: 60, width: 420, height: 820))
    // A list's visible bounds less its bar.
    let list = CGRect(x: 0, y: 100, width: 420, height: 700)

    XCTAssertTrue(viewports.shows(CGRect(x: 20, y: 400, width: 100, height: 20), clips: [list]))
    XCTAssertFalse(
      viewports.shows(CGRect(x: 20, y: 90, width: 100, height: 20), clips: [list]),
      "under the bar")
    XCTAssertFalse(
      viewports.shows(CGRect(x: 20, y: 910, width: 100, height: 33), clips: []),
      "past the screen")
  }

  /// A text half scrolled out of its list: its center has left the scroll, ten points still show.
  func testAPartHalfOutOfItsScrollDoesNotShow() {
    let viewports = LayoutViewports(window: CGRect(x: 0, y: 0, width: 420, height: 912))
    let list = CGRect(x: 0, y: 100, width: 420, height: 600)

    XCTAssertFalse(viewports.shows(CGRect(x: 20, y: 80, width: 200, height: 30), clips: [list]))
  }

  /// What clips a view is read from the views that hold it, whatever its position.
  @MainActor
  func testFindsTheScrollViewsThatHoldAView() {
    let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 420, height: 912))
    let scroll = UIScrollView(frame: CGRect(x: 0, y: 100, width: 420, height: 600))
    let other = UIScrollView(frame: CGRect(x: 0, y: 0, width: 420, height: 912))
    let part = UIView(frame: CGRect(x: 20, y: -20, width: 200, height: 30))
    window.addSubview(other)
    window.addSubview(scroll)
    scroll.addSubview(part)

    XCTAssertEqual(
      LayoutViewports.clips(of: part, in: window),
      [CGRect(x: 0, y: 100, width: 420, height: 600)])
  }

  /// A view that never reached the window or left it, or one under a screen that covers it, isn't
  /// on the screen; under a sheet it still is.
  @MainActor
  func testOnlyAViewInTheWindowAndNotUnderACoverIsOnScreen() {
    let window = UIWindow(frame: CGRect(x: 0, y: 0, width: 420, height: 912))
    let page = UIView(frame: window.bounds)
    let action = UIView(frame: CGRect(x: 16, y: 800, width: 388, height: 44))
    window.addSubview(page)
    page.addSubview(action)
    let cover = UIView(frame: window.bounds)
    let sheet = UIView(frame: CGRect(x: 0, y: 60, width: 420, height: 852))

    XCTAssertTrue(LayoutHosts.isOnScreen(action, in: window, top: page))
    XCTAssertFalse(LayoutHosts.isOnScreen(nil, in: window, top: page), "never in the window")

    window.addSubview(sheet)
    XCTAssertTrue(LayoutHosts.isOnScreen(action, in: window, top: sheet), "under a sheet")

    window.addSubview(cover)
    XCTAssertFalse(LayoutHosts.isOnScreen(action, in: window, top: cover), "under a cover")

    action.removeFromSuperview()
    XCTAssertFalse(LayoutHosts.isOnScreen(action, in: window, top: page), "left the window")
  }

  /// A row half scrolled out: its end can't be seen, so its chevron is unknown, never absent.
  func testARowHalfOutOfItsListHasAnEndNotMeasured() {
    let room = CGRect(x: 380, y: 90, width: 20, height: 44)

    XCTAssertEqual(
      LayoutSystemEnd.read(room: room, shown: false, ink: nil), .unreadable(clipped: true))
  }

  /// A row wholly on screen with nothing after its content has no accessory.
  func testAWholeRowWithNothingAfterItHasNoEnd() {
    XCTAssertEqual(
      LayoutSystemEnd.read(
        room: CGRect(x: 380, y: 200, width: 20, height: 44), shown: true, ink: nil),
      .none)
  }

  func testARightToLeftRowsEndIsNotRead() {
    XCTAssertEqual(
      LayoutSystemEnd.read(
        room: CGRect(x: 380, y: 200, width: 20, height: 44), shown: true, ink: nil,
        rightToLeft: true),
      .mirrored)
  }

  /// Each part counts once: a part no row holds, with its ink read, is still one not measured.
  func testCountsEachPartOnce() {
    let elements: [[String: Any]] = [
      ["part": "group", "ink": [0, 0, 420, 300]],
      ["part": "anchor", "anchor": "page/bar", "ink": "not measured"],
      ["part": "row", "piece": "list-group", "ink": [20, 100, 380, 20]],
      ["part": "row", "piece": "list-group", "ink": "not measured"],
      ["part": "value", "ink": [360, 100, 40, 16], "baseline": 112, "capTop": 103],
      ["part": "label", "ink": [52, 100, 100, 18], "baseline": "not measured"],
      ["part": "end", "piece": "unreported", "ink": [390, 102, 7, 12]],
    ]

    XCTAssertEqual(LayoutCounts.of(elements), ["parts": 1, "notMeasured": 3])
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
