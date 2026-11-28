import XCTest

@testable import Zoonk

final class PlanToolAnswerTests: XCTestCase {
  func testSaveWaitsForTheLearnersChoiceAndASetupLessonsDevice() throws {
    XCTAssertNil(ToolAnswer(choice: nil, system: nil))
    XCTAssertNil(ToolAnswer(choice: .setup, system: nil))

    let setup = try XCTUnwrap(ToolAnswer(choice: .setup, system: "linux"))
    XCTAssertEqual(setup.choice, .setup)
    XCTAssertEqual(setup.system, "linux")

    let have = try XCTUnwrap(ToolAnswer(choice: .have, system: "linux"))
    XCTAssertEqual(have.choice, .have)
    XCTAssertNil(have.system, "only a setup lesson sends a device")
  }
}
