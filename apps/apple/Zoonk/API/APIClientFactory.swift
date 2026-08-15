import Foundation
import OpenAPIRuntime
import OpenAPIURLSession

/// The app target uses `SWIFT_DEFAULT_ACTOR_ISOLATION = nonisolated` because Swift OpenAPI
/// Generator cannot yet generate its client and middleware conformances for a default-`MainActor`
/// module. UI and mutable app state stay explicitly `@MainActor` until upstream issues #796 and
/// #804 are released: https://github.com/apple/swift-openapi-generator/issues/796 and
/// https://github.com/apple/swift-openapi-generator/issues/804.
struct APIClientFactory {
  private let serverURL: URL
  private let transport: any ClientTransport

  init(baseURL: URL, transport: any ClientTransport) {
    self.serverURL = baseURL.appending(path: "v1")
    self.transport = transport
  }

  /// Creates one cookie-free transport because native authentication is authorized only by the bearer token kept in Keychain.
  static func live(baseURL: URL) -> APIClientFactory {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.httpCookieAcceptPolicy = .never
    configuration.httpShouldSetCookies = false
    configuration.timeoutIntervalForRequest = 30
    configuration.timeoutIntervalForResource = 60
    let transport = URLSessionTransport(
      configuration: .init(session: URLSession(configuration: configuration)))

    return APIClientFactory(baseURL: baseURL, transport: transport)
  }

  /// Captures the token in an immutable middleware while every generated client reuses the same transport.
  func makeClient(token: String? = nil) -> Client {
    Client(
      serverURL: serverURL,
      configuration: .init(dateTranscoder: .iso8601WithFractionalSeconds),
      transport: transport,
      middlewares: [APIRequestMiddleware(token: token)])
  }
}
