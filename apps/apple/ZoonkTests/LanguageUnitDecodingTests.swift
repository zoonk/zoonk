import OpenAPIRuntime
import XCTest

@testable import Zoonk

final class LanguageUnitDecodingTests: XCTestCase {
  func testAUnitWithoutACharacterYetDecodes() throws {
    let generated = try JSONDecoder().decode(
      Components.Schemas.LanguageUnit.self, from: Data(unitWithoutCharacter.utf8))
    let unit: LanguageUnit = try PracticeJSON.recode(generated)

    XCTAssertNil(unit.conversation?.character)
    XCTAssertEqual(unit.conversation?.minutes, [1, 2])
  }

  func testAUnitWithAMatchingMistakeDecodes() throws {
    let generated = try JSONDecoder().decode(
      Components.Schemas.LanguageUnit.self,
      from: Data(unitWithoutCharacter.replacing(#""mistakes": []"#, with: matchingMistake).utf8))
    let unit: LanguageUnit = try PracticeJSON.recode(generated)

    XCTAssertEqual(unit.mistakes.first?.question, "Ligue cada palavra ao significado")
    XCTAssertNil(unit.mistakes.first?.correctAnswer)
    XCTAssertEqual(unit.mistakes.first?.skill, .words)
  }
}

/// A matching question's mistake has no single right answer.
private let matchingMistake = #"""
  "mistakes": [{"answer": "rent → aluguel; landlord → caução", "correctAnswer": null,
    "explanation": null, "id": "01a1864a-0abe-725b-acf7-bbd04b0068c0",
    "question": "Ligue cada palavra ao significado", "skill": "words"}]
  """#

private let unitWithoutCharacter = #"""
  {"canTestOut": true, "conversation": {"character": null, "defaultMinutes": 2, "limit": null, "minutes": [1, 2], "plusMinutes": [3, 5], "paused": false}, "goalId": "cf99ff41-0451-8a82-818a-bdb838af6ced", "grammarTips": [{"text": "Use `Is the rent per month?` to ask how often the rent is paid.", "title": "Como perguntar se o valor é por mês"}], "lessons": [{"done": false, "lessonId": "01a126ee-ad4a-7567-a576-dcfbdadf7dff", "minutes": 4, "state": "next", "title": "Aluguel mensal ou semanal", "written": true}, {"done": false, "lessonId": "01a126ee-ad4a-766c-9387-2525d158575a", "minutes": 3, "state": "upcoming", "title": "Total a pagar na entrada", "written": true}], "mistakes": [], "pattern": null, "pronunciation": null, "summaries": [], "unit": {"chapterId": "01a126ee-97eb-7681-87df-9cad3509001e", "description": "Perguntas em inglês para calcular o custo de entrada e acompanhar a cobrança do aluguel.", "levelRange": "A1–A2", "objectives": ["Distinguir o aluguel regular dos custos de entrada", "Confirmar vencimento, formas de pagamento e cobranças adicionais", "Questionar descontos e valores diferentes do anunciado"], "position": 5, "title": "Cobranças e pagamentos do aluguel"}, "words": {"count": 11, "sample": ["rent", "per month"]}}
  """#
