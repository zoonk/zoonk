extension Sequence<String> {
  /// Joins sentences with a space, but none after a full-width 。, ！ or ？: Japanese and Chinese
  /// don't space between sentences.
  func joinedSentences() -> String {
    var iterator = makeIterator()
    var text = iterator.next() ?? ""

    while let sentence = iterator.next() {
      text += (text.last.map { "。！？".contains($0) } == true ? "" : " ") + sentence
    }

    return text
  }
}
