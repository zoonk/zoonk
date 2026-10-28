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
/// such as `{"dailyLimitMinutes": null}` for no daily limit. A dotted key (`shape.area`) reaches into
/// a nested object the body has, for a schema whose nested keys are required but nullable.
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

    for key in keys {
      object = Self.settingNull(at: key.split(separator: ".").map(String.init), in: object)
    }

    let (request, newBody) = request.sending(try JSONSerialization.data(withJSONObject: object))
    return try await next(request, newBody, baseURL)
  }
}

/// Sends `body` as the request's JSON instead of the generated client's encoding, for a body the
/// generated types can't say, such as a plan change clearing its date with a nested `null`.
struct JSONBodyMiddleware: ClientMiddleware {
  let body: Data

  func intercept(
    _ request: HTTPRequest,
    body _: HTTPBody?,
    baseURL: URL,
    operationID: String,
    next:
      @concurrent @Sendable (HTTPRequest, HTTPBody?, URL) async throws -> (HTTPResponse, HTTPBody?)
  ) async throws -> (HTTPResponse, HTTPBody?) {
    let (request, body) = request.sending(body)
    return try await next(request, body, baseURL)
  }
}

extension HTTPRequest {
  /// The request carrying `body` in place of its own: the generated client already announced its
  /// own body's length, and a longer body cut short reaches the server as broken JSON.
  fileprivate func sending(_ body: Data) -> (HTTPRequest, HTTPBody) {
    var request = self
    request.headerFields[.contentLength] = String(body.count)
    return (request, HTTPBody(body))
  }

  private static func settingNull(at path: [String], in object: [String: Any]) -> [String: Any] {
    guard let key = path.first else {
      return object
    }

    var object = object

    if path.count == 1 {
      if object[key] == nil {
        object[key] = NSNull()
      }
    } else if let nested = object[key] as? [String: Any] {
      object[key] = settingNull(at: Array(path.dropFirst()), in: nested)
    }

    return object
  }
}
