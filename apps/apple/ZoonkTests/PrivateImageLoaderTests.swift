import UIKit
import XCTest

@testable import Zoonk

final class PrivateImageLoaderTests: XCTestCase {
  private let privateURL = URL(
    string: "https://api.zoonk.test/v1/files/courses/owner-id/cover.png")!

  func testOnlyTheAPIsOwnFilesNeedTheSession() {
    let loader = PrivateImageLoader(apiBaseURL: URL(string: "https://api.zoonk.test")!) { _ in
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
    let loader = PrivateImageLoader(
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
    let loader = PrivateImageLoader(
      apiBaseURL: URL(string: "https://api.zoonk.test")!, fetch: fetcher.fetch)

    _ = await loader.image(for: privateURL, token: "session-a")
    _ = await loader.image(for: privateURL, token: "session-b")

    let authorizations = await fetcher.authorizations
    XCTAssertEqual(authorizations, ["Bearer session-a", "Bearer session-b"])
  }

  func testRefusedPictureKeepsTheFallback() async {
    let fetcher = ImageFetchRecorder(status: 401)
    let loader = PrivateImageLoader(
      apiBaseURL: URL(string: "https://api.zoonk.test")!, fetch: fetcher.fetch)

    let image = await loader.image(for: privateURL, token: "expired-session")

    XCTAssertNil(image)
  }
}

private actor ImageFetchRecorder {
  private let status: Int
  private(set) var authorizations: [String?] = []

  init(status: Int) {
    self.status = status
  }

  nonisolated var fetch: PrivateImageLoader.Fetch {
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
    UIGraphicsImageRenderer(size: CGSize(width: 2, height: 2)).pngData { context in
      UIColor.systemGreen.setFill()
      context.fill(CGRect(x: 0, y: 0, width: 2, height: 2))
    }
  }
}
