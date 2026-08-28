import Foundation
import OpenAPIRuntime

struct FeedbackSubmission: Equatable, Sendable {
  let email: String
  let message: String
}

enum FeedbackFailure: Error, Equatable, Sendable {
  case network
  case unavailable
  case validation
}

protocol FeedbackAPIClient: Sendable {
  func submit(_ submission: FeedbackSubmission) async throws
}

struct FeedbackAPI: FeedbackAPIClient, @unchecked Sendable {
  private let clients: APIClientFactory

  init(clients: APIClientFactory) {
    self.clients = clients
  }

  static func live(configuration: AppConfiguration = .current) -> FeedbackAPI {
    FeedbackAPI(
      clients: APIClientFactory.live(baseURL: configuration.apiBaseURL))
  }

  func submit(_ submission: FeedbackSubmission) async throws {
    try await perform { client in
      let output = try await client.createFeedback(
        .init(
          body: .json(
            .init(
              email: submission.email,
              message: submission.message))))

      switch output {
      case .ok:
        return
      case .badRequest:
        throw FeedbackFailure.validation
      case .forbidden, .internalServerError, .undocumented:
        throw FeedbackFailure.unavailable
      }
    }
  }

  /// Keeps generated transport failures behind stable form recovery states while preserving task cancellation.
  private func perform<Output: Sendable>(
    operation: @Sendable (Client) async throws -> Output
  ) async throws -> Output {
    do {
      return try await operation(clients.makeClient())
    } catch {
      if isRequestCancellation(error) {
        throw CancellationError()
      }

      if let failure = error as? FeedbackFailure {
        throw failure
      }

      if isNetworkError(error) {
        throw FeedbackFailure.network
      }

      throw FeedbackFailure.unavailable
    }
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
}
