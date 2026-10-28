import Foundation
import OpenAPIRuntime
import OpenAPIURLSession

/// The app target uses `SWIFT_DEFAULT_ACTOR_ISOLATION = nonisolated` because Swift OpenAPI
/// Generator can't generate conformances for a default-`MainActor` module:
/// https://github.com/apple/swift-openapi-generator/issues/796
struct APIClientFactory {
  let serverURL: URL
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

  /// Cookie-free: the Keychain bearer token is the only credential. Streams get their own session
  /// without the one-minute response cap, since a generation's events can run for minutes.
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

  /// `sendingNull` keys go out as explicit `null`s; `body` replaces the generated client's body.
  func makeClient(token: String? = nil, sendingNull keys: [String] = [], body: Data? = nil)
    -> Client
  {
    makeClient(token: token, transport: transport, sendingNull: keys, body: body)
  }

  /// Also for a write slower than the one-minute cap, such as grading an essay.
  func makeStreamingClient(token: String? = nil) -> Client {
    makeClient(token: token, transport: streamingTransport)
  }

  private func makeClient(
    token: String?, transport: any ClientTransport, sendingNull keys: [String] = [],
    body: Data? = nil
  ) -> Client {
    Client(
      serverURL: serverURL,
      configuration: .init(dateTranscoder: .iso8601WithFractionalSeconds),
      transport: transport,
      middlewares: [APIRequestMiddleware(token: token)]
        + (keys.isEmpty ? [] : [ExplicitNullMiddleware(keys: keys)])
        + (body.map { [JSONBodyMiddleware(body: $0)] } ?? []))
  }

  private static func sessionConfiguration() -> URLSessionConfiguration {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.httpCookieAcceptPolicy = .never
    configuration.httpShouldSetCookies = false
    return configuration
  }
}
