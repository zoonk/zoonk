import Foundation

/// One map of a deck. A lesson map of the Lessons tab is known by its place in its chapter until
/// the chapter's lesson maps are read.
enum MindMapCard: Hashable, Sendable {
  case chapter(chapterId: String)
  case lesson(chapterId: String, lessonId: String)
  /// The `index`th lesson map of a chapter not read yet.
  case pendingLesson(chapterId: String, index: Int)

  var chapterId: String {
    switch self {
    case .chapter(let chapterId), .lesson(let chapterId, _), .pendingLesson(let chapterId, _):
      chapterId
    }
  }

  /// What a resume position keeps: the map itself, not its place, so a deck that changed still
  /// opens at it.
  var mapKey: MindMapKey? {
    switch self {
    case .chapter(let chapterId): MindMapKey(kind: .chapter, targetId: chapterId)
    case .lesson(_, let lessonId): MindMapKey(kind: .lesson, targetId: lessonId)
    case .pendingLesson: nil
    }
  }
}

/// A tab's maps in syllabus order, as the reader pages through them. Locked maps and saves that
/// can't open are left out.
enum MindMapDeck {
  /// `lessons` holds the chapters whose lesson maps were read; the others count on the list's
  /// numbers until they are.
  static func cards(
    tab: GoalMindMaps.Tab, maps: GoalMindMaps, lessons: [String: ChapterLessonMaps]
  ) -> [MindMapCard] {
    switch tab {
    case .chapters:
      return maps.chapters.filter { $0.status == .ready }.map { .chapter(chapterId: $0.chapterId) }
    case .lessons:
      return maps.lessonGroups.filter { $0.opens > 0 }.flatMap { group in
        if let read = lessons[group.chapterId] {
          return read.opening.map {
            MindMapCard.lesson(chapterId: group.chapterId, lessonId: $0.lessonId)
          }
        }

        return (0..<group.opens).map {
          MindMapCard.pendingLesson(chapterId: group.chapterId, index: $0)
        }
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
  /// chapter's lesson maps not read yet open at their first.
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

  /// The card a pending one became once its chapter was read, so the reader stays on it.
  static func resolve(_ card: MindMapCard, in cards: [MindMapCard]) -> MindMapCard? {
    guard case .pendingLesson(let chapterId, let index) = card, !cards.contains(card) else {
      return cards.contains(card) ? card : nil
    }

    let chapter = cards.filter { $0.chapterId == chapterId }
    return chapter.isEmpty ? nil : chapter[min(index, chapter.count - 1)]
  }
}

/// A map in a deck: the chapter to open it in and, once read, which map.
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
