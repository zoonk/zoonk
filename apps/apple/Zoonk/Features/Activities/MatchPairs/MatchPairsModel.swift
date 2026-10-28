import Foundation

struct MatchPairsFields: Decodable, Hashable, Sendable {
  struct Pair: Decodable, Hashable, Sendable {
    let id: String
    let left: String
    let right: String
    let why: String?
  }

  struct Distractor: Decodable, Hashable, Sendable {
    /// "left" or "right".
    let side: String
    let text: String
    let why: String
  }

  let distractors: [Distractor]
  let pairs: [Pair]

  /// Each left card goes with the right card of its own pair.
  var expected: ActivityExpectedAnswer {
    .assignment(Dictionary(pairs.map { ($0.id, $0.id) }, uniquingKeysWith: { first, _ in first }))
  }
}

/// One card in a column. Pair cards share their pair's id on both sides; traps have their own.
struct MatchCard: Hashable, Sendable, Identifiable {
  let id: String
  let isTrap: Bool
  let text: String
  let why: String?
}

/// The pure rules of matching pairs, as main's `match-pairs-columns` and `match-pairs-progress`.
enum MatchPairs {
  enum Side: String, Sendable {
    case left, right
  }

  /// Matched pairs (locked in), each pair's first try and the traps that caught the learner. Wrong
  /// tries explain themselves and can be retried, but the answer keeps each pair's first try, so
  /// finding it by elimination still teaches without counting as knowing it.
  struct Progress: Hashable, Sendable {
    var firstTries: [String: String] = [:]
    var matched: [String] = []
    var traps: [String] = []
  }

  private static let maxAttempts = 32

  static func cards(_ fields: MatchPairsFields, side: Side) -> [MatchCard] {
    let pairs = fields.pairs.map {
      MatchCard(id: $0.id, isTrap: false, text: side == .left ? $0.left : $0.right, why: $0.why)
    }

    let traps = fields.distractors.filter { $0.side == side.rawValue }.enumerated().map {
      index, distractor in
      MatchCard(
        id: "\(side.rawValue)-trap-\(index)", isTrap: true, text: distractor.text,
        why: distractor.why)
    }

    return pairs + traps
  }

  /// Both columns in a shuffled order that's the same on every load and on the web, with no pair
  /// side by side, since a lined-up pair gives its answer away.
  static func columns(_ fields: MatchPairsFields) -> (left: [MatchCard], right: [MatchCard]) {
    let seed = fields.pairs.map(\.id).joined(separator: " ")
    let left = SeededShuffle.shuffled(cards(fields, side: .left), seed: "left \(seed)")
    let rightCards = cards(fields, side: .right)

    let right =
      (0..<maxAttempts).lazy
      .map { SeededShuffle.shuffled(rightCards, seed: "right \($0) \(seed)") }
      .first { !hasAlignedPair(left, $0) } ?? rightCards

    return (left, right)
  }

  private static func hasAlignedPair(_ left: [MatchCard], _ right: [MatchCard]) -> Bool {
    left.enumerated().contains { index, card in
      !card.isTrap && index < right.count && right[index].id == card.id
    }
  }

  static func isMatch(_ left: MatchCard, _ right: MatchCard) -> Bool {
    !left.isTrap && left.id == right.id
  }

  /// Records a try: its first try if the left card is a real pair, the pair if it matches, and the
  /// trap if one caught the learner.
  static func recordTry(_ progress: Progress, left: MatchCard, right: MatchCard) -> Progress {
    var next = progress

    if !left.isTrap, next.firstTries[left.id] == nil {
      next.firstTries[left.id] = right.id
    }

    if isMatch(left, right) {
      next.matched.append(left.id)
    }

    next.traps += [left, right].filter(\.isTrap).map(\.id)
    return next
  }

  /// The answer once every pair is matched: each pair's first try.
  static func answer(pairIds: [String], progress: Progress) -> ActivityAnswer? {
    guard pairIds.allSatisfy(progress.matched.contains) else {
      return nil
    }

    return .assignment(
      Dictionary(
        pairIds.map { ($0, progress.firstTries[$0] ?? $0) }, uniquingKeysWith: { first, _ in first }
      ))
  }

  /// Rebuilds progress from a saved answer, for a screen the learner comes back to.
  static func progress(from answer: ActivityAnswer?) -> Progress {
    guard answer?.kind == "assignment", let pairs = answer?.pairs else {
      return Progress()
    }

    return Progress(firstTries: pairs, matched: Array(pairs.keys), traps: [])
  }

  /// Why two cards don't go together, from the writer's notes: the trap among them (the right one
  /// first) with its own reason, or else the reason on the pairs the learner mixed up.
  static func mismatch(left: MatchCard, right: MatchCard) -> (reason: String?, trap: MatchCard?) {
    let trap = [right, left].first(where: \.isTrap)
    return (trap?.why ?? right.why ?? left.why, trap)
  }
}
