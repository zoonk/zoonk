import XCTest

@testable import Zoonk

@MainActor
final class ActivityWorkTests: XCTestCase {
  func testMissingOptionalWorkUsesTheCanvassInitialValue() {
    let work = ActivityWork()
    let cell: Int?? = work.value("activeCell")
    guard case .none = cell else {
      return XCTFail("An absent cell must not replace the canvas's first empty cell with nil")
    }
    let links: [String]?? = work.value("learnerLinks")
    guard case .none = links else {
      return XCTFail("Absent links must not replace the learner's empty links with the example")
    }
  }

  func testAnExplicitNilIsKeptInsteadOfTheCanvassInitialValue() {
    let work = ActivityWork()
    work.set(3 as Int?, for: "activeCell")
    work.set(nil as Int?, for: "activeCell")
    let cell: Int?? = work.value("activeCell")
    guard case .some(.none) = cell else {
      return XCTFail("Finishing the grid must keep no active cell")
    }
  }
}
