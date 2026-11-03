import SwiftUI
import XCTest

@testable import Zoonk

/// The spoken words are the web's and Android's, in English (the simulator's language).
final class LessonMathTests: XCTestCase {
  private let gap = "\u{2005}"

  private func drawn(_ latex: String) -> String {
    String(LessonMath.typeset(latex).text.characters)
  }

  private func spoken(_ latex: String) -> String? {
    LessonMath.typeset(latex).spoken
  }

  private func offsets(_ latex: String) -> [(String, CGFloat)] {
    let typeset = LessonMath.typeset(latex).text

    return typeset.runs.map {
      (
        String(typeset[$0.range].characters),
        $0[AttributeScopes.SwiftUIAttributes.BaselineOffsetAttribute.self] ?? 0
      )
    }
  }

  func testRaisesExponentsAndLowersIndicesAndSaysThemInWords() {
    let runs = offsets("x^{2} + a_1")

    XCTAssertEqual(drawn("x^{2} + a_1"), "x2\(gap)+\(gap)a1")
    XCTAssertGreaterThan(runs.first { $0.0 == "2" }?.1 ?? 0, 0)
    XCTAssertLessThan(runs.first { $0.0 == "1" }?.1 ?? 0, 0)
    XCTAssertEqual(spoken("x^2"), "x squared")
    XCTAssertEqual(spoken("a^3"), "a cubed")
    XCTAssertEqual(spoken("x_1 + y_1"), "x sub 1 + y sub 1")
    XCTAssertEqual(spoken("2^{10}"), "2 to the power of 10")
    XCTAssertEqual(spoken(#"90^\circ"#), "90°")
  }

  func testReadsAScriptWrittenWithASpaceAfterItsMark() {
    XCTAssertEqual(drawn("x^ 2 + a_ {1}"), "x2\(gap)+\(gap)a1")
    XCTAssertGreaterThan(offsets("x^ 2").first { $0.0 == "2" }?.1 ?? 0, 0)
    XCTAssertEqual(spoken("x^ 2 + a_ {1}"), "x squared + a sub 1")
    XCTAssertEqual(spoken("x^\t2"), "x squared")
    XCTAssertEqual(spoken("x^\r\n2"), "x squared")
  }

  func testSetsFractionsWithASlashAndReadsThemAsOver() {
    XCTAssertEqual(
      drawn(#"\dfrac{30}{120} = \dfrac{1}{4} = 25\%"#),
      "30\u{2044}120\(gap)=\(gap)1\u{2044}4\(gap)=\(gap)25%")
    XCTAssertEqual(
      spoken(#"\dfrac{30}{120} = \dfrac{1}{4} = 25\%"#), "30 over 120 = 1 over 4 = 25%")
  }

  func testNamesARootByItsIndexAndSetsTheIndexRaised() {
    XCTAssertEqual(drawn(#"\sqrt[3]{8}"#), "3√8")
    XCTAssertGreaterThan(offsets(#"\sqrt[3]{8}"#).first { $0.0 == "3" }?.1 ?? 0, 0)
    XCTAssertEqual(spoken(#"\sqrt[3]{8}"#), "cube root of 8")
    XCTAssertEqual(spoken(#"\sqrt[4]{16}"#), "4th root of 16")
    XCTAssertEqual(spoken(#"\sqrt[2]{9}"#), "square root of 9")
    XCTAssertEqual(spoken("\\sqrt\t[3]{8}"), "cube root of 8")
    XCTAssertEqual(drawn(#"\sqrt{x+1} \leq \pi"#), "√(x\(gap)+\(gap)1)\(gap)≤\(gap)π")
    XCTAssertEqual(spoken(#"v = \sqrt{\frac{GM}{r}}"#), "v = square root of GM over r")
  }

  func testDrawsAndSaysTheAccentThatChangesWhatALetterMeans() {
    XCTAssertEqual(drawn(#"\bar{x}"#), "x\u{0304}")
    XCTAssertEqual(
      drawn(#"\vec{v} = \overrightarrow{AB}"#), "v\u{20D7}\(gap)=\(gap)A\u{20D7}B\u{20D7}")
    XCTAssertEqual(drawn(#"\hat p"#), "p\u{0302}")
    XCTAssertEqual(spoken(#"\bar{x}"#), "x bar")
    XCTAssertEqual(spoken(#"\vec{v} = \dot{x}"#), "vector v = x dot")
    XCTAssertEqual(spoken(#"\hat{p}"#), "p hat")
    XCTAssertEqual(spoken(#"\tilde{x}"#), "x tilde")
  }

  func testSpacesAFunctionFromWhatItAppliesTo() {
    let thin = "\u{2006}"

    XCTAssertEqual(drawn(#"\sin x"#), "sin\(thin)x")
    XCTAssertEqual(drawn(#"\sin{x}"#), "sin\(thin)x")
    XCTAssertEqual(drawn(#"\sin(x)"#), "sin(x)")
    XCTAssertEqual(spoken(#"\sin{x} + \cos(x)"#), "sin x + cos(x)")
  }

  func testSetsOperatorsApartAndKeepsASignWithItsNumber() {
    XCTAssertEqual(drawn(#"0.75 \times 80 = 60"#), "0.75\(gap)×\(gap)80\(gap)=\(gap)60")
    XCTAssertEqual(
      drawn("-3 + x^{-1} = (-2) - 1"),
      "−3\(gap)+\(gap)x−1\(gap)=\(gap)(−2)\(gap)−\(gap)1")
    XCTAssertEqual(drawn("e^{x+1}"), "ex+1")
    XCTAssertEqual(spoken(#"0.75 \cdot 80"#), "0.75 × 80")
  }

  func testKeepsTextUprightAndMarksUnderlinedDigits() {
    let underline = LessonMath.typeset(#"0.0\underline{5}3"#).text
    let underlined = underline.runs
      .filter { $0[AttributeScopes.SwiftUIAttributes.UnderlineStyleAttribute.self] != nil }
      .map { String(underline[$0.range].characters) }

    XCTAssertEqual(
      drawn(#"\text{R\$}\ 50 \div 10 = \text{R\$}\ 5"#), "R$ 50\(gap)÷\(gap)10\(gap)=\(gap)R$ 5")
    XCTAssertEqual(
      spoken(#"\lambda\ (\text{nm}) = \dfrac{1240}{E\ (\text{eV})}"#), "λ (nm) = 1240 over E (eV)")
    XCTAssertEqual(String(underline.characters), "0.053")
    XCTAssertEqual(underlined, ["5"])
  }

  func testAcceptsOverEscapedCommandsAsMainDoes() {
    XCTAssertEqual(drawn(#"a \\rightarrow b"#), drawn(#"a \rightarrow b"#))
  }

  func testKeepsUnknownCommandsReadable() {
    XCTAssertTrue(drawn(#"\unknown{x}"#).hasPrefix("unknown"))
  }

  @MainActor
  func testRichTextKeepsPricesAndSaysFormulasInWords() {
    let sentence = LessonRichText.typeset(#"So $\frac{1}{4} \times 80 = 20$ **now**"#)

    XCTAssertEqual(
      String(LessonRichText.typeset("It costs $5 and $10.").text.characters),
      "It costs $5 and $10.")
    XCTAssertNil(LessonRichText.typeset("It costs $5 and $10.").spoken)
    XCTAssertEqual(
      String(sentence.text.characters), "So 1\u{2044}4\(gap)×\(gap)80\(gap)=\(gap)20 now")
    XCTAssertEqual(sentence.spoken, "So 1 over 4 × 80 = 20 now")
  }
}
