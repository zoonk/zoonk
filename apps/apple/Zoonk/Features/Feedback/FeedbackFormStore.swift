import Foundation
import Observation

enum FeedbackFormState: Equatable, Sendable {
  case idle
  case submitting
  case sent
  case failed(FeedbackFailure)
}

@MainActor
@Observable
final class FeedbackFormStore {
  var email: String
  var message = ""
  private(set) var state = FeedbackFormState.idle

  private let api: any FeedbackAPIClient

  init(api: any FeedbackAPIClient, defaultEmail: String? = nil) {
    self.api = api
    email = defaultEmail?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
  }

  var canSubmit: Bool {
    guard state != .submitting else {
      return false
    }

    let emailParts = normalizedEmail.split(separator: "@", omittingEmptySubsequences: false)
    let isEmailValid =
      emailParts.count == 2
      && !emailParts[0].isEmpty
      && emailParts[1].contains(".")

    return isEmailValid && !normalizedMessage.isEmpty
  }

  func submit() async {
    guard canSubmit else {
      return
    }

    state = .submitting

    do {
      try await api.submit(
        FeedbackSubmission(
          email: normalizedEmail,
          message: normalizedMessage))
      state = .sent
    } catch is CancellationError {
      state = .idle
    } catch let failure as FeedbackFailure {
      state = .failed(failure)
    } catch {
      state = .failed(.unavailable)
    }
  }

  func clearFailure() {
    guard case .failed = state else {
      return
    }

    state = .idle
  }

  private var normalizedEmail: String {
    email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
  }

  private var normalizedMessage: String {
    message.trimmingCharacters(in: .whitespacesAndNewlines)
  }
}
