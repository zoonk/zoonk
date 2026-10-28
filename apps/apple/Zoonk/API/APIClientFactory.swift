import Foundation
import OpenAPIRuntime
import OpenAPIURLSession

/// The app target uses `SWIFT_DEFAULT_ACTOR_ISOLATION = nonisolated` because Swift OpenAPI
/// Generator cannot yet generate its client and middleware conformances for a default-`MainActor`
/// module. UI and mutable app state stay explicitly `@MainActor` until upstream issues #796 and
/// #804 are released: https://github.com/apple/swift-openapi-generator/issues/796 and
/// https://github.com/apple/swift-openapi-generator/issues/804.
struct APIClientFactory {
  /// The API's versioned root; files it serves to their owner live under it.
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
  /// `sendingNull` names body keys sent as an explicit `null` when the generated body leaves them out;
  /// `body` replaces the generated body with JSON the generated types can't encode.
  func makeClient(token: String? = nil, sendingNull keys: [String] = [], body: Data? = nil)
    -> Client
  {
    makeClient(token: token, transport: transport, sendingNull: keys, body: body)
  }

  /// A client for long-lived responses such as Server-Sent Events, or a write the server takes
  /// longer than a request's usual wait to answer (starting a mock exam picks its questions).
  func makeStreamingClient(token: String? = nil, sendingNull keys: [String] = []) -> Client {
    makeClient(token: token, transport: streamingTransport, sendingNull: keys)
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
