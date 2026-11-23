import Foundation

struct MatchPairsFields: Decodable, Hashable, Sendable {
  struct Pair: Decodable, Hashable, Sendable {
    let id: String
    let left: String
    let right: String
    let why: String?
  }

  let pairs: [Pair]

  var expected: ActivityExpectedAnswer {
    .assignment(Dictionary(pairs.map { ($0.id, $0.id) }, uniquingKeysWith: { first, _ in first }))
  }
}

struct MatchCard: Hashable, Sendable, Identifiable {
  let id: String
  let text: String
  let why: String?
}

/// Mirrors main's `match-pairs-columns` and `match-pairs-progress`.
enum MatchPairs {
  enum Side: String, Sendable {
    case left, right
  }

  struct Progress: Hashable, Sendable {
    var firstTries: [String: String] = [:]
    var matched: [String] = []
  }

  struct SolvedRow: Hashable, Sendable {
    let left: MatchCard
    let right: MatchCard
  }

  private static let maxAttempts = 32

  static func cards(_ fields: MatchPairsFields, side: Side) -> [MatchCard] {
    fields.pairs.map {
      MatchCard(id: $0.id, text: side == .left ? $0.left : $0.right, why: $0.why)
    }
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
    zip(left, right).contains { $0.id == $1.id }
  }

  static func solvedRows(left: [MatchCard], right: [MatchCard]) -> [SolvedRow] {
    let partners = Dictionary(right.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
    return left.compactMap { card in partners[card.id].map { SolvedRow(left: card, right: $0) } }
  }

  static func recordTry(_ progress: Progress, left: MatchCard, right: MatchCard) -> Progress {
    var next = progress

    if next.firstTries[left.id] == nil {
      next.firstTries[left.id] = right.id
    }

    if left.id == right.id {
      next.matched.append(left.id)
    }

    return next
  }

  static func answer(pairIds: [String], progress: Progress) -> ActivityAnswer? {
    guard pairIds.allSatisfy(progress.matched.contains) else {
      return nil
    }

    return .assignment(
      Dictionary(
        pairIds.map { ($0, progress.firstTries[$0] ?? $0) }, uniquingKeysWith: { first, _ in first }
      ))
  }

  static func progress(from answer: ActivityAnswer?) -> Progress {
    guard answer?.kind == "assignment", let pairs = answer?.pairs else {
      return Progress()
    }

    return Progress(firstTries: pairs, matched: Array(pairs.keys))
  }
}
