import XCTest

@testable import Zoonk

final class PlanEffectLinesTests: XCTestCase {
  func testTopicsDropTheNoticesItemNumbers() {
    XCTAssertEqual(planTopicWords("12 Noções de probabilidade"), "Noções de probabilidade")
    XCTAssertEqual(planTopicWords("5.7. Funções"), "Funções")
    XCTAssertEqual(planTopicWords("H18 - Identify the main idea"), "Identify the main idea")
    XCTAssertEqual(planTopicWords("2026 in numbers"), "2026 in numbers")
  }
}
