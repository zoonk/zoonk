import Foundation
import OpenAPIRuntime

enum MyCoursesAPIError: Error, Equatable, Sendable {
  case network
  case unauthorized
  case unavailable
}

protocol MyCoursesAPIClient: Sendable {
  func listCourses(request: MyCoursesRequest) async throws -> MyCoursesPage
  func listTracks(cursor: String?, token: String) async throws -> MyTracksPage
}

struct MyCoursesAPI: MyCoursesAPIClient, @unchecked Sendable {
  private let clients: APIClientFactory

  init(clients: APIClientFactory) {
    self.clients = clients
  }

  func listCourses(request: MyCoursesRequest) async throws -> MyCoursesPage {
    try await perform(
      (
        token: request.token,
        operation: { client in
          let output = try await client.listCurrentUserCourses(
            .init(
              query: .init(
                cursor: request.query.cursor, limit: request.query.limit,
                query: request.query.query, standaloneOnly: ._true
              )))

          switch output {
          case .ok(let response):
            return makeMyCoursesPage(try response.body.json)
          case .unauthorized:
            throw MyCoursesAPIError.unauthorized
          case .badRequest, .internalServerError, .undocumented:
            throw MyCoursesAPIError.unavailable
          }
        }
      ))
  }

  func listTracks(cursor: String?, token: String) async throws -> MyTracksPage {
    try await perform(
      (
        token: token,
        operation: { client in
          let output = try await client.listCurrentUserTracks(
            .init(query: .init(cursor: cursor, limit: 24)))
          switch output {
          case .ok(let response):
            let payload = try response.body.json
            return MyTracksPage(
              tracks: payload.data.map {
                MyTrack(id: $0.id, title: $0.title, totalCourses: $0.progress.totalCourses)
              }, nextCursor: payload.pagination.nextCursor)
          case .unauthorized: throw MyCoursesAPIError.unauthorized
          case .badRequest, .internalServerError, .undocumented: throw MyCoursesAPIError.unavailable
          }
        }
      ))
  }

  /// Keeps generated transport failures behind stable feature errors while preserving task cancellation.
  private func perform<Output: Sendable>(
    _ request: (
      token: String,
      operation: @Sendable (Client) async throws -> Output
    )
  ) async throws -> Output {
    do {
      return try await request.operation(clients.makeClient(token: request.token))
    } catch {
      if isRequestCancellation(error) {
        throw CancellationError()
      }

      if let error = error as? MyCoursesAPIError {
        throw error
      }

      if isNetworkError(error) {
        throw MyCoursesAPIError.network
      }

      throw MyCoursesAPIError.unavailable
    }
  }

  private func isRequestCancellation(_ error: Error) -> Bool {
    if error is CancellationError {
      return true
    }

    if let urlError = error as? URLError {
      return urlError.code == .cancelled
    }

    if let clientError = error as? ClientError {
      return isRequestCancellation(clientError.underlyingError)
    }

    return false
  }

  private func isNetworkError(_ error: Error) -> Bool {
    if error is URLError {
      return true
    }

    if let clientError = error as? ClientError {
      return isNetworkError(clientError.underlyingError)
    }

    return false
  }
}

private func makeMyCoursesPage(
  _ payload: Components.Schemas.CurrentUserCourseListResponse
) -> MyCoursesPage {
  MyCoursesPage(
    courses: payload.data.map(makeUserCourseSummary),
    hasMore: payload.pagination.hasMore,
    nextCursor: payload.pagination.nextCursor)
}

private func makeUserCourseSummary(
  _ payload: Components.Schemas.CurrentUserCourse
) -> UserCourseSummary {
  UserCourseSummary(
    description: payload.description,
    id: payload.id,
    imageURL: payload.imageUrl.flatMap(URL.init(string:)),
    language: payload.language,
    organization: payload.organization.map { makeCourseOrganization($0.value1) },
    slug: payload.slug,
    title: payload.title,
    brandSlug: payload.brandSlug)
}
