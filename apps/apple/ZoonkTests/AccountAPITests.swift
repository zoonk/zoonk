import HTTPTypes
import OpenAPIRuntime
import XCTest

@testable import Zoonk

final class AccountAPITests: XCTestCase {
  func testCurrentAccountUsesSharedClientConfiguration() async throws {
    let clients = APIClientFactory(
      baseURL: URL(string: "https://api.zoonk.test")!,
      transport: CurrentAccountTransport())
    let api = AccountAPI(clients: clients)

    let account = try await api.getCurrentAccount(token: "test-session")

    XCTAssertEqual(account.user.email, "learner@zoonk.test")
  }

  func testNativeSessionRateLimitRemainsActionable() async {
    let api = AccountAPI(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!,
        transport: RateLimitedTransport()))

    do {
      _ = try await api.signInWithEmailCode(email: "learner@zoonk.test", code: "123456")
      XCTFail("Expected the rate limit response to throw")
    } catch let error as AccountAPIError {
      XCTAssertEqual(error, .rateLimited)
    } catch {
      XCTFail("Unexpected error: \(error)")
    }
  }

  func testCancellationErrorIsPreserved() async {
    let api = AccountAPI(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!,
        transport: CancellationTransport()))

    do {
      _ = try await api.getCurrentAccount(token: "test-session")
      XCTFail("Expected cancellation")
    } catch is CancellationError {
      return
    } catch {
      XCTFail("Unexpected error: \(error)")
    }
  }

  func testCancelledURLRequestIsPreservedAsCancellation() async {
    let api = AccountAPI(
      clients: APIClientFactory(
        baseURL: URL(string: "https://api.zoonk.test")!,
        transport: CancelledURLTransport()))

    do {
      _ = try await api.getCurrentAccount(token: "test-session")
      XCTFail("Expected cancellation")
    } catch is CancellationError {
      return
    } catch {
      XCTFail("Unexpected error: \(error)")
    }
  }
}

private enum CurrentAccountTransportError: Error {
  case invalidRequest
}

/// The generated client's cross-cutting configuration is observable only at the transport boundary, so this avoids depending on an external server.
private struct CurrentAccountTransport: ClientTransport {
  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    guard
      baseURL == URL(string: "https://api.zoonk.test/v1"),
      request.headerFields[.authorization] == "Bearer test-session",
      request.headerFields[.acceptLanguage] != nil
    else {
      throw CurrentAccountTransportError.invalidRequest
    }

    var headerFields = HTTPFields()
    headerFields[.contentType] = "application/json"

    return (
      HTTPResponse(status: .ok, headerFields: headerFields),
      HTTPBody(
        #"{"account":{"deletion":{"hasAppleAccount":false},"hasActiveSubscription":false,"subscription":null},"user":{"analyticsDisabled":false,"createdAt":"2026-08-15T12:34:56.000Z","displayUsername":null,"email":"learner@zoonk.test","emailVerified":true,"id":"test-user","image":null,"name":"Learner","updatedAt":"2026-08-15T12:34:56.000Z","username":null}}"#
      )
    )
  }
}

private struct RateLimitedTransport: ClientTransport {
  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    var headerFields = HTTPFields()
    headerFields[.contentType] = "application/json"
    headerFields[.retryAfter] = "7"

    return (
      HTTPResponse(status: .tooManyRequests, headerFields: headerFields),
      HTTPBody(#"{"error":{"code":"RATE_LIMIT_EXCEEDED","message":"Try again later"}}"#)
    )
  }
}

private struct CancellationTransport: ClientTransport {
  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    throw CancellationError()
  }
}

private struct CancelledURLTransport: ClientTransport {
  func send(
    _ request: HTTPRequest,
    body: HTTPBody?,
    baseURL: URL,
    operationID: String
  ) async throws -> (HTTPResponse, HTTPBody?) {
    throw URLError(.cancelled)
  }
}
