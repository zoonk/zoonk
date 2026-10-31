import Foundation
import OpenAPIRuntime

enum APIError: Error, Equatable, Sendable {
  case network
  case notFound
  case unauthorized
  case unavailable
}

extension APIClientFactory {
  func perform<Output: Sendable>(
    token: String?,
    sendingNull keys: [String] = [],
    body: Data? = nil,
    operation: (Client) async throws -> Output
  ) async throws -> Output {
    do {
      return try await operation(makeClient(token: token, sendingNull: keys, body: body))
    } catch {
      throw apiError(from: error)
    }
  }
}

/// A cancelled request stays a `CancellationError`, so it's never shown as a failure.
func apiError(from error: Error) -> Error {
  if let error = error as? APIError {
    return error
  }

  if isRequestCancellation(error) {
    return CancellationError()
  }

  return isNetworkError(error) ? APIError.network : APIError.unavailable
}

private func isRequestCancellation(_ error: Error) -> Bool {
  if error is CancellationError {
    return true
  }

  if let urlError = error as? URLError {
    return urlError.code == .cancelled
  }

  if let clientError = error as? ClientError {
    return isRequestCancellation(clientError.underlyingError)
  }

  return false
}

private func isNetworkError(_ error: Error) -> Bool {
  if error is URLError {
    return true
  }

  if let clientError = error as? ClientError {
    return isNetworkError(clientError.underlyingError)
  }

  return false
}
