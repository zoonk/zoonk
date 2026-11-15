import Foundation
import HTTPTypes
import OpenAPIRuntime

@testable import Zoonk

extension AppDependencies {
  /// The app's dependencies for a screen a test hosts whole: signed in, with `transport` answering
  /// the API, by default as if offline.
  @MainActor
  static func hosted(transport: any ClientTransport = OfflineTransport()) -> AppDependencies {
    AppDependencies(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!, transport: transport),
      session: .preview(account: .planTestAccount), imageLoader: .live(), subscriptionStore: .live()
    )
  }
}

/// An API that never answers, for a screen whose test needs none of it.
struct OfflineTransport: ClientTransport {
  func send(
    _ request: HTTPRequest, body: HTTPBody?, baseURL: URL, operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    throw APIError.network
  }
}
