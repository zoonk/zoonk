import Foundation
import Observation

enum PlusAccessState: Equatable, Sendable {
  case idle
  case loading
  case loaded(PlusPurchaseAccess)
  case failed(PlusAccessFailure)

  var access: PlusPurchaseAccess? {
    guard case .loaded(let access) = self else {
      return nil
    }

    return access
  }
}

enum PlusApprovalRequestState: Equatable, Sendable {
  case idle
  case sending
  case requested
  case noGuardian
  case failed(PlusAccessFailure)
}

/// Decides whether the subscription screen may show the App Store offer. The server owns the rule
/// (learners under 18 need a guardian's approval), so the app asks each time the offer opens.
@MainActor
@Observable
final class PlusAccessStore {
  private let api: any PlusAccessAPIClient
  private let session: SessionStore
  private var accessRevision: UUID?
  private var approvalRevision: UUID?
  private var sessionApprovalRequest = PlusApprovalRequestState.idle
  private var sessionState = PlusAccessState.idle
  private var stateSession: AuthenticatedSession?

  init(api: any PlusAccessAPIClient, session: SessionStore) {
    self.api = api
    self.session = session
  }

  /// Another account never sees the previous account's answer, even before it loads its own.
  var state: PlusAccessState {
    isCurrentSession(stateSession) ? sessionState : .idle
  }

  var approvalRequest: PlusApprovalRequestState {
    isCurrentSession(stateSession) ? sessionApprovalRequest : .idle
  }

  /// Checks again every time the offer opens, since a guardian can approve Plus at any moment. The
  /// same account keeps its last answer on screen while it refreshes.
  func load() async {
    guard let authenticatedSession = session.authenticatedSession else {
      reset()
      return
    }

    if stateSession != authenticatedSession {
      reset()
      stateSession = authenticatedSession
    }

    let revision = UUID()
    accessRevision = revision

    if sessionState.access == nil {
      sessionState = .loading
    }

    do {
      let access = try await api.getPlusPurchaseAccess(token: authenticatedSession.bearerToken)

      guard isCurrentAccessRequest(revision, session: authenticatedSession) else {
        return
      }

      sessionState = .loaded(access)
    } catch is CancellationError {
      guard isCurrentAccessRequest(revision, session: authenticatedSession) else {
        return
      }

      if sessionState == .loading {
        sessionState = .idle
      }
    } catch PlusAccessFailure.unauthorized {
      guard isCurrentAccessRequest(revision, session: authenticatedSession) else {
        return
      }

      reset()
      await session.expire(authenticatedSession)
    } catch {
      guard isCurrentAccessRequest(revision, session: authenticatedSession) else {
        return
      }

      guard sessionState.access == nil else {
        return
      }

      sessionState = .failed(error as? PlusAccessFailure ?? .unavailable)
    }
  }

  /// Asks the learner's guardians by email to approve Plus. When the server says approval is no
  /// longer needed, the offer is checked again instead.
  func requestApproval() async {
    guard
      let authenticatedSession = session.authenticatedSession,
      stateSession == authenticatedSession,
      sessionApprovalRequest != .sending
    else {
      return
    }

    let revision = UUID()
    approvalRevision = revision
    sessionApprovalRequest = .sending

    do {
      let result = try await api.requestPlusApproval(token: authenticatedSession.bearerToken)

      guard isCurrentApprovalRequest(revision, session: authenticatedSession) else {
        return
      }

      switch result {
      case .noGuardian:
        sessionApprovalRequest = .noGuardian
      case .notNeeded:
        sessionApprovalRequest = .idle
        await load()
      case .requested:
        sessionApprovalRequest = .requested
      }
    } catch is CancellationError {
      guard isCurrentApprovalRequest(revision, session: authenticatedSession) else {
        return
      }

      sessionApprovalRequest = .idle
    } catch PlusAccessFailure.unauthorized {
      guard isCurrentApprovalRequest(revision, session: authenticatedSession) else {
        return
      }

      reset()
      await session.expire(authenticatedSession)
    } catch {
      guard isCurrentApprovalRequest(revision, session: authenticatedSession) else {
        return
      }

      sessionApprovalRequest = .failed(error as? PlusAccessFailure ?? .unavailable)
    }
  }

  private func isCurrentAccessRequest(
    _ revision: UUID,
    session authenticatedSession: AuthenticatedSession
  ) -> Bool {
    accessRevision == revision && isCurrentSession(authenticatedSession)
  }

  private func isCurrentApprovalRequest(
    _ revision: UUID,
    session authenticatedSession: AuthenticatedSession
  ) -> Bool {
    approvalRevision == revision && isCurrentSession(authenticatedSession)
  }

  private func isCurrentSession(_ authenticatedSession: AuthenticatedSession?) -> Bool {
    authenticatedSession != nil
      && stateSession == authenticatedSession
      && session.authenticatedSession == authenticatedSession
  }

  private func reset() {
    accessRevision = nil
    approvalRevision = nil
    sessionApprovalRequest = .idle
    sessionState = .idle
    stateSession = nil
  }
}
