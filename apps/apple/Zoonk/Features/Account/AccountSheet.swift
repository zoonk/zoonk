import StoreKit
import SwiftUI

private enum AccountDestination: Hashable {
  case deleteAccount(AccountDeletionDestination)
  case profile
  case subscription(UUID)
}

private struct AccountDeletionDestination: Hashable {
  let email: String
  let hasAppleAccount: Bool
  let storeSubscriptionProvider: StoreSubscriptionProvider?
}

struct AccountSheet: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(SessionStore.self) private var session
  @State private var isAppStoreSubscriptionManagementPresented = false
  @State private var isGooglePlayManagementPresented = false
  @State private var path = [AccountDestination]()

  let openCatalog: () -> Void

  var body: some View {
    NavigationStack(path: $path) {
      accountContent
        .toolbar {
          if !requiresProfileSetup {
            ToolbarItem(placement: .topBarTrailing) {
              closeButton
            }
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
          case .subscription(let appAccountToken):
            SubscriptionView(appAccountToken: appAccountToken)
          }
        }
        .onChange(of: session.state) { _, state in
          reconcileNavigation(state)
        }
    }
    .interactiveDismissDisabled(requiresProfileSetup)
    .presentationDetents([.large])
    .presentationDragIndicator(requiresProfileSetup ? .hidden : .visible)
    .presentationSizing(.page)
    .manageSubscriptionsSheet(isPresented: $isAppStoreSubscriptionManagementPresented)
    .alert(
      Text(
        "Managed on Google Play",
        tableName: "Account",
        comment: "Title explaining where a Google-owned subscription is managed"),
      isPresented: $isGooglePlayManagementPresented
    ) {
      Button(role: .cancel) {
      } label: {
        Text("OK", tableName: "Account", comment: "Dismisses subscription management guidance")
      }
    } message: {
      Text(
        "Use Google Play on an Android device to change or cancel this subscription.",
        tableName: "Account",
        comment:
          "Explains how to manage a Google-owned subscription without linking to external purchasing"
      )
    }
    .task {
      await session.reconcileSynchronizedCredential()
    }
  }

  private var closeButton: some View {
    Button(action: dismiss.callAsFunction) {
      Image(systemName: "xmark")
    }
    .accessibilityLabel(
      Text("Close", tableName: "Account", comment: "Closes the account sheet"))
  }

  private var requiresProfileSetup: Bool {
    guard case .signedIn(let account) = session.state else {
      return false
    }

    return account.needsProfileSetup
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
          manageAppStoreSubscription: { isAppStoreSubscriptionManagementPresented = true },
          openCatalog: showCatalog,
          openSubscription: { showSubscription(for: account) },
          showGooglePlayManagement: { isGooglePlayManagementPresented = true }
        )
        .navigationTitle(
          Text("Account", tableName: "Account", comment: "Account sheet navigation title")
        )
        .toolbarTitleDisplayMode(.inline)
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
      .toolbarTitleDisplayMode(.inline)
    }
  }

  /// Returns to the current account overview after authentication or synchronized account changes, while leaving a local deletion result visible until the user dismisses it.
  private func reconcileNavigation(_ state: AccountSessionState) {
    switch state {
    case .signedIn:
      path.removeAll()
    case .signedOut, .unavailable:
      switch path.last {
      case .profile, .subscription:
        path.removeAll()
      case .deleteAccount, nil:
        break
      }
    case .restoring:
      break
    }
  }

  /// Closes the modal before moving to the app's native public catalog without opening a duplicate web surface.
  private func showCatalog() {
    dismiss()
    openCatalog()
  }

  private func showSubscription(for account: CurrentAccount) {
    guard let appAccountToken = UUID(uuidString: account.user.id) else {
      return
    }

    path.append(.subscription(appAccountToken))
  }

}

private struct SignedInAccountView: View {
  @Environment(SessionStore.self) private var session

  let account: CurrentAccount
  let deleteAccount: () -> Void
  let editProfile: () -> Void
  let manageAppStoreSubscription: () -> Void
  let openCatalog: () -> Void
  let openSubscription: () -> Void
  let showGooglePlayManagement: () -> Void

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
        Button(action: openCatalog) {
          AccountRowLabel(
            title: Text(
              "Browse courses",
              tableName: "Account",
              comment: "Account option that opens the public course catalog"),
            systemImage: "square.grid.2x2")
        }
      }

      Section {
        Button(action: editProfile) {
          AccountRowLabel(
            title: Text("Profile", tableName: "Account", comment: "Account option for profile"),
            systemImage: "person")
        }

        AccountSubscriptionRow(
          access: account.account,
          manageAppStoreSubscription: manageAppStoreSubscription,
          openSubscription: openSubscription,
          showGooglePlayManagement: showGooglePlayManagement)
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
    .tint(.primary)
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
  let manageAppStoreSubscription: () -> Void
  let openSubscription: () -> Void
  let showGooglePlayManagement: () -> Void

  @ViewBuilder
  var body: some View {
    switch access.subscriptionAction {
    case .subscribe:
      Button(action: openSubscription) {
        rowLabel(status: freeStatus)
      }
      .accessibilityLabel(subscriptionLabel)
      .accessibilityValue(freeStatus)
    case .manageAppStore:
      Button(action: manageAppStoreSubscription) {
        rowLabel(status: appStoreStatus)
      }
      .accessibilityLabel(subscriptionLabel)
      .accessibilityValue(appStoreStatus)
    case .explainGooglePlayManagement:
      Button(action: showGooglePlayManagement) {
        rowLabel(status: googlePlayStatus)
      }
      .accessibilityLabel(subscriptionLabel)
      .accessibilityValue(googlePlayStatus)
    case .contactSupport:
      Link(destination: AccountLinks.support) {
        rowLabel(status: activeStatus)
      }
      .accessibilityLabel(subscriptionLabel)
      .accessibilityValue(activeStatus)
    }
  }

  private var subscriptionLabel: Text {
    Text(
      "Subscription",
      tableName: "Account",
      comment: "Account option for subscription")
  }

  private var freeStatus: Text {
    Text(
      "Free",
      tableName: "Account",
      comment: "Status shown when the account has no active subscription")
  }

  private var appStoreStatus: Text {
    Text(
      "App Store",
      tableName: "Account",
      comment: "Status shown when an active subscription is managed by the App Store")
  }

  private var googlePlayStatus: Text {
    Text(
      "Google Play",
      tableName: "Account",
      comment: "Status shown when an active subscription is managed by Google Play")
  }

  private var activeStatus: Text {
    Text(
      "Active",
      tableName: "Account",
      comment: "Status for an active subscription")
  }

  private func rowLabel(status: Text) -> some View {
    HStack {
      AccountRowLabel(
        title: subscriptionLabel,
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
    .environment(AppStoreSubscriptionStore.live())
}
