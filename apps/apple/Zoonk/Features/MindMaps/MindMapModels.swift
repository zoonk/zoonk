import Foundation

struct ChapterMindMap: Decodable, Equatable, Identifiable, Sendable {
  enum Status: String, Decodable, Sendable {
    case available
    case drawing
    case failed
    /// The chapter's lessons are Plus-only for this learner, so its map is too.
    case plusRequired
    case ready
    /// A language's unit, or nothing in its outline to draw from: no row at all.
    case unavailable
    case writingLessons

    var isOnItsWay: Bool {
      self == .writingLessons || self == .drawing
    }
  }

  struct Image: Decodable, Equatable, Sendable {
    let height: Int
    let thumbnailUrl: String?
    let url: String
    let width: Int
  }

  struct Outline: Decodable, Equatable, Sendable {
    struct Branch: Decodable, Equatable, Hashable, Sendable {
      let explanation: String
      let points: [String]
      let title: String
    }

    /// Two to five things the chapter sets side by side.
    struct Comparison: Decodable, Equatable, Sendable {
      struct Column: Decodable, Equatable, Hashable, Sendable {
        let name: String
        let points: [String]
      }

      let columns: [Column]
      let title: String
    }

    let branches: [Branch]
    let centralIdea: String
    let comparison: Comparison?
    let summary: String
    let title: String
  }

  struct Subject: Decodable, Equatable, Sendable {
    let key: String
    let name: String
  }

  let chapterId: String
  let image: Image?
  /// The chapter's lessons not written yet, which making its map writes first.
  let lessonsToWrite: Int
  let outline: Outline?
  let position: Int
  let saved: Bool
  let status: Status
  let subject: Subject?
  let title: String

  var id: String { chapterId }

  func saving(_ saved: Bool) -> Self {
    Self(
      chapterId: chapterId, image: image, lessonsToWrite: lessonsToWrite, outline: outline,
      position: position, saved: saved, status: status, subject: subject, title: title)
  }
}

/// A chapter with written lesson maps, as the Lessons tab lists it.
struct LessonMapGroup: Decodable, Equatable, Sendable {
  let chapterId: String
  /// Locked ones included.
  let count: Int
  /// How many of them a free exam plan past its first week keeps for Plus.
  let locked: Int
  /// The ones that open, in chapter order: a reader opened with this list keeps these.
  let lessonIds: [String]

  var opens: Int { lessonIds.count }
}

enum SavedMindMapKind: String, Codable, Hashable, Sendable {
  case chapter, lesson
}

/// Which map: a chapter's, or a lesson's.
struct MindMapKey: Hashable, Sendable {
  let kind: SavedMindMapKind
  let targetId: String
}

struct SavedMindMap: Decodable, Equatable, Sendable {
  /// False once it can't open here anymore: it's listed last, with Remove.
  let available: Bool
  /// The chapter it opens in; for a lesson, the first chapter of the goal that holds it.
  let chapterId: String?
  let kind: SavedMindMapKind
  let targetId: String
  let title: String

  var key: MindMapKey { MindMapKey(kind: kind, targetId: targetId) }
}

/// What "Create all chapter maps" would start now.
struct MindMapCreateOffer: Decodable, Equatable, Sendable {
  /// Chapters without a ready map or one on its way whose lessons are all written.
  let eligible: Int
  /// Chapters without a map whose lessons aren't all written: each writes them from its own row.
  let needLessons: Int
  /// How many of `eligible` one tap would start now.
  let startable: Int
  let stop: MindMapAllowanceStop?
}

/// Why the learner's allowance stops a map from starting. The monthly number is never sent.
struct MindMapAllowanceStop: Decodable, Equatable, Sendable {
  enum Reason: String, Decodable, Sendable {
    case limitReached, slowDown, signUpRequired
  }

  enum Resource: String, Decodable, Sendable {
    case aiSpend, mindMap
  }

  let period: HelpLimit.Period?
  let reason: Reason
  let resetsAt: Date?
  let resource: Resource?

  func limit(tier: LearnerTier, now: Date = .now) -> MindMapLimit {
    let limit: HelpLimit =
      switch reason {
      case .signUpRequired: .signUpRequired
      case .slowDown:
        .slowDown(retryAfterSeconds: max(1, Int((resetsAt ?? now).timeIntervalSince(now))))
      case .limitReached: .limitReached(period: period ?? .day, tier: tier)
      }

    return MindMapLimit(limit: limit, resource: resource == .aiSpend ? .aiSpend : .mindMap)
  }
}

extension HelpLimit.Period: Decodable {}

struct GoalMindMaps: Decodable, Equatable, Sendable {
  enum Tab: String, Decodable, Hashable, Sendable, CaseIterable {
    case chapters, lessons, saved
  }

  /// Every chapter of the goal that can have a map, in syllabus order.
  let chapters: [ChapterMindMap]
  let createOffer: MindMapCreateOffer
  /// The server's pick of the tab to open on: never `saved`.
  let firstTab: Tab
  /// In the order of `chapters`, only those with lesson maps.
  let lessonGroups: [LessonMapGroup]
  /// Open ones first in syllabus order, then the ones that can no longer open.
  let saved: [SavedMindMap]

  /// A save that can no longer open still shows, so the learner can remove it.
  var isEmpty: Bool {
    chapters.isEmpty && saved.isEmpty
  }

  func chapter(_ id: String) -> ChapterMindMap? {
    chapters.first { $0.chapterId == id }
  }
}

/// A chapter's lesson maps, every written lesson's, in chapter order.
struct ChapterLessonMaps: Decodable, Equatable, Sendable {
  struct Chapter: Decodable, Equatable, Sendable {
    let id: String
    let position: Int
    let title: String
  }

  struct Lesson: Decodable, Equatable, Identifiable, Sendable {
    let lessonId: String
    let locked: Bool
    /// Nil while it's locked.
    let map: LessonSummary?
    let position: Int
    let saved: Bool
    let title: String

    var id: String { lessonId }

    func saving(_ saved: Bool) -> Self {
      Self(
        lessonId: lessonId, locked: locked, map: map, position: position, saved: saved, title: title
      )
    }
  }

  let chapter: Chapter
  let lessons: [Lesson]
}

/// Main's `MindMapLimit`, and what ran out: the maps, the lessons a map writes first, or the day's
/// AI spend.
struct MindMapLimit: Equatable, Sendable {
  enum Resource: Hashable, Sendable {
    case aiSpend, lessons, mindMap
  }

  let limit: HelpLimit
  let resource: Resource
}

/// What a tap or following a run got that the map's own status doesn't say. It stands for the read
/// it appeared over: a newer read of the map that comes through clears it.
enum MindMapRequestFailure: Equatable, Sendable {
  case refused(MindMapLimit)
  case unreachable
}

enum MindMapRequest: Equatable, Sendable {
  /// Ready, on its way, Plus-only or a chapter without one: reading it again says which.
  case read
  case refused(MindMapLimit)
}
