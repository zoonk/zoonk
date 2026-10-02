import Foundation
import OpenAPIRuntime

/// Whether the signed-in learner can buy Plus now. Learners under 18 need a guardian's approval
/// first, since an App Store purchase can't be refused after it happens.
enum PlusPurchaseAccess: Equatable, Sendable {
  case allowed
  case needsGuardianApproval
  case signInRequired
}

enum PlusApprovalRequestResult: Equatable, Sendable {
  case noGuardian
  case notNeeded
  case requested
}

enum PlusAccessFailure: Error, Equatable, Sendable {
  case network
  case unauthorized
  case unavailable
}

protocol PlusAccessAPIClient: Sendable {
  func getPlusPurchaseAccess(token: String) async throws -> PlusPurchaseAccess
  func requestPlusApproval(token: String) async throws -> PlusApprovalRequestResult
}

struct PlusAccessAPI: PlusAccessAPIClient, @unchecked Sendable {
  private let clients: APIClientFactory

  init(clients: APIClientFactory) {
    self.clients = clients
  }

  func getPlusPurchaseAccess(token: String) async throws -> PlusPurchaseAccess {
    try await perform(token: token) { client in
      let output = try await client.getCurrentUserLearningProfile(.init())

      switch output {
      case .ok(let response):
        return makePlusPurchaseAccess(try response.body.json.protections.plusPurchase)
      case .unauthorized:
        throw PlusAccessFailure.unauthorized
      case .internalServerError, .undocumented:
        throw PlusAccessFailure.unavailable
      }
    }
  }

  /// Emails the learner's guardians, or reports that a guardian must be invited first.
  func requestPlusApproval(token: String) async throws -> PlusApprovalRequestResult {
    try await perform(token: token) { client in
      let output = try await client.requestPlusApproval(.init())

      switch output {
      case .accepted:
        return .requested
      case .conflict:
        return .notNeeded
      case .unprocessableContent:
        return .noGuardian
      // A guest needs an account before asking a guardian, so it signs in like an expired session.
      case .unauthorized, .forbidden:
        throw PlusAccessFailure.unauthorized
      case .internalServerError, .undocumented:
        throw PlusAccessFailure.unavailable
      }
    }
  }

  /// Keeps generated transport failures behind stable feature errors while preserving task cancellation.
  private func perform<Output: Sendable>(
    token: String,
    operation: @Sendable (Client) async throws -> Output
  ) async throws -> Output {
    do {
      return try await operation(clients.makeClient(token: token))
    } catch {
      if isRequestCancellation(error) {
        throw CancellationError()
      }

      if let failure = error as? PlusAccessFailure {
        throw failure
      }

      if isNetworkError(error) {
        throw PlusAccessFailure.network
      }

      throw PlusAccessFailure.unavailable
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

private func makePlusPurchaseAccess(
  _ payload: Components.Schemas.LearnerProtections.PlusPurchasePayload
) -> PlusPurchaseAccess {
  switch payload {
  case .allowed: .allowed
  case .guestNotAllowed: .signInRequired
  case .needsGuardianApproval: .needsGuardianApproval
  }
}
