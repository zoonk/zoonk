import Foundation

/// A match exercise's tiles, as far as the learner matched them. Tiles with the same label can't be
/// told apart, so each matched pair takes the first open tile with its label, and a pair is right
/// while the exercise has more of it than are matched, as core counts them.
struct MatchColumnsBoard {
  let pairs: [LessonAnswer.Pair]
  let rightItems: [String]
  let matched: [LessonAnswer.Pair]

  var matchedLeft: Set<Int> {
    Self.taken(pairs.map(\.left), by: matched.map(\.left))
  }

  var matchedRight: Set<Int> {
    Self.taken(rightItems, by: matched.map(\.right))
  }

  func isRight(_ pair: LessonAnswer.Pair) -> Bool {
    pairs.count { $0 == pair } > matched.count { $0 == pair }
  }

  private static func taken(_ labels: [String], by matched: [String]) -> Set<Int> {
    var open = Dictionary(matched.map { ($0, 1) }, uniquingKeysWith: +)
    var taken: Set<Int> = []

    for (index, label) in labels.enumerated() where open[label, default: 0] > 0 {
      open[label, default: 0] -= 1
      taken.insert(index)
    }

    return taken
  }
}
