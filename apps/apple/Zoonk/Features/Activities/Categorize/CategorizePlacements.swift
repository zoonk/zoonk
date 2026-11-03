import Foundation

struct CategorizeFields: Decodable, Hashable, Sendable {
  struct Group: Decodable, Hashable, Sendable, Identifiable {
    let id: String
    let label: String
    let rule: String
  }

  struct Item: Decodable, Hashable, Sendable, Identifiable {
    let groupId: String
    let id: String
    let text: String
    let why: String
  }

  let groups: [Group]
  let items: [Item]

  var expected: ActivityExpectedAnswer {
    .assignment(
      Dictionary(items.map { ($0.id, $0.groupId) }, uniquingKeysWith: { first, _ in first }))
  }

  /// The same order as on the web, which is also the order cards are dealt in.
  var shuffledItems: [Item] {
    SeededShuffle.shuffled(items, seed: items.map(\.id).joined(separator: " "))
  }
}

/// Where each card is, and the cards sorted while dealing (last one last) for Undo.
struct CategorizeSorting: Equatable, Sendable {
  private(set) var placements: [String: String]
  private(set) var history: [String] = []

  func cardInHand(from items: [CategorizeFields.Item]) -> CategorizeFields.Item? {
    items.first { placements[$0.id] == nil }
  }

  mutating func sort(_ itemId: String, into groupId: String) {
    placements[itemId] = groupId
    history.append(itemId)
  }

  /// Returns the card taken back, which is the card in hand again.
  mutating func undo() -> String? {
    guard let itemId = history.popLast() else {
      return nil
    }

    placements[itemId] = nil
    return itemId
  }

  /// Once every card is sorted. Undo only takes back cards while dealing, so the history stays.
  mutating func move(_ itemId: String, to groupId: String) {
    placements[itemId] = groupId
  }
}

enum CategorizePlacements {
  static func unplaced(_ items: [CategorizeFields.Item], _ placements: [String: String])
    -> [CategorizeFields.Item]
  {
    items.filter { placements[$0.id] == nil }
  }

  static func answer(_ items: [CategorizeFields.Item], _ placements: [String: String])
    -> ActivityAnswer?
  {
    guard unplaced(items, placements).isEmpty else {
      return nil
    }

    return .assignment(
      Dictionary(
        items.map { ($0.id, placements[$0.id] ?? "") }, uniquingKeysWith: { first, _ in first }))
  }

  static func misplaced(
    _ items: [CategorizeFields.Item], expected: [String: String], placements: [String: String]
  ) -> [CategorizeFields.Item] {
    items.filter { placements[$0.id] != expected[$0.id] }
  }
}
