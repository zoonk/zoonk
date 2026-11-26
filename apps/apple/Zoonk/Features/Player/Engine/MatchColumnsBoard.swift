import Foundation

/// A match exercise's tiles, as far as the learner matched them. Tiles with the same label can't be
/// told apart, so each matched pair takes the first open tile with its label, and a pair is right
/// while the exercise has more of it than are matched, as core counts them.
struct MatchColumnsBoard {
  let pairs: [LessonAnswer.Pair]
  let rightItems: [String]
  let matched: [LessonAnswer.Pair]

  /// For each left tile, the place of the right tile it's matched with.
  var places: [Int?] {
    var places = [Int?](repeating: nil, count: pairs.count)
    var usedRight = Set<Int>()

    for pair in matched {
      guard
        let left = pairs.indices.first(where: { pairs[$0].left == pair.left && places[$0] == nil }),
        let right = rightItems.indices.first(where: {
          rightItems[$0] == pair.right && !usedRight.contains($0)
        })
      else { continue }

      places[left] = right
      usedRight.insert(right)
    }

    return places
  }

  var matchedLeft: Set<Int> {
    Set(places.indices.filter { places[$0] != nil })
  }

  var matchedRight: Set<Int> {
    Set(places.compactMap(\.self))
  }

  func isRight(_ pair: LessonAnswer.Pair) -> Bool {
    pairs.count { $0 == pair } > matched.count { $0 == pair }
  }
}
