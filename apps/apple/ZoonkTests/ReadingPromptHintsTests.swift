import XCTest

@testable import Zoonk

final class ReadingPromptHintsTests: XCTestCase {
  private func option(_ word: String, _ translation: String?) throws
    -> LanguageExercise.WordOption
  {
    let json = try JSONSerialization.data(withJSONObject: [
      "word": word, "translation": translation as Any? ?? NSNull(),
    ])
    return try JSONDecoder().decode(LanguageExercise.WordOption.self, from: json)
  }

  private func hints(_ prompt: String, _ options: [(String, String?)]) throws
    -> [ReadingPromptWord]
  {
    ReadingPromptHints.words(
      in: prompt, sentenceWordOptions: try options.map { try option($0.0, $0.1) })
  }

  func testEachPromptWordShowsTheSentenceWordItTranslates() throws {
    XCTAssertEqual(
      try hints(
        "Oi, como você está?", [("Hi,", "oi"), ("how", "como"), ("are", "são"), ("you?", "você")]),
      [
        ReadingPromptWord(word: "Oi,", translation: "Hi"),
        ReadingPromptWord(word: "como", translation: "how"),
        ReadingPromptWord(word: "você", translation: "you"),
        ReadingPromptWord(word: "está?", translation: "are"),
      ])
  }

  func testPromptWordsMatchWithoutPunctuationOrAccents() throws {
    XCTAssertEqual(
      try hints("Olá!", [("Hello!", "ola")]),
      [ReadingPromptWord(word: "Olá!", translation: "Hello")])
  }

  func testARepeatedWordUsesEachMatchOnce() throws {
    XCTAssertEqual(
      try hints("um um", [("a", "um"), ("one", "um")]),
      [
        ReadingPromptWord(word: "um", translation: "a"),
        ReadingPromptWord(word: "um", translation: "one"),
      ])
  }

  func testWordsLeftOverPairUpInOrderAfterTheExactMatches() throws {
    XCTAssertEqual(
      try hints(
        "Tenha um bom dia!", [("Have", "ter"), ("a", "um"), ("nice", "legal"), ("day!", "dia")]),
      [
        ReadingPromptWord(word: "Tenha", translation: "Have"),
        ReadingPromptWord(word: "um", translation: "a"),
        ReadingPromptWord(word: "bom", translation: "nice"),
        ReadingPromptWord(word: "dia!", translation: "day"),
      ])
  }

  func testWordsWithoutASentenceWordLeftStayPlain() throws {
    XCTAssertEqual(
      try hints("Eu gosto de café.", [("I", "eu"), ("like", "gosto"), ("coffee.", nil)]),
      [
        ReadingPromptWord(word: "Eu", translation: "I"),
        ReadingPromptWord(word: "gosto", translation: "like"),
        ReadingPromptWord(word: "de", translation: nil),
        ReadingPromptWord(word: "café.", translation: nil),
      ])
  }

  func testVowelSignsStayOnTheWordsTheyTellApart() throws {
    XCTAssertEqual(
      try hints("काम कम", [("little", "कम"), ("work", "काम")]),
      [
        ReadingPromptWord(word: "काम", translation: "work"),
        ReadingPromptWord(word: "कम", translation: "little"),
      ])
    XCTAssertEqual(
      try hints("Hello, good!", [("नमस्ते,", "hello"), ("ดี!", "good")]),
      [
        ReadingPromptWord(word: "Hello,", translation: "नमस्ते"),
        ReadingPromptWord(word: "good!", translation: "ดี"),
      ])
  }

  func testASentenceInQuotesLosesThemUnlessQuotesInsideWouldStandAlone() {
    XCTAssertEqual(ReadingPromptHints.stripWrappingQuotes("  \"hello there\"  "), "hello there")
    XCTAssertEqual(ReadingPromptHints.stripWrappingQuotes("“hello there”"), "hello there")
    XCTAssertEqual(ReadingPromptHints.stripWrappingQuotes("\"hello there"), "\"hello there")
    XCTAssertEqual(
      ReadingPromptHints.stripWrappingQuotes("He said \"wait\" and left."),
      "He said \"wait\" and left.")
    XCTAssertEqual(ReadingPromptHints.stripWrappingQuotes("\""), "\"")
    XCTAssertEqual(ReadingPromptHints.stripWrappingQuotes("'It's ready'"), "It's ready")
    XCTAssertEqual(ReadingPromptHints.stripWrappingQuotes("‘It’s ready’"), "It’s ready")
    let quoted = "\"this\" should preserve quotes in the first and last \"words\""
    XCTAssertEqual(ReadingPromptHints.stripWrappingQuotes(quoted), quoted)
  }

  func testWordsKeepTheirPunctuationAndTextWithoutSpacesSplitsAtWordBoundaries() {
    XCTAssertEqual(
      ReadingPromptHints.segmentWords("Yo veo un gato."), ["Yo", "veo", "un", "gato."])
    XCTAssertEqual(ReadingPromptHints.segmentWords("a  b  c"), ["a", "b", "c"])
    XCTAssertEqual(
      ReadingPromptHints.segmentWords("Comment allez-vous ?"), ["Comment", "allez-vous?"])
    XCTAssertEqual(
      ReadingPromptHints.segmentWords("Oui , je suis là !"), ["Oui,", "je", "suis", "là!"])
    XCTAssertEqual(ReadingPromptHints.segmentWords("gato-prueba"), ["gato-prueba"])
    XCTAssertEqual(ReadingPromptHints.segmentWords("gato-123"), ["gato-123"])
    XCTAssertEqual(ReadingPromptHints.segmentWords("l'heure"), ["l'heure"])
    XCTAssertEqual(ReadingPromptHints.segmentWords("¿Hola?"), ["¿Hola?"])
    XCTAssertEqual(ReadingPromptHints.segmentWords("猫"), ["猫"])
    XCTAssertEqual(ReadingPromptHints.segmentWords(""), [])

    XCTAssertEqual(ReadingPromptHints.segmentWords("Oui ! ?"), ["Oui!?"])
    XCTAssertEqual(ReadingPromptHints.segmentWords("  ! Oi"), ["!", "Oi"])
  }

  func testJapaneseSplitsAtTheWordsMainsSegmenterFinds() throws {
    XCTAssertEqual(ReadingPromptHints.segmentWords("あのきれいな花"), ["あの", "きれい", "な", "花"])
    XCTAssertEqual(
      ReadingPromptHints.segmentWords("私は新幹線に乗ります。"), ["私", "は", "新幹線", "に", "乗り", "ます。"])
    XCTAssertEqual(
      try hints(
        "新幹線に乗ります。", [("I", nil), ("take", "乗る"), ("the", nil), ("train.", "新幹線")]),
      [
        ReadingPromptWord(word: "新幹線", translation: "train"),
        ReadingPromptWord(word: "に", translation: "take"),
        ReadingPromptWord(word: "乗り", translation: nil),
        ReadingPromptWord(word: "ます。", translation: nil),
      ])
  }
}
