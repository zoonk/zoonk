import SwiftUI

private enum AccountDestination: Hashable {
  case deleteAccount(AccountDeletionDestination)
  case profile
}

private struct AccountDeletionDestination: Hashable {
  let email: String
  let hasAppleAccount: Bool
  let storeSubscriptionProvider: StoreSubscriptionProvider?
}

struct AccountSheet: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(SessionStore.self) private var session
  @State private var path = [AccountDestination]()

  let openCourses: () -> Void

  var body: some View {
    NavigationStack(path: $path) {
      accountContent
        .toolbar {
          ToolbarItem(placement: .topBarTrailing) {
            closeButton
          }
        }
        .navigationDestination(for: AccountDestination.self) { destination in
          switch destination {
          case .deleteAccount(let deletion):
            AccountDeletionView(
              email: deletion.email,
              hasAppleAccount: deletion.hasAppleAccount,
              storeSubscriptionProvider: deletion.storeSubscriptionProvider)
          case .profile:
            if let account = session.account {
              ProfileEditorView(account: account, isRequiredSetup: false)
                .id(account.user.id)
            }
          }
        }
        .onChange(of: session.state) { _, state in
          reconcileNavigation(state)
        }
    }
    .presentationDetents([.large])
    .presentationDragIndicator(.visible)
    .presentationSizing(.page)
    .task {
      await session.reconcileSynchronizedCredential()
      #if DEBUG
        presentRequestedUITestingDestination()
      #endif
    }
  }

  private var closeButton: some View {
    Button(action: dismiss.callAsFunction) {
      Image(systemName: "xmark")
    }
    .accessibilityLabel(
      Text("Close", tableName: "Account", comment: "Closes the account sheet"))
  }

  @ViewBuilder
  private var accountContent: some View {
    switch session.state {
    case .restoring:
      ProgressView()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    case .signedOut:
      LoginView()
    case .signedIn(let account):
      if account.needsProfileSetup {
        ProfileEditorView(account: account, isRequiredSetup: true)
          .id(account.user.id)
      } else {
        SignedInAccountView(
          account: account,
          deleteAccount: { path.append(.deleteAccount(makeDeletionDestination(account))) },
          editProfile: { path.append(.profile) },
          openCourses: showCourses
        )
        .navigationTitle(
          Text("Account", tableName: "Account", comment: "Account sheet navigation title")
        )
      }
    case .unavailable:
      ContentUnavailableView {
        Label {
          Text(
            "Account unavailable",
            tableName: "Account",
            comment: "Title shown when the saved account cannot be loaded")
        } icon: {
          Image(systemName: "wifi.exclamationmark")
        }
      } description: {
        Text(
          "Zoonk couldn't load your account. Your sign-in is still safely stored.",
          tableName: "Account",
          comment: "Explains that a temporary account load failure did not remove the session")
      } actions: {
        Button {
          Task {
            await session.retryRestore()
          }
        } label: {
          Text("Try again", tableName: "Account", comment: "Retries loading the saved account")
        }
        .buttonStyle(.borderedProminent)
        .disabled(session.isWorking)
      }
      .navigationTitle(
        Text("Account", tableName: "Account", comment: "Account sheet navigation title")
      )
    }
  }

  /// Returns to the current account overview after authentication or synchronized account changes, while leaving a local deletion result visible until the user dismisses it.
  private func reconcileNavigation(_ state: AccountSessionState) {
    switch state {
    case .signedIn:
      path.removeAll()
    case .signedOut, .unavailable:
      if path.last == .profile {
        path.removeAll()
      }
    case .restoring:
      break
    }
  }

  /// Closes the modal before moving to the app's native courses section, matching the web account menu without opening a duplicate web surface.
  private func showCourses() {
    dismiss()
    openCourses()
  }

  #if DEBUG
    /// Opens nested account forms directly during cross-platform UI review so remote and gaze-driven simulators can render the same states as touch devices.
    private func presentRequestedUITestingDestination() {
      guard path.isEmpty, let account = session.account else {
        return
      }

      if ProcessInfo.processInfo.arguments.contains("--ui-testing-profile") {
        path.append(.profile)
        return
      }

      if ProcessInfo.processInfo.arguments.contains("--ui-testing-delete-account") {
        path.append(.deleteAccount(makeDeletionDestination(account)))
      }
    }
  #endif
}

private struct SignedInAccountView: View {
  @Environment(SessionStore.self) private var session

  let account: CurrentAccount
  let deleteAccount: () -> Void
  let editProfile: () -> Void
  let openCourses: () -> Void

  var body: some View {
    List {
      Section {
        HStack(spacing: 12) {
          AccountAvatar(user: account.user, size: 56)
            .accessibilityHidden(true)

          VStack(alignment: .leading, spacing: 2) {
            Text(account.user.preferredName)
              .font(.headline)

            Text(account.user.email)
              .font(.subheadline)
              .foregroundStyle(.secondary)
          }
        }
        .padding(.vertical, 4)
      }

      Section {
        Button(action: openCourses) {
          AccountRowLabel(
            title: Text(
              "My courses",
              tableName: "Account",
              comment: "Account option that opens the learner's courses"),
            systemImage: "square.grid.2x2")
        }
      }

      Section {
        Button(action: editProfile) {
          AccountRowLabel(
            title: Text("Profile", tableName: "Account", comment: "Account option for profile"),
            systemImage: "person")
        }

        AccountSubscriptionRow(access: account.account)
      }

      Section {
        Link(destination: AccountLinks.blog) {
          AccountRowLabel(
            title: Text("Blog", tableName: "Account", comment: "Account option for the blog"),
            systemImage: "newspaper")
        }

        Link(destination: AccountLinks.support) {
          AccountRowLabel(
            title: Text(
              "Feedback & Support",
              tableName: "Account",
              comment: "Account option for feedback and support"),
            systemImage: "questionmark.circle")
        }
      }

      Section {
        Button {
          Task {
            await session.signOut()
          }
        } label: {
          AccountRowLabel(
            title: Text("Sign out", tableName: "Account", comment: "Account sign-out action"),
            systemImage: "rectangle.portrait.and.arrow.right")
        }
        .disabled(session.isWorking)
      }

      Section {
        Button(role: .destructive, action: deleteAccount) {
          AccountRowLabel(
            title: Text(
              "Delete account",
              tableName: "Account",
              comment: "Account option that opens permanent account deletion"),
            systemImage: "trash"
          )
          .foregroundStyle(.red)
        }
        .disabled(session.isWorking)
      }

      if session.failure != nil {
        Section {
          AccountFailureMessage(failure: session.failure)
        }
      }
    }
  }
}

/// Captures the signed-in identity and billing state in the navigation value so the deletion result can remain visible after the session is removed.
private func makeDeletionDestination(_ account: CurrentAccount) -> AccountDeletionDestination {
  AccountDeletionDestination(
    email: account.user.email,
    hasAppleAccount: account.account.deletion.hasAppleAccount,
    storeSubscriptionProvider: account.account.subscription.flatMap {
      StoreSubscriptionProvider(rawValue: $0.provider)
    })
}

private struct AccountSubscriptionRow: View {
  let access: AccountAccess

  @ViewBuilder
  var body: some View {
    if let destination {
      Link(destination: destination) {
        rowLabel(status: activeStatus)
      }
    } else {
      rowLabel(
        status: Text(
          "Free",
          tableName: "Account",
          comment: "Status shown when the account has no active subscription"))
    }
  }

  private var destination: URL? {
    guard let subscription = access.subscription else {
      return nil
    }

    return StoreSubscriptionProvider(rawValue: subscription.provider)?.managementURL
      ?? AccountLinks.support
  }

  private var activeStatus: Text {
    Text(
      "Active",
      tableName: "Account",
      comment: "Status for an active subscription")
  }

  /// Keeps the subscription option visually consistent while routing only App Store-owned billing to Apple's management surface.
  private func rowLabel(status: Text) -> some View {
    HStack {
      AccountRowLabel(
        title: Text(
          "Subscription",
          tableName: "Account",
          comment: "Account option for subscription"),
        systemImage: "sparkles")

      Spacer()

      status
        .font(.subheadline)
        .foregroundStyle(.secondary)
    }
  }
}

private struct AccountRowLabel: View {
  let title: Text
  let systemImage: String

  var body: some View {
    Label {
      title
    } icon: {
      Image(systemName: systemImage)
    }
  }
}

#Preview {
  AccountSheet {}
    .environment(SessionStore.preview())
}
