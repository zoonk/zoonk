import XCTest

@testable import Zoonk

final class CertificateExampleTests: XCTestCase {
  func testNamesTheExamForTheTargetLanguage() {
    XCTAssertEqual(certificateExample(language: "es-MX", region: nil), "DELE")
    XCTAssertNil(certificateExample(language: "eo", region: nil))
    XCTAssertNil(certificateExample(language: nil, region: nil))
  }

  func testUsesThePortugueseCountryWithoutAssumingOne() {
    XCTAssertEqual(certificateExample(language: "pt", region: "BR"), "Celpe-Bras")
    XCTAssertEqual(certificateExample(language: "pt", region: "PT"), "CAPLE")
    XCTAssertEqual(certificateExample(language: "pt", region: "AO"), "ACTFL OPI")
    XCTAssertEqual(certificateExample(language: "pt", region: nil), "ACTFL OPI")
  }

  func testReadsTheCountryFromTheTagUnlessTheGoalSetsOne() {
    XCTAssertEqual(certificateExample(language: "pt-Latn-br", region: nil), "Celpe-Bras")
    XCTAssertEqual(certificateExample(language: "pt-Latn-br", region: "PT"), "CAPLE")
    XCTAssertEqual(certificateExample(language: "pt-Cyrl-BR", region: nil), "ACTFL OPI")
  }
}
