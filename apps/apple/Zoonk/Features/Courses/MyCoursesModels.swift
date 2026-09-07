import Foundation

struct UserCourseSummary: Codable, Equatable, Identifiable, Sendable {
  let description: String?
  let id: String
  let imageURL: URL?
  let language: String
  let organization: CourseOrganization?
  let slug: String
  let title: String
}

struct MyCoursesPage: Codable, Equatable, Sendable {
  let courses: [UserCourseSummary]
  let hasMore: Bool
  let nextCursor: String?

  var canLoadMore: Bool {
    hasMore && nextCursor != nil
  }
}

struct MyCoursesQuery: Equatable, Sendable {
  let cursor: String?
  let limit: Int?
  let query: String?

  init(cursor: String? = nil, limit: Int? = nil, query: String? = nil) {
    self.cursor = cursor
    self.limit = limit
    self.query = query
  }
}

struct MyCoursesRequest: Equatable, Sendable {
  let query: MyCoursesQuery
  let token: String
}

enum MyCoursesFailure: Error, Codable, Equatable, Sendable {
  case network
  case unavailable
}

enum MyCoursesLoadState<Value: Codable & Equatable & Sendable>: Codable, Equatable, Sendable {
  case idle
  case loading
  case loaded(Value)
  case empty
  case failed(MyCoursesFailure)
}
