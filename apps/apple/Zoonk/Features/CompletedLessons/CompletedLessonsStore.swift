import Foundation
import Observation

struct CompletedLesson: Equatable, Identifiable, Sendable {
  let lessonId: String
  let title: String
  let chapterTitle: String?
  /// The learner's calendar day of its latest finish, `YYYY-MM-DD`.
  let finishedOn: String

  var id: String { lessonId }
}

struct CompletedLessonsPage: Equatable, Sendable {
  var lessons: [CompletedLesson]
  var nextCursor: String?
}

@MainActor
@Observable
final class CompletedLessonsStore {
  private(set) var loadMoreFailures: [String: APIError] = [:]

  @ObservationIgnored private let api: any CompletedLessonsAPIClient
  @ObservationIgnored private let cache: AppCache
  @ObservationIgnored private var lists: [String: Resource<CompletedLessonsPage>] = [:]

  init(api: any CompletedLessonsAPIClient, cache: AppCache) {
    self.api = api
    self.cache = cache
  }

  func lessons(goalId: String) -> Resource<CompletedLessonsPage> {
    if let list = lists[goalId] {
      return list
    }

    let api = api
    let list: Resource<CompletedLessonsPage> = cache.resource(
      audience: .signedIn, domains: [.userProgress], isEmpty: \.lessons.isEmpty
    ) { session in
      guard let session else {
        return nil
      }

      return try await api.list(token: session.bearerToken, goalId: goalId, cursor: nil)
    }

    lists[goalId] = list
    return list
  }

  /// A replay moves its lesson to the top and shifts the pages after it, so a lesson already shown
  /// isn't added again; that also makes a second load of the same page harmless.
  func loadMore(goalId: String) async {
    let resource = lessons(goalId: goalId)

    guard case .loaded(let page) = resource.state, let cursor = page.nextCursor,
      let session = cache.session.authenticatedSession
    else {
      return
    }

    let revision = resource.revision
    loadMoreFailures[goalId] = nil

    do {
      let next = try await api.list(token: session.bearerToken, goalId: goalId, cursor: cursor)

      guard resource.revision == revision else {
        return
      }

      resource.update { current in
        var shown = Set(current.lessons.map(\.lessonId))

        return CompletedLessonsPage(
          lessons: current.lessons + next.lessons.filter { shown.insert($0.lessonId).inserted },
          nextCursor: next.nextCursor)
      }
    } catch APIError.unauthorized {
      await cache.session.expire(session)
    } catch {
      guard resource.revision == revision, !(error is CancellationError) else {
        return
      }

      loadMoreFailures[goalId] = error as? APIError ?? .unavailable
    }
  }
}

protocol CompletedLessonsAPIClient: Sendable {
  func list(token: String, goalId: String, cursor: String?) async throws -> CompletedLessonsPage
}

struct CompletedLessonsAPI: CompletedLessonsAPIClient {
  let clients: APIClientFactory

  func list(token: String, goalId: String, cursor: String?) async throws -> CompletedLessonsPage {
    try await clients.perform(token: token) { client in
      switch try await client.listCurrentUserCompletedLessons(
        query: .init(goalId: goalId, cursor: cursor))
      {
      case .ok(let response):
        let list = try response.body.json

        return CompletedLessonsPage(
          lessons: list.data.map { lesson in
            CompletedLesson(
              lessonId: lesson.lessonId, title: lesson.title, chapterTitle: lesson.chapterTitle,
              finishedOn: lesson.finishedOn)
          },
          nextCursor: list.pagination.nextCursor)
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }
}
