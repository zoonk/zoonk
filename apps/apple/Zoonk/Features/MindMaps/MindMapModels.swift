import Foundation

struct ChapterMindMap: Decodable, Equatable, Identifiable, Sendable {
  enum Status: String, Decodable, Sendable {
    case available
    case drawing
    case failed
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
  let count: Int
  /// In chapter order: a reader opened with this list keeps these.
  let lessonIds: [String]
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
  /// How many of `eligible` one tap would start now, a failed map's free retry included.
  let startable: Int
  /// What stops a new map now; nil while the allowance has room for one more.
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

  let availableAt: Date?
  let period: String?
  let reason: Reason
  let resource: Resource?

  /// Its instant has passed by this device's clock, so the page reads the list again; the stop
  /// holds until a read says it's gone.
  func isOver(at now: Date) -> Bool {
    availableAt.map { $0 <= now } ?? false
  }

  func limit(tier: LearnerTier, now: Date = .now) -> MindMapLimit {
    let limit: HelpLimit =
      switch reason {
      case .signUpRequired: .signUpRequired
      case .slowDown:
        .slowDown(retryAfterSeconds: max(1, Int((availableAt ?? now).timeIntervalSince(now))))
      // A day already past here can't be told: the stop shows no day until a read lifts it.
      case .limitReached:
        .reached(
          period: period, tier: tier, availableAt: availableAt.flatMap { $0 > now ? $0 : nil })
      }

    let ranOut: MindMapLimit.Resource =
      switch resource {
      case .aiSpend: .aiSpend
      case .mindMap, nil: .mindMap
      }

    return MindMapLimit(limit: limit, resource: ranOut)
  }
}

struct GoalMindMaps: Decodable, Equatable, Sendable {
  /// The list as a refusal answered it: nothing starts until a read says otherwise.
  func stopped(by stop: MindMapAllowanceStop) -> GoalMindMaps {
    GoalMindMaps(
      chapters: chapters,
      createOffer: MindMapCreateOffer(eligible: createOffer.eligible, startable: 0, stop: stop),
      firstTab: firstTab, lessonGroups: lessonGroups, saved: saved)
  }

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
  /// A list with nothing in it but a stop is still a list: the page's empty state reads the stop.
  var isEmpty: Bool {
    chapters.isEmpty && saved.isEmpty && createOffer.stop == nil
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
    let map: LessonSummary
    let position: Int
    let saved: Bool
    let title: String

    var id: String { lessonId }

    func saving(_ saved: Bool) -> Self {
      Self(
        lessonId: lessonId, map: map, position: position, saved: saved, title: title)
    }
  }

  let chapter: Chapter
  let lessons: [Lesson]
}

/// Main's `MindMapLimit`, and what ran out: the maps, the lessons a map writes first (one start, or
/// the whole map's that don't fit), or the day's AI spend.
struct MindMapLimit: Equatable, Sendable {
  enum Resource: Hashable, Sendable {
    case aiSpend, chapterLessons, lessons, mindMap
  }

  let limit: HelpLimit
  let resource: Resource

  /// The page's stop when this refusal stops every new map (the maps cap, the day's AI spend, a
  /// guest's account); a map's own lessons or a short break stop only its row.
  var pageStop: MindMapAllowanceStop? {
    let ranOut: MindMapAllowanceStop.Resource
    switch resource {
    case .mindMap: ranOut = .mindMap
    case .aiSpend: ranOut = .aiSpend
    case .chapterLessons, .lessons: return nil
    }

    let period: String
    switch limit {
    case .usedUp: period = "rolling30Days"
    case .limitReached(.day, _): period = "day"
    case .limitReached(.total, _): period = "total"
    case .signUpRequired:
      return MindMapAllowanceStop(
        availableAt: nil, period: nil, reason: .signUpRequired, resource: ranOut)
    case .slowDown: return nil
    }

    return MindMapAllowanceStop(
      availableAt: limit.availableAt, period: period, reason: .limitReached, resource: ranOut)
  }
}

/// What a tap or following a run got that the map's own status doesn't say. It stands for the read
/// it appeared over: a newer read of the map that comes through clears it.
enum MindMapRequestFailure: Equatable, Sendable {
  case refused(MindMapLimit)
  case unreachable

  /// A refusal while it holds; a cap's day that has come ends it, and the server decides again.
  func holdingLimit(at now: Date) -> MindMapLimit? {
    guard case .refused(let refusal) = self, !refusal.limit.isOpen(at: now) else {
      return nil
    }

    return refusal
  }

  /// The refusal takes Create's place while it holds, except a short break: the learner taps
  /// again once it passes.
  func hidesCreate(at now: Date) -> Bool {
    holdingLimit(at: now).map { !$0.limit.isShortBreak } ?? false
  }
}

enum MindMapRequest: Equatable, Sendable {
  /// Ready, on its way or a chapter without one: reading it again says which.
  case read
  case refused(MindMapLimit)
}
