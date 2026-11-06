import UIKit
import XCTest

@testable import Zoonk

@MainActor
final class ImageLoaderTests: XCTestCase {
  private let privateURL = URL(
    string: "https://api.zoonk.test/v1/files/courses/owner-id/cover.png")!

  func testOnlyTheAPIsOwnFilesNeedTheSession() {
    let loader = ImageLoader(apiBaseURL: URL(string: "https://api.zoonk.test")!) { _ in
      XCTFail("Expected no request")
      throw URLError(.badURL)
    }

    XCTAssertTrue(loader.requiresSession(privateURL))
    XCTAssertFalse(
      loader.requiresSession(URL(string: "https://cdn.zoonk.test/v1/files/courses/o/cover.png")!),
      "Expected the session never to reach another host")
    XCTAssertFalse(
      loader.requiresSession(URL(string: "http://api.zoonk.test/v1/files/courses/o/cover.png")!))
    XCTAssertFalse(
      loader.requiresSession(URL(string: "https://api.zoonk.test/v1/courses/course-id")!))
  }

  func testLoadsWithTheSessionAndReusesThePictureForThatSession() async throws {
    let fetcher = ImageFetchRecorder(status: 200)
    let loader = ImageLoader(
      apiBaseURL: URL(string: "https://api.zoonk.test")!, fetch: fetcher.fetch)

    let firstImage = await loader.image(for: privateURL, token: "session-a")
    let secondImage = await loader.image(for: privateURL, token: "session-a")

    XCTAssertNotNil(firstImage)
    XCTAssertNotNil(secondImage)
    let authorizations = await fetcher.authorizations
    XCTAssertEqual(authorizations, ["Bearer session-a"])
  }

  func testAnotherSessionDoesNotReuseThePreviousSessionsPicture() async {
    let fetcher = ImageFetchRecorder(status: 200)
    let loader = ImageLoader(
      apiBaseURL: URL(string: "https://api.zoonk.test")!, fetch: fetcher.fetch)

    _ = await loader.image(for: privateURL, token: "session-a")
    _ = await loader.image(for: privateURL, token: "session-b")

    let authorizations = await fetcher.authorizations
    XCTAssertEqual(authorizations, ["Bearer session-a", "Bearer session-b"])
  }

  func testKeepsAPublicPictureInMemoryForEverySessionWithoutSendingIt() async {
    let fetcher = ImageFetchRecorder(status: 200)
    let loader = ImageLoader(
      apiBaseURL: URL(string: "https://api.zoonk.test")!, fetch: fetcher.fetch)
    let publicURL = URL(string: "https://cdn.zoonk.test/courses/cover.png")!

    XCTAssertNil(loader.cachedImage(for: publicURL, token: nil))
    _ = await loader.image(for: publicURL, token: "session-a")
    let again = await loader.image(for: publicURL, token: "session-b")

    XCTAssertNotNil(again)
    XCTAssertNotNil(loader.cachedImage(for: publicURL, token: nil))
    let authorizations = await fetcher.authorizations
    XCTAssertEqual(authorizations, [nil])
  }

  func testOverlappingLoadsOfOnePictureShareOneRequest() async {
    let fetcher = ImageFetchRecorder(status: 200)
    let loader = ImageLoader(
      apiBaseURL: URL(string: "https://api.zoonk.test")!, fetch: fetcher.fetch)

    let url = privateURL
    async let first = loader.image(for: url, token: "session-a")
    async let second = loader.image(for: url, token: "session-a")
    let images = await [first, second]

    XCTAssertEqual(images.compactMap { $0 }.count, 2)
    let authorizations = await fetcher.authorizations
    XCTAssertEqual(authorizations, ["Bearer session-a"])
  }

  func testDecodesALargePictureOnlyAsLargeAsItsPlace() async throws {
    let fetcher = ImageFetchRecorder(status: 200, pixels: CGSize(width: 400, height: 200))
    let loader = ImageLoader(
      apiBaseURL: URL(string: "https://api.zoonk.test")!, fetch: fetcher.fetch)
    let url = URL(string: "https://zoonk.test/en/c/K7QF2M9XHD4P/image/print.png")!

    let thumbnailImage = await loader.image(for: url, token: nil, maxPixelSize: 100)
    let fullImage = await loader.image(for: url, token: nil)
    let thumbnail = try XCTUnwrap(thumbnailImage)
    let full = try XCTUnwrap(fullImage)

    XCTAssertEqual(thumbnail.cgImage?.width, 100)
    XCTAssertEqual(thumbnail.cgImage?.height, 50)
    XCTAssertEqual(full.cgImage?.width, 400, "Expected each size to be kept apart")
    XCTAssertEqual(loader.cachedImage(for: url, token: nil, maxPixelSize: 100), thumbnail)
  }

  func testRefusedPictureKeepsTheFallback() async {
    let fetcher = ImageFetchRecorder(status: 401)
    let loader = ImageLoader(
      apiBaseURL: URL(string: "https://api.zoonk.test")!, fetch: fetcher.fetch)

    let image = await loader.image(for: privateURL, token: "expired-session")

    XCTAssertNil(image)
  }
}

private actor ImageFetchRecorder {
  private let status: Int
  private let pixels: CGSize
  private(set) var authorizations: [String?] = []

  init(status: Int, pixels: CGSize = CGSize(width: 2, height: 2)) {
    self.status = status
    self.pixels = pixels
  }

  nonisolated var fetch: ImageLoader.Fetch {
    { request in try await self.respond(to: request) }
  }

  private func respond(to request: URLRequest) throws -> (Data, URLResponse) {
    authorizations.append(request.value(forHTTPHeaderField: "Authorization"))
    let url = try XCTUnwrap(request.url)
    let response = try XCTUnwrap(
      HTTPURLResponse(url: url, statusCode: status, httpVersion: nil, headerFields: nil))
    return (status == 200 ? samplePNG() : Data(), response)
  }

  private func samplePNG() -> Data {
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1

    return UIGraphicsImageRenderer(size: pixels, format: format).pngData { context in
      UIColor.systemGreen.setFill()
      context.fill(CGRect(origin: .zero, size: pixels))
    }
  }
}
