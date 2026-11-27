import Foundation
import Observation

struct CompletedLesson: Equatable, Identifiable, Sendable {
  let lessonId: String
  let title: String
  let chapterTitle: String?
  /// The learner's calendar day of its latest finish, `YYYY-MM-DD`.
  let finishedOn: String
  let available: Bool
  var saved: Bool

  var id: String { lessonId }
}

struct CompletedLessonGroup: Equatable, Identifiable, Sendable {
  /// Names the group when the list is asked for its lessons alone.
  let key: String
  let name: String
  let lessons: Int

  var id: String { key }
}

/// What a goal's list narrows to: the plan's groups that have completed lessons, the one with the
/// most first. The same whichever group is shown.
struct CompletedLessonsFilter: Equatable, Sendable {
  enum Kind: Sendable {
    case subjects, modules, phases
  }

  let groups: [CompletedLessonGroup]
  let kind: Kind
  /// Every completed lesson, in a group or not.
  let total: Int
}

struct CompletedLessonsPage: Equatable, Sendable {
  var lessons: [CompletedLesson]
  var nextCursor: String?
  /// Nil while the list is short enough to read whole, or has lessons of fewer than two groups.
  var filter: CompletedLessonsFilter?
}

/// A goal's completed lessons, or only those of one of its plan's groups.
struct CompletedLessonsQuery: Hashable, Sendable {
  let goalId: String
  var group: String?
}

@MainActor
@Observable
final class CompletedLessonsStore {
  private(set) var loadMoreFailures: [CompletedLessonsQuery: APIError] = [:]

  @ObservationIgnored private let api: any CompletedLessonsAPIClient
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private var lists: [CompletedLessonsQuery: Resource<CompletedLessonsPage>] =
    [:]

  init(api: any CompletedLessonsAPIClient, cache: AppCache) {
    self.api = api
    self.cache = cache
  }

  func lessons(_ query: CompletedLessonsQuery) -> Resource<CompletedLessonsPage> {
    if let list = lists[query] {
      return list
    }

    let api = api
    let list: Resource<CompletedLessonsPage> = cache.resource(
      audience: .signedIn, domains: [.userProgress], isEmpty: \.lessons.isEmpty
    ) { session in
      guard let session else {
        return nil
      }

      return try await api.list(token: session.bearerToken, query: query, cursor: nil)
    }

    lists[query] = list
    return list
  }

  /// A save the server took, in every page read so far.
  func show(saved: Bool, lessonId: String) {
    for list in lists.values {
      guard
        list.value?.lessons.contains(where: { $0.lessonId == lessonId && $0.saved != saved })
          == true
      else {
        continue
      }

      list.update { page in
        var page = page
        page.lessons = page.lessons.map { lesson in
          var lesson = lesson
          if lesson.lessonId == lessonId {
            lesson.saved = saved
          }
          return lesson
        }
        return page
      }
    }
  }

  /// A replay moves its lesson to the top and shifts the pages after it, so a lesson already shown
  /// isn't added again; that also makes a second load of the same page harmless.
  func loadMore(_ query: CompletedLessonsQuery) async {
    let resource = lessons(query)

    guard case .loaded(let page) = resource.state, let cursor = page.nextCursor,
      let session = cache.session.authenticatedSession
    else {
      return
    }

    let revision = resource.revision
    loadMoreFailures[query] = nil

    do {
      let next = try await api.list(token: session.bearerToken, query: query, cursor: cursor)

      guard resource.revision == revision else {
        return
      }

      resource.update { current in
        var shown = Set(current.lessons.map(\.lessonId))

        return CompletedLessonsPage(
          lessons: current.lessons + next.lessons.filter { shown.insert($0.lessonId).inserted },
          nextCursor: next.nextCursor, filter: next.filter)
      }
    } catch APIError.unauthorized {
      await cache.session.expire(session)
    } catch {
      guard resource.revision == revision, !(error is CancellationError) else {
        return
      }

      loadMoreFailures[query] = error as? APIError ?? .unavailable
    }
  }
}

protocol CompletedLessonsAPIClient: Sendable {
  func list(token: String, query: CompletedLessonsQuery, cursor: String?) async throws
    -> CompletedLessonsPage
}

struct CompletedLessonsAPI: CompletedLessonsAPIClient {
  let clients: APIClientFactory

  func list(token: String, query: CompletedLessonsQuery, cursor: String?) async throws
    -> CompletedLessonsPage
  {
    try await clients.perform(token: token) { client in
      switch try await client.listCurrentUserCompletedLessons(
        query: .init(goalId: query.goalId, group: query.group, cursor: cursor))
      {
      case .ok(let response):
        let list = try response.body.json

        return CompletedLessonsPage(
          lessons: list.data.map { lesson in
            CompletedLesson(
              lessonId: lesson.lessonId, title: lesson.title, chapterTitle: lesson.chapterTitle,
              finishedOn: lesson.finishedOn, available: lesson.available, saved: lesson.saved)
          },
          nextCursor: list.pagination.nextCursor,
          filter: (list.filter?.value1).map(CompletedLessonsFilter.init))
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }
}

extension CompletedLessonsFilter {
  fileprivate init(_ filter: Components.Schemas.CompletedLessonFilter) {
    let kind: Kind =
      switch filter.kind {
      case .subjects: .subjects
      case .modules: .modules
      case .phases: .phases
      }

    self.init(
      groups: filter.groups.map { group in
        CompletedLessonGroup(key: group.key, name: group.name, lessons: group.lessons)
      },
      kind: kind, total: filter.total)
  }
}
