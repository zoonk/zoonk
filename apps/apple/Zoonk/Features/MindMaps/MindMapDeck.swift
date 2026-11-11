import Foundation

/// One map of a deck.
enum MindMapCard: Hashable, Sendable {
  case chapter(chapterId: String)
  case lesson(chapterId: String, lessonId: String)

  var chapterId: String {
    switch self {
    case .chapter(let chapterId), .lesson(let chapterId, _):
      chapterId
    }
  }

  /// What a resume position keeps: the map itself, not its place, so a deck that changed still
  /// opens at it.
  var mapKey: MindMapKey {
    switch self {
    case .chapter(let chapterId): MindMapKey(kind: .chapter, targetId: chapterId)
    case .lesson(_, let lessonId): MindMapKey(kind: .lesson, targetId: lessonId)
    }
  }
}

/// A tab's maps in syllabus order, as the reader pages through them. Locked maps and saves that
/// can't open are left out.
enum MindMapDeck {
  static func cards(tab: GoalMindMaps.Tab, maps: GoalMindMaps) -> [MindMapCard] {
    switch tab {
    case .chapters:
      return maps.chapters.filter { $0.status == .ready }.map { .chapter(chapterId: $0.chapterId) }
    case .lessons:
      return maps.lessonGroups.flatMap { group in
        group.lessonIds.map { MindMapCard.lesson(chapterId: group.chapterId, lessonId: $0) }
      }
    case .saved:
      return maps.saved.compactMap { save in
        guard save.available, let chapterId = save.chapterId else {
          return nil
        }

        switch save.kind {
        case .chapter:
          return maps.chapter(save.targetId)?.status == .ready
            ? .chapter(chapterId: save.targetId) : nil
        case .lesson:
          return .lesson(chapterId: chapterId, lessonId: save.targetId)
        }
      }
    }
  }

  /// Where a deck opens: the tapped map, else the last one read on this device, else the first. A
  /// chapter opens at its first map.
  static func start(
    in cards: [MindMapCard], at wanted: MindMapPosition?
  ) -> MindMapCard? {
    guard let wanted else {
      return cards.first
    }

    if let key = wanted.key, let card = cards.first(where: { $0.mapKey == key }) {
      return card
    }

    return cards.first { $0.chapterId == wanted.chapterId } ?? cards.first
  }
}

/// A place in a deck: a chapter, and which of its maps when it names one.
struct MindMapPosition: Codable, Equatable, Hashable, Sendable {
  let chapterId: String
  let kind: SavedMindMapKind?
  let targetId: String?

  init(chapterId: String, key: MindMapKey? = nil) {
    self.chapterId = chapterId
    kind = key?.kind
    targetId = key?.targetId
  }

  init(_ card: MindMapCard) {
    self.init(chapterId: card.chapterId, key: card.mapKey)
  }

  var key: MindMapKey? {
    guard let kind, let targetId else {
      return nil
    }

    return MindMapKey(kind: kind, targetId: targetId)
  }
}

/// Where each learner last was in each goal's tab, on this device only.
struct MindMapPositions {
  let defaults: UserDefaults

  init(defaults: UserDefaults = .standard) {
    self.defaults = defaults
  }

  func position(userId: String, goalId: String, tab: GoalMindMaps.Tab) -> MindMapPosition? {
    defaults.data(forKey: Self.key(userId: userId, goalId: goalId, tab: tab))
      .flatMap { try? JSONDecoder().decode(MindMapPosition.self, from: $0) }
  }

  func save(
    _ position: MindMapPosition?, userId: String, goalId: String, tab: GoalMindMaps.Tab
  ) {
    let key = Self.key(userId: userId, goalId: goalId, tab: tab)

    if let position, let data = try? JSONEncoder().encode(position) {
      defaults.set(data, forKey: key)
    } else {
      defaults.removeObject(forKey: key)
    }
  }

  private static func key(userId: String, goalId: String, tab: GoalMindMaps.Tab) -> String {
    "mindMapPosition.\(userId).\(goalId).\(tab.rawValue)"
  }
}
