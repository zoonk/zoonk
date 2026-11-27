import Foundation
import Observation

struct SavedLesson: Equatable, Identifiable, Sendable {
  let lessonId: String
  /// The lesson's current title, or the one it had when saved once it can't open.
  let title: String
  let chapterTitle: String?
  /// False once it can't open anymore: it's listed apart, with Remove.
  let available: Bool

  var id: String { lessonId }
}

/// A lesson to save, with what Saved lessons shows of it before the list is read again.
struct LessonSaveTarget: Saveable {
  let lessonId: String
  let title: String
  let chapterTitle: String?

  var key: String { lessonId }
}

/// The lessons a learner saved to do again. One save per lesson, whichever goal it was saved from,
/// so its bookmark reads the same everywhere.
@MainActor
@Observable
final class SavedLessonsStore {
  let saves: Saves<LessonSaveTarget>
  /// What each lesson's run said when it started, for the player's bookmark, until a save the
  /// server took says otherwise.
  private(set) var runs: [Saves<LessonSaveTarget>.Pending: Bool] = [:]

  /// Shows a save the server took in the other lists read so far, such as Completed lessons.
  @ObservationIgnored var showElsewhere: @MainActor (_ lessonId: String, _ saved: Bool) -> Void = {
    _, _ in
  }

  @ObservationIgnored private let api: any SavedLessonsAPIClient
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private var lists: [String: Resource<[SavedLesson]>] = [:]

  init(api: any SavedLessonsAPIClient, cache: AppCache) {
    self.api = api
    self.cache = cache
    // The learner summary reads the saves too: its Saved lessons place shows once a goal lists one.
    saves = Saves(cache: cache, invalidating: [.savedLessons]) { token, goalId, lessonId, saved in
      try await api.save(token: token, goalId: goalId, lessonId: lessonId, saved: saved)
    }
    saves.show = { [weak self] target, saved, goalId in
      self?.show(saved, target: target, goalId: goalId)
    }
  }

  /// Newest save first. Never `empty`: the page keeps a row taken away while it shows, and says
  /// it's empty itself.
  func lessons(goalId: String) -> Resource<[SavedLesson]> {
    if let list = lists[goalId] {
      return list
    }

    let api = api
    let list: Resource<[SavedLesson]> = cache.resource(
      audience: .signedIn, domains: [.goals, .savedLessons, .userProgress]
    ) { session in
      guard let session else {
        return nil
      }

      return try await api.list(token: session.bearerToken, goalId: goalId)
    }

    lists[goalId] = list
    return list
  }

  func runStarted(lessonId: String, saved: Bool) {
    guard let session = cache.session.authenticatedSession else {
      return
    }

    runs[.init(session: session, key: lessonId)] = saved
  }

  /// What the lesson's run said, for this session; nil before a run started.
  func runSaved(lessonId: String) -> Bool? {
    guard let session = cache.session.authenticatedSession else {
      return nil
    }

    return runs[.init(session: session, key: lessonId)]
  }

  /// A new save is the newest in the goal it was saved from; one taken away leaves every list. The
  /// lists are read again after, for the goals whose plan holds it.
  private func show(_ saved: Bool, target: LessonSaveTarget, goalId: String) {
    for (listGoalId, list) in lists where list.value != nil {
      list.update { lessons in
        let others = lessons.filter { $0.lessonId != target.lessonId }

        guard saved, listGoalId == goalId else {
          return others
        }

        return [
          SavedLesson(
            lessonId: target.lessonId, title: target.title, chapterTitle: target.chapterTitle,
            available: true)
        ] + others
      }
    }

    if let session = cache.session.authenticatedSession {
      let run = Saves<LessonSaveTarget>.Pending(session: session, key: target.lessonId)

      if runs[run] != nil {
        runs[run] = saved
      }
    }

    showElsewhere(target.lessonId, saved)
  }
}
