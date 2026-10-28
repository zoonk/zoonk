import Foundation
import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

final class APIRequestMiddlewareTests: XCTestCase {
  func testExplicitNullAnnouncesTheLengthItSends() async throws {
    let sent = try await send(
      through: ExplicitNullMiddleware(keys: ["dailyLimitMinutes"]), body: Data("{}".utf8))

    XCTAssertEqual(sent.length, String(sent.body.count))
    XCTAssertEqual(String(decoding: sent.body, as: UTF8.self), #"{"dailyLimitMinutes":null}"#)
  }

  func testJSONBodyAnnouncesTheLengthItSends() async throws {
    let json = Data(#"{"targetDate":null}"#.utf8)
    let sent = try await send(through: JSONBodyMiddleware(body: json), body: Data("{}".utf8))

    XCTAssertEqual(sent.length, String(json.count))
    XCTAssertEqual(sent.body, json)
  }

  /// Runs a request through `middleware` the way the generated client does: its Content-Length
  /// already set from the body it was made with.
  private func send(through middleware: some ClientMiddleware, body: Data) async throws
    -> (length: String?, body: Data)
  {
    var request = HTTPRequest(method: .post, scheme: nil, authority: nil, path: "/v1/test")
    request.headerFields[.contentLength] = String(body.count)
    let sent = Sent()

    _ = try await middleware.intercept(
      request, body: HTTPBody(body), baseURL: URL(string: "https://api.zoonk.test")!,
      operationID: "test"
    ) { request, body, _ in
      let data = try await Data(collecting: body!, upTo: 1_048_576)
      await sent.record(length: request.headerFields[.contentLength], body: data)
      return (HTTPResponse(status: .ok), nil)
    }

    return await (sent.length, sent.body)
  }
}

private actor Sent {
  private(set) var length: String?
  private(set) var body = Data()

  func record(length: String?, body: Data) {
    self.length = length
    self.body = body
  }
}
