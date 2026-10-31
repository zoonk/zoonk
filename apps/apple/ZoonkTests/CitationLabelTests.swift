import XCTest

@testable import Zoonk

final class CitationLabelTests: XCTestCase {
  func testAMaterialCitationNamesItsSlideOrPage() {
    XCTAssertEqual(
      CitationLabel.material(title: "Aula 5 - Glicolise", page: 3, unit: "slide"),
      "Aula 5 - Glicolise, slide 3")
    XCTAssertEqual(
      CitationLabel.material(title: "Bioquímica", page: 12, unit: "page"), "Bioquímica, page 12")
    XCTAssertEqual(
      CitationLabel.material(title: "Notas", page: 2, unit: "section"), "Notas, page 2")
  }

  func testAMaterialCitationWithoutAPageIsItsTitle() {
    XCTAssertEqual(
      CitationLabel.material(title: "Bioquímica", page: nil, unit: "page"), "Bioquímica")
  }
}
