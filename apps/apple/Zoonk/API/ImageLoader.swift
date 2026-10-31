import SwiftUI
import UIKit

/// Keeps pictures decoded in memory, so one that shows again appears at once and makes no request.
/// The cache lets them go once they pass about `memoryLimit`, and under memory pressure.
@MainActor
final class ImageLoader {
  typealias Fetch = @Sendable (URLRequest) async throws -> (Data, URLResponse)

  private static let memoryLimit = 64 * 1024 * 1024

  private let fetch: Fetch
  private let filesURL: URL
  private let cache = NSCache<NSString, UIImage>()
  private var inFlight: [String: Task<UIImage?, Never>] = [:]

  init(apiBaseURL: URL, fetch: @escaping Fetch) {
    self.fetch = fetch
    filesURL = apiBaseURL.appending(path: "v1/files")
    cache.totalCostLimit = Self.memoryLimit
  }

  static func live(configuration: AppConfiguration = .current) -> ImageLoader {
    let sessionConfiguration = URLSessionConfiguration.ephemeral
    sessionConfiguration.httpCookieAcceptPolicy = .never
    sessionConfiguration.httpShouldSetCookies = false
    sessionConfiguration.timeoutIntervalForRequest = 30
    let privateSession = URLSession(configuration: sessionConfiguration)

    // A request that carries the session never reaches the shared disk cache.
    return ImageLoader(apiBaseURL: configuration.apiBaseURL) { request in
      let session =
        request.value(forHTTPHeaderField: "Authorization") == nil
        ? URLSession.shared : privateSession
      return try await session.data(for: request)
    }
  }

  /// The session is only ever sent to the API's own origin, never to a public image host.
  nonisolated func requiresSession(_ url: URL) -> Bool {
    url.scheme == filesURL.scheme
      && url.host() == filesURL.host()
      && url.port == filesURL.port
      && url.path().hasPrefix(filesURL.path() + "/")
  }

  /// Nil until the picture is loaded, or for a private picture without that session.
  func cachedImage(for url: URL, token: String?) -> UIImage? {
    key(url, token: token).flatMap { cache.object(forKey: $0 as NSString) }
  }

  func image(for url: URL, token: String?) async -> UIImage? {
    guard let key = key(url, token: token) else {
      return nil
    }

    if let image = cache.object(forKey: key as NSString) {
      return image
    }

    if let task = inFlight[key] {
      return await task.value
    }

    var request = URLRequest(url: url)

    if requiresSession(url), let token {
      request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }

    let task = Task { [fetch] in await Self.download(request, fetch: fetch) }
    inFlight[key] = task
    let image = await task.value
    inFlight[key] = nil

    if let image {
      cache.setObject(image, forKey: key as NSString, cost: image.decodedBytes)
    }

    return image
  }

  /// A private picture's key holds its session, so another session never reuses it.
  private func key(_ url: URL, token: String?) -> String? {
    guard requiresSession(url) else {
      return url.absoluteString
    }

    return token.map { "\($0) \(url.absoluteString)" }
  }

  @concurrent
  private nonisolated static func download(_ request: URLRequest, fetch: Fetch) async -> UIImage? {
    guard
      let (data, response) = try? await fetch(request),
      (response as? HTTPURLResponse)?.statusCode == 200,
      let image = UIImage(data: data)
    else {
      return nil
    }

    return await image.byPreparingForDisplay() ?? image
  }
}

extension UIImage {
  fileprivate var decodedBytes: Int {
    cgImage.map { $0.bytesPerRow * $0.height } ?? 0
  }
}

extension EnvironmentValues {
  @Entry var imageLoader: ImageLoader?
}
