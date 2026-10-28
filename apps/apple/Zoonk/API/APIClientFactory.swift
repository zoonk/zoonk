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
  private let streamingTransport: any ClientTransport
  private let transport: any ClientTransport

  init(
    baseURL: URL,
    transport: any ClientTransport,
    streamingTransport: (any ClientTransport)? = nil
  ) {
    self.serverURL = baseURL.appending(path: "v1")
    self.transport = transport
    self.streamingTransport = streamingTransport ?? transport
  }

  /// Creates cookie-free transports because native authentication is authorized only by the bearer token kept in Keychain. Streams get their own session without the one-minute cap on a whole response, since a generation's events can run for minutes.
  static func live(baseURL: URL) -> APIClientFactory {
    let configuration = sessionConfiguration()
    configuration.timeoutIntervalForRequest = 30
    configuration.timeoutIntervalForResource = 60
    let streamingConfiguration = sessionConfiguration()
    streamingConfiguration.timeoutIntervalForRequest = 120

    return APIClientFactory(
      baseURL: baseURL,
      transport: URLSessionTransport(
        configuration: .init(session: URLSession(configuration: configuration))),
      streamingTransport: URLSessionTransport(
        configuration: .init(session: URLSession(configuration: streamingConfiguration))))
  }

  /// Captures the token in an immutable middleware while every generated client reuses the same transport.
  func makeClient(token: String? = nil) -> Client {
    makeClient(token: token, transport: transport)
  }

  /// A client for long-lived responses such as Server-Sent Events.
  func makeStreamingClient(token: String? = nil) -> Client {
    makeClient(token: token, transport: streamingTransport)
  }

  private func makeClient(token: String?, transport: any ClientTransport) -> Client {
    Client(
      serverURL: serverURL,
      configuration: .init(dateTranscoder: .iso8601WithFractionalSeconds),
      transport: transport,
      middlewares: [APIRequestMiddleware(token: token)])
  }

  private static func sessionConfiguration() -> URLSessionConfiguration {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.httpCookieAcceptPolicy = .never
    configuration.httpShouldSetCookies = false
    return configuration
  }
}
