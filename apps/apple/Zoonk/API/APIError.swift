import Foundation
import OpenAPIRuntime

/// How a request to the API failed, in the terms screens recover from. Cancellation stays a
/// `CancellationError` so a cancelled request is never shown as a failure.
enum APIError: Error, Equatable, Sendable {
  case network
  case notFound
  case unauthorized
  case unavailable
}

extension APIClientFactory {
  /// Runs one generated-client call and reports its failure as an `APIError`, so every feature API
  /// maps transport and decoding errors the same way.
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

/// Classifies an error thrown by a generated client: its own `APIError`s pass through, a
/// cancelled request stays a cancellation, and connectivity problems become `.network`.
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
