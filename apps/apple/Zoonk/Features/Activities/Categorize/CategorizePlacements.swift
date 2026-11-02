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

  /// The same order as on the web.
  var shuffledItems: [Item] {
    SeededShuffle.shuffled(items, seed: items.map(\.id).joined(separator: " "))
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

  /// The next item to sort after one is placed: the one after it, wrapping around, so focus keeps
  /// moving forward through what's left.
  static func nextUnplacedId(
    _ items: [CategorizeFields.Item], placedId: String, placements: [String: String]
  ) -> String? {
    guard let index = items.firstIndex(where: { $0.id == placedId }) else {
      return unplaced(items, placements).first?.id
    }

    let ordered = Array(items[(index + 1)...] + items[...index])
    return unplaced(ordered, placements).first?.id
  }
}
