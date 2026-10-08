import Foundation
import OpenAPIRuntime

enum FeedbackContentKind: String, Equatable, Sendable {
  case chapter
  case course
}

/// The content a message is about, so the team can see the course or chapter the learner was on.
struct FeedbackContext: Equatable, Sendable {
  let contentID: String
  let contentKind: FeedbackContentKind
}

struct FeedbackSubmission: Equatable, Sendable {
  let context: FeedbackContext?
  let email: String
  let message: String

  init(context: FeedbackContext? = nil, email: String, message: String) {
    self.context = context
    self.email = email
    self.message = message
  }
}

enum FeedbackFailure: Error, Equatable, Sendable {
  case network
  case unavailable
  case validation
}

protocol FeedbackAPIClient: Sendable {
  /// Sends the message, linked to the signed-in learner's account when a token is given.
  func submit(_ submission: FeedbackSubmission, token: String?) async throws
}

struct FeedbackAPI: FeedbackAPIClient, @unchecked Sendable {
  private let appVersion: String?
  private let clients: APIClientFactory

  init(clients: APIClientFactory, appVersion: String? = currentAppVersion()) {
    self.appVersion = appVersion
    self.clients = clients
  }

  static func live(configuration: AppConfiguration = .current) -> FeedbackAPI {
    FeedbackAPI(
      clients: APIClientFactory.live(baseURL: configuration.apiBaseURL))
  }

  func submit(_ submission: FeedbackSubmission, token: String?) async throws {
    let context = makeContextPayload(submission.context)

    try await perform(token: token) { client in
      let output = try await client.createFeedback(
        .init(
          body: .json(
            .init(
              context: context,
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
    token: String?,
    operation: @Sendable (Client) async throws -> Output
  ) async throws -> Output {
    do {
      return try await operation(clients.makeClient(token: token))
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

  /// Tells the team the message came from this app and version, plus the content it's about.
  private func makeContextPayload(
    _ context: FeedbackContext?
  ) -> Components.Schemas.FeedbackSubmission.ContextPayload {
    .init(
      appVersion: appVersion,
      contentId: context?.contentID,
      contentKind: context.map { makeContentKindPayload($0.contentKind) },
      platform: .ios,
      screen: context?.contentKind.rawValue)
  }

  private func makeContentKindPayload(
    _ kind: FeedbackContentKind
  ) -> Components.Schemas.FeedbackSubmission.ContextPayload.ContentKindPayload {
    switch kind {
    case .chapter: .chapter
    case .course: .course
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

/// The marketing version and build, as shown in the App Store and TestFlight.
func currentAppVersion() -> String? {
  let info = Bundle.main.infoDictionary
  let version = info?["CFBundleShortVersionString"] as? String
  let build = info?["CFBundleVersion"] as? String

  return version.map { version in build.map { "\(version) (\($0))" } ?? version }
}
