import Foundation

/// A `categorize` activity's fields: groups with the rule that sets them apart, and items with the
/// group each belongs in and why.
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

  /// Each item in the group the writer gave it.
  var expected: ActivityExpectedAnswer {
    .assignment(
      Dictionary(items.map { ($0.id, $0.groupId) }, uniquingKeysWith: { first, _ in first }))
  }

  /// The items in the order the learner sees them, the same as on the web.
  var shuffledItems: [Item] {
    SeededShuffle.shuffled(items, seed: items.map(\.id).joined(separator: " "))
  }
}

/// Which group each item sits in; items missing from it are still waiting to be sorted.
enum CategorizePlacements {
  static func unplaced(_ items: [CategorizeFields.Item], _ placements: [String: String])
    -> [CategorizeFields.Item]
  {
    items.filter { placements[$0.id] == nil }
  }

  /// The learner's answer once every item has a group, and nothing while some are left.
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

  /// Items in the wrong group, compared with the groups code computed from the fields.
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
