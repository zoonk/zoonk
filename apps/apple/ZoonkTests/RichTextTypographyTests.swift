import XCTest

@testable import Zoonk

final class RichTextTypographyTests: XCTestCase {
  private let english = Locale(identifier: "en")
  private let portuguese = Locale(identifier: "pt")
  private let german = Locale(identifier: "de")

  func testGroupsLongNumbersTheLearnersWay() {
    XCTAssertEqual(
      RichTextTypography.typesetNumbers(
        "Um quilo de gordura guarda 350000 kcal.", locale: portuguese),
      "Um quilo de gordura guarda 350.000\u{00A0}kcal.")
    XCTAssertEqual(
      RichTextTypography.typesetNumbers("About 12000 people, in 2026.", locale: english),
      "About 12,000 people, in 2026.")
    XCTAssertEqual(
      RichTextTypography.typesetNumbers("602214076000000000000000 molecules", locale: english),
      "602,214,076,000,000,000,000,000 molecules")
  }

  func testKeepsANumberWithItsUnitOrCurrencyOnOneLine() {
    XCTAssertEqual(
      RichTextTypography.typesetNumbers("uma marcada 3 Ω e outra 6 Ω", locale: portuguese),
      "uma marcada 3\u{00A0}Ω e outra 6\u{00A0}Ω")
    XCTAssertEqual(
      RichTextTypography.typesetNumbers("custa R$ 80 e pesa 2 kg", locale: portuguese),
      "custa R$\u{00A0}80 e pesa 2\u{00A0}kg")
    XCTAssertEqual(
      RichTextTypography.typesetNumbers("kostet € 20", locale: german), "kostet €\u{00A0}20")
  }

  func testWritesMoneyTheWayTheReadoutsAndAnswersBesideItDo() {
    XCTAssertEqual(
      RichTextTypography.typesetNumbers(
        "Slide the discount on the R$ 80 T-shirt. The line drops R$ 8 for every 10%.",
        locale: english),
      "Slide the discount on the R$80 T-shirt. The line drops R$8 for every 10%.")
    XCTAssertEqual(
      RichTextTypography.typesetNumbers("US$ 5 or £ 4", locale: english), "US$5 or £4")
    XCTAssertEqual(
      RichTextTypography.typesetNumbers("R$ 60", locale: english),
      ActivityNumberFormat.format(60, unit: "R$", locale: english))
    XCTAssertEqual(
      RichTextTypography.typesetNumbers("R$ 60", locale: portuguese),
      ActivityNumberFormat.format(60, unit: "R$", locale: portuguese))
  }

  func testLeavesAPostalCodeAloneAfterItsLabelOrAStatesCode() {
    let text =
      "Write to San Francisco, CA 94103, ZIP code 94103, PLZ 10115 or code postal 75001."

    XCTAssertEqual(RichTextTypography.typesetNumbers(text, locale: english), text)
    XCTAssertEqual(
      RichTextTypography.typesetNumbers("CA has 39000 schools.", locale: english),
      "CA has 39,000 schools.")
    XCTAssertEqual(
      RichTextTypography.typesetNumbers("The UK 12000 and NO 50000 counts.", locale: english),
      "The UK 12,000 and NO 50,000 counts.")
  }

  func testLeavesDecimalsCodesYearsAndNumbersBeforeLongerWordsAlone() {
    let text = "1,5 mais 12345,67 no CEP 01310-100 em 2026 com 5 pessoas e ID 123456789a"
    XCTAssertEqual(RichTextTypography.typesetNumbers(text, locale: portuguese), text)
  }

  func testLeavesInlineCodeAsWritten() throws {
    let text = try AttributedString(
      markdown: "`12000` is **12000**", options: .init(interpretedSyntax: .inlineOnly))

    XCTAssertEqual(
      String(RichTextTypography.typesetNumbers(in: text, locale: english).characters),
      "12000 is 12,000")
  }

  @MainActor
  func testLessonAndItemTextTypesetTheirNumbers() {
    let grouped = 350_000.formatted(
      .number.locale(Locale(identifier: currentCourseCatalogLanguage())))

    XCTAssertEqual(LessonRichText.plain("About 350000 people"), "About \(grouped) people")
    XCTAssertEqual(ItemTextBlock.plain("About 350000 people"), "About \(grouped) people")
    XCTAssertEqual(ItemTextBlock.asWritten("**About** 350000 people"), "About 350000 people")
  }
}
