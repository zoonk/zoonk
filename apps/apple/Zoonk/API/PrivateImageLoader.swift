import SwiftUI
import UIKit

/// Loads pictures of a learner's private courses, chapters and lessons. They have no public URL: the
/// API serves them from `/v1/files/` to their owner only, so each request carries the learner's
/// session. Loaded pictures are kept in memory for the current session and dropped when it changes.
actor PrivateImageLoader {
  typealias Fetch = @Sendable (URLRequest) async throws -> (Data, URLResponse)

  private let fetch: Fetch
  private let filesURL: URL
  private let cache = NSCache<NSURL, UIImage>()
  private var cacheToken: String?
  private var inFlight: [URL: Task<UIImage?, Never>] = [:]

  init(apiBaseURL: URL, fetch: @escaping Fetch) {
    self.fetch = fetch
    filesURL = apiBaseURL.appending(path: "v1/files")
  }

  /// Uses a cookie-free session so the bearer token is the only credential, like the API client.
  static func live(configuration: AppConfiguration = .current) -> PrivateImageLoader {
    let sessionConfiguration = URLSessionConfiguration.ephemeral
    sessionConfiguration.httpCookieAcceptPolicy = .never
    sessionConfiguration.httpShouldSetCookies = false
    sessionConfiguration.timeoutIntervalForRequest = 30
    let session = URLSession(configuration: sessionConfiguration)

    return PrivateImageLoader(apiBaseURL: configuration.apiBaseURL) { request in
      try await session.data(for: request)
    }
  }

  /// Whether the picture is one of the API's private files. The session is only ever sent to the
  /// API's own origin, never to a public image host.
  nonisolated func requiresSession(_ url: URL) -> Bool {
    url.scheme == filesURL.scheme
      && url.host() == filesURL.host()
      && url.port == filesURL.port
      && url.path().hasPrefix(filesURL.path() + "/")
  }

  /// Returns the picture, or nil when it can't be loaded so the artwork keeps its fallback.
  func image(for url: URL, token: String) async -> UIImage? {
    guard requiresSession(url) else {
      return nil
    }

    startSession(token)

    if let image = cache.object(forKey: url as NSURL) {
      return image
    }

    if let task = inFlight[url] {
      return await task.value
    }

    let task = Task { await download(url, token: token) }
    inFlight[url] = task
    let image = await task.value

    guard cacheToken == token else {
      return nil
    }

    inFlight[url] = nil

    if let image {
      cache.setObject(image, forKey: url as NSURL)
    }

    return image
  }

  /// Another session never reuses the previous session's pictures.
  private func startSession(_ token: String) {
    guard cacheToken != token else {
      return
    }

    cacheToken = token
    cache.removeAllObjects()
    for task in inFlight.values {
      task.cancel()
    }

    inFlight.removeAll()
  }

  private func download(_ url: URL, token: String) async -> UIImage? {
    var request = URLRequest(url: url)
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

    guard
      let (data, response) = try? await fetch(request),
      (response as? HTTPURLResponse)?.statusCode == 200
    else {
      return nil
    }

    return UIImage(data: data)
  }
}

extension EnvironmentValues {
  /// Nil in previews, where private pictures show their fallback artwork.
  @Entry var privateImageLoader: PrivateImageLoader?
}
