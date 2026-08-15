import Foundation
import HTTPTypes
import OpenAPIRuntime

struct APIRequestMiddleware: ClientMiddleware {
  let token: String?

  func intercept(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String,
    next:
      @concurrent @Sendable (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)
  ) async throws -> (HTTPResponse, HTTPBody?) {
    var request = request
    request.headerFields[.acceptLanguage] = Locale.preferredLanguages.first ?? "en"

    if let token {
      request.headerFields[.authorization] = "Bearer \(token)"
    }

    return try await next(request, body, baseURL)
  }
}
