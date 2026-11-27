import Foundation

protocol SavedLessonsAPIClient: Sendable {
  /// Newest save first.
  func list(token: String, goalId: String) async throws -> [SavedLesson]
  /// Desired state: saving twice keeps one save, and its first time. Answers whether it's saved now.
  func save(token: String, goalId: String, lessonId: String, saved: Bool) async throws -> Bool
}

struct SavedLessonsAPI: SavedLessonsAPIClient {
  let clients: APIClientFactory

  func list(token: String, goalId: String) async throws -> [SavedLesson] {
    try await clients.perform(token: token) { client in
      switch try await client.listSavedLessons(path: .init(goalId: goalId)) {
      case .ok(let response):
        return try response.body.json.lessons.map { lesson in
          SavedLesson(
            lessonId: lesson.lessonId, title: lesson.title, chapterTitle: lesson.chapterTitle,
            available: lesson.available)
        }
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }

  func save(token: String, goalId: String, lessonId: String, saved: Bool) async throws -> Bool {
    try await clients.perform(token: token) { client in
      let input = Components.Schemas.SaveLessonInput(lessonId: lessonId, saved: saved)

      switch try await client.saveLesson(
        path: .init(goalId: goalId), body: .json(input))
      {
      case .ok(let response): return try response.body.json.saved
      case .unauthorized: throw APIError.unauthorized
      case .notFound: throw APIError.notFound
      default: throw APIError.unavailable
      }
    }
  }
}
