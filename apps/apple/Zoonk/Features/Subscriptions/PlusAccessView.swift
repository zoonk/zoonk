import SwiftUI

/// Opens the App Store offer only when the server says the learner can buy Plus now. Learners
/// under 18 ask a guardian to approve it first.
struct PlusAccessView: View {
  @Environment(PlusAccessStore.self) private var plusAccess
  @Environment(SessionStore.self) private var session

  let appAccountToken: UUID

  var body: some View {
    content
      .task(id: session.authenticatedSession) {
        await plusAccess.load()
      }
  }

  @ViewBuilder
  private var content: some View {
    switch plusAccess.state {
    case .idle, .loading:
      ProgressView()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .plusNavigationTitle()
    case .loaded(.allowed):
      SubscriptionView(appAccountToken: appAccountToken)
    case .loaded(.needsGuardianApproval):
      GuardianApprovalView()
        .plusNavigationTitle()
    case .loaded(.signInRequired):
      ContentUnavailableView {
        Label {
          Text(
            "Sign in to subscribe",
            tableName: "Account",
            comment: "Title when Plus needs a signed-in account before it can be bought")
        } icon: {
          Image(systemName: "person.crop.circle")
        }
      }
      .plusNavigationTitle()
    case .failed(let failure):
      PlusAccessFailureView(failure: failure) {
        await plusAccess.load()
      }
      .plusNavigationTitle()
    }
  }
}

private struct GuardianApprovalView: View {
  @Environment(PlusAccessStore.self) private var plusAccess

  var body: some View {
    ContentUnavailableView {
      Label {
        Text(
          "Ask a guardian",
          tableName: "Account",
          comment: "Title when a learner under 18 needs a guardian's approval before buying Plus")
      } icon: {
        Image(systemName: "checkmark.shield")
      }
    } description: {
      description
    } actions: {
      actions
    }
  }

  @ViewBuilder
  private var description: some View {
    switch plusAccess.approvalRequest {
    case .idle, .sending:
      Text(
        "Learners under 18 need a parent or guardian to approve Plus.",
        tableName: "Account",
        comment: "Explains why a learner under 18 can't buy Plus yet")
    case .requested:
      Text(
        "We emailed your guardian. Check again after they approve.",
        tableName: "Account",
        comment: "Confirms that the learner's guardians were asked to approve Plus")
    case .noGuardian:
      Text(
        "Invite a parent or guardian first. They can approve Plus after they accept.",
        tableName: "Account",
        comment: "Explains that a guardian must be invited before they can approve Plus")
    case .failed(let failure):
      failureMessage(failure)
    }
  }

  @ViewBuilder
  private var actions: some View {
    switch plusAccess.approvalRequest {
    case .idle, .sending, .failed:
      Button {
        Task {
          await plusAccess.requestApproval()
        }
      } label: {
        if plusAccess.approvalRequest == .sending {
          ProgressView()
            .accessibilityLabel(
              Text(
                "Asking for approval",
                tableName: "Account",
                comment: "Accessibility status while a guardian approval request is sent"))
        } else {
          Text(
            "Ask for approval",
            tableName: "Account",
            comment: "Emails the learner's guardians to approve Plus")
        }
      }
      .buttonStyle(.borderedProminent)
      .disabled(plusAccess.approvalRequest == .sending)
    case .requested:
      Button {
        Task {
          await plusAccess.load()
        }
      } label: {
        Text(
          "Check again",
          tableName: "Account",
          comment: "Checks whether a guardian has approved Plus")
      }
      .buttonStyle(.bordered)
    case .noGuardian:
      Link(destination: AccountLinks.guardian) {
        Text(
          "Invite a guardian",
          tableName: "Account",
          comment: "Opens the guardian settings on the web to invite a parent or guardian")
      }
      .buttonStyle(.borderedProminent)
    }
  }

  private func failureMessage(_ failure: PlusAccessFailure) -> Text {
    if failure == .network {
      return Text(
        "Check your connection and try again.",
        tableName: "Account",
        comment: "Recovery guidance when a guardian approval request can't reach Zoonk")
    }

    return Text(
      "We couldn't ask your guardian. Try again in a moment.",
      tableName: "Account",
      comment: "Recovery guidance when a guardian approval request fails")
  }
}

private struct PlusAccessFailureView: View {
  let failure: PlusAccessFailure
  let retry: @MainActor () async -> Void

  var body: some View {
    ContentUnavailableView {
      Label {
        Text(
          "Plus is unavailable",
          tableName: "Account",
          comment: "Title when the app can't check whether the learner can buy Plus")
      } icon: {
        Image(systemName: failure == .network ? "wifi.exclamationmark" : "exclamationmark.triangle")
      }
    } description: {
      if failure == .network {
        Text(
          "Check your connection and try again.",
          tableName: "Account",
          comment: "Recovery guidance when checking Plus access fails offline")
      } else {
        Text(
          "Please try again in a moment.",
          tableName: "Account",
          comment: "Recovery guidance when checking Plus access fails")
      }
    } actions: {
      Button {
        Task {
          await retry()
        }
      } label: {
        Text(
          "Try again",
          tableName: "Account",
          comment: "Checks again whether the learner can buy Plus")
      }
      .buttonStyle(.borderedProminent)
    }
  }
}

extension View {
  fileprivate func plusNavigationTitle() -> some View {
    navigationTitle(
      Text(
        "Zoonk Plus",
        tableName: "Account",
        comment: "Title of the native Zoonk Plus subscription screen")
    )
    .toolbarTitleDisplayMode(.inline)
  }
}
