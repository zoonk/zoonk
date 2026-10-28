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

/// Writes `null` for `keys` a JSON request body leaves out. Generated clients omit an optional
/// property that's nil (apple/swift-openapi-generator#419), so a PATCH couldn't say "clear this",
/// such as `{"dailyLimitMinutes": null}` for no daily limit.
struct ExplicitNullMiddleware: ClientMiddleware {
  let keys: [String]

  func intercept(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String,
    next:
      @concurrent @Sendable (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)
  ) async throws -> (HTTPResponse, HTTPBody?) {
    guard let body else {
      return try await next(request, body, baseURL)
    }

    let data = try await Data(collecting: body, upTo: 1_048_576)
    var object = try JSONSerialization.jsonObject(with: data) as? [String: Any] ?? [:]

    for key in keys where object[key] == nil {
      object[key] = NSNull()
    }

    return try await next(
      request, HTTPBody(try JSONSerialization.data(withJSONObject: object)), baseURL)
  }
}
