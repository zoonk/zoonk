import XCTest

@testable import Zoonk

final class LessonQuestionPartsTests: XCTestCase {
  func testATableAndTheLinesAroundItGoAboveTheLinesThatAsk() {
    let parts = LessonQuestionParts(
      "Rosana percorre a mesma rota.\n\n| Velocidade | Tempo |\n|---|---|\n| 40 km/h | 3 horas |\n\nQuanto tempo ela levará?"
    )

    XCTAssertEqual(parts.question, "Quanto tempo ela levará?")
    XCTAssertEqual(
      RichTextBlock.parse(parts.data ?? ""),
      [
        .paragraph(lines: ["Rosana percorre a mesma rota."]),
        .table(
          header: ["Velocidade", "Tempo"], alignments: [.leading, .leading],
          rows: [["40 km/h", "3 horas"]]),
      ])
  }

  func testATableAfterTheQuestionStillGoesAboveIt() {
    XCTAssertEqual(
      LessonQuestionParts(
        "How many steps fit?\n\n| Interval | Duration |\n|---|---:|\n| Pulse | 1 ps |"),
      LessonQuestionParts(
        data: "| Interval | Duration |\n|---|---:|\n| Pulse | 1 ps |",
        question: "How many steps fit?"))
  }

  func testAQuestionWithoutATableStaysWhole() {
    XCTAssertEqual(
      LessonQuestionParts("Price | Shares\nWhich is higher?"),
      LessonQuestionParts(data: nil, question: "Price | Shares\nWhich is higher?"))
  }
}
