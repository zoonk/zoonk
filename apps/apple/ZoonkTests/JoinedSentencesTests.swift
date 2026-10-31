import XCTest

@testable import Zoonk

final class JoinedSentencesTests: XCTestCase {
  func testJapaneseSentencesTakeNoSpace() {
    XCTAssertEqual(
      ["必要な学習時間です。", "学習できる日を増やすと、余裕が生まれます。"].joinedSentences(),
      "必要な学習時間です。学習できる日を増やすと、余裕が生まれます。")
    XCTAssertEqual(["勝った！", "次は？", "またね。"].joinedSentences(), "勝った！次は？またね。")
  }

  func testSpacedLanguagesTakeOneSpace() {
    XCTAssertEqual(
      ["More study days would help.", "Your plan moved."].joinedSentences(),
      "More study days would help. Your plan moved.")
    XCTAssertEqual(["시간이 더 필요해요.", "좋아요!"].joinedSentences(), "시간이 더 필요해요. 좋아요!")
  }

  func testMixedSentencesSpaceOnlyAfterHalfWidthEnds() {
    XCTAssertEqual(
      ["You won!", "勝った。", "Matched 2 of 3.", "惜しい"].joinedSentences(),
      "You won! 勝った。Matched 2 of 3. 惜しい")
  }

  func testEmptyAndOneSentence() {
    XCTAssertEqual([String]().joinedSentences(), "")
    XCTAssertEqual(["Alone."].joinedSentences(), "Alone.")
  }
}
