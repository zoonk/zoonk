import XCTest

@testable import Zoonk

final class BigQuantityTests: XCTestCase {
  func testAPlusAfterANumberReadsWithIt() {
    XCTAssertEqual(BigQuantity.parts("10+ years").map(\.text), ["10+", " years"])
    XCTAssertEqual(BigQuantity.parts("+5 min").map(\.text), ["+5", " min"])
  }
}
