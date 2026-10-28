import StoreKit
import SwiftUI

private enum AccountDestination: Hashable {
  case deleteAccount(AccountDeletionDestination)
  case memory
  case preferences
  case profile
  case subscription(UUID)
}

private struct AccountDeletionDestination: Hashable {
  let email: String
  let hasAppleAccount: Bool
  let storeSubscriptionProvider: StoreSubscriptionProvider?
}

struct AccountSheet: View {
  /// Opened to log in or create an account (`.signIn`): a guest gets sign-in instead of the hub.
  /// Any sign-in made in the sheet closes it, after the profile an account needs.
  var signsIn = false

  @Environment(\.dismiss) private var dismiss
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(SessionStore.self) private var session
  @State private var isAppStoreSubscriptionManagementPresented = false
  @State private var isGooglePlayManagementPresented = false
  @State private var path = [AccountDestination]()

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
          case .memory:
            MemoryView()
          case .preferences:
            PreferencesView()
          case .profile:
            if let account = session.account {
              ProfileEditorView(account: account, isRequiredSetup: false) {
                path.append(.deleteAccount(makeDeletionDestination(account)))
              }
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
    // Signing in here (opened to sign in, a guest's "Create an account", or after logging out
    // here) lands on the app once the account is set up, as main's sign-in does.
    .onChange(of: isSignedInForGood) { wasSignedIn, isSignedIn in
      if !wasSignedIn, isSignedIn {
        dismiss()
      }
    }
  }

  /// Signed in to an account whose profile is set up: what sign-in mode waits for.
  private var isSignedInForGood: Bool {
    guard case .signedIn(let account) = session.state else {
      return false
    }

    return !isGuest && !account.needsProfileSetup
  }

  private var closeButton: some View {
    Button(action: dismiss.callAsFunction) {
      Image(systemName: "xmark")
    }
    .accessibilityLabel(
      Text("Close", tableName: "Account", comment: "Closes the account sheet"))
  }

  private var isGuest: Bool {
    learner.summary.value?.identity.isAnonymous == true
  }

  private var requiresProfileSetup: Bool {
    guard case .signedIn(let account) = session.state, !isGuest else {
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
    case .signedIn where signsIn && isGuest:
      LoginView()
    case .signedIn(let account):
      // A guest's anonymous account has no name to set up: the hub offers "Create an account".
      if account.needsProfileSetup, !isGuest {
        ProfileEditorView(account: account, isRequiredSetup: true)
          .id(account.user.id)
      } else {
        SettingsHubView(
          account: account,
          manageAppStoreSubscription: { isAppStoreSubscriptionManagementPresented = true },
          showGooglePlayManagement: { isGooglePlayManagementPresented = true }
        )
        .navigationTitle(
          Text("Settings", tableName: "Account", comment: "Title of the settings hub")
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
        .buttonStyle(.mainAction)
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
      case .memory, .preferences, .profile, .subscription:
        path.removeAll()
      case .deleteAccount, nil:
        break
      }
    case .restoring:
      break
    }
  }

}

/// The settings hub (main's `/settings`): whose account it is (its row opens the profile), the
/// learner's own pages, then the plan and help, then the way out. A guest gets "Create an account"
/// instead, since logging out would lose their plan.
private struct SettingsHubView: View {
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(SessionStore.self) private var session
  @Environment(SettingsStore.self) private var settings
  @State private var isHelpPresented = false
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  /// Grows with the name and email beside it.
  @ScaledMetric(relativeTo: .body) private var avatarSize = 40.0

  let account: CurrentAccount
  let manageAppStoreSubscription: () -> Void
  let showGooglePlayManagement: () -> Void

  var body: some View {
    List {
      if !isGuest {
        Section {
          NavigationLink(value: AccountDestination.profile) {
            // Large text puts the avatar above the name, so neither squeezes the other.
            let layout =
              dynamicTypeSize.isAccessibilitySize
              ? AnyLayout(VStackLayout(alignment: .leading, spacing: 8))
              : AnyLayout(HStackLayout(spacing: 12))

            layout {
              AccountAvatar(user: account.user, size: avatarSize)
                .accessibilityHidden(true)

              VStack(alignment: .leading) {
                Text(account.user.preferredName)

                Text(account.user.email)
                  .font(.subheadline)
                  .foregroundStyle(.secondary)
              }
            }
          }
        }
      }

      Section {
        NavigationLink(value: AccountDestination.preferences) {
          LabeledContent {
            if let buddy = settings.preferences.value?.buddy {
              Text(buddy.displayName)
            }
          } label: {
            Text("Preferences", tableName: "Account", comment: "Settings row for Preferences")
          }
        }

        NavigationLink(value: AccountDestination.memory) {
          LabeledContent {
            if let count = settings.memory.value?.facts.count {
              Text(count, format: .number)
                .monospacedDigit()
            }
          } label: {
            Text("Memory", tableName: "Account", comment: "Settings row for what Zoonk remembers")
          }
        }
      }

      Section {
        AccountSubscriptionRow(
          access: account.account,
          appAccountToken: UUID(uuidString: account.user.id),
          manageAppStoreSubscription: manageAppStoreSubscription,
          showGooglePlayManagement: showGooglePlayManagement)

        Button {
          isHelpPresented = true
        } label: {
          Text("Help", tableName: "Account", comment: "Settings row to ask the team for help")
        }
        .foregroundStyle(.primary)
      }

      Section {
        if isGuest {
          NavigationLink {
            LoginView()
          } label: {
            Text(
              "Create an account", tableName: "Account",
              comment: "Settings row where a guest creates the account that keeps their plan")
          }
        } else {
          Button(role: .destructive) {
            Task {
              await session.signOut()
            }
          } label: {
            Text("Log out", tableName: "Account", comment: "Account log-out action")
          }
          .disabled(session.isWorking)
        }
      }

      if session.failure != nil {
        Section {
          AccountFailureMessage(failure: session.failure)
        }
      }
    }
    .loads(settings.preferences, settings.memory, refreshable: false)
    .sheet(isPresented: $isHelpPresented) {
      FeedbackSheet(api: FeedbackAPI.live())
    }
  }

  private var isGuest: Bool {
    learner.summary.value?.identity.isAnonymous == true
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
  let appAccountToken: UUID?
  let manageAppStoreSubscription: () -> Void
  let showGooglePlayManagement: () -> Void

  @ViewBuilder
  var body: some View {
    switch access.subscriptionAction {
    case .subscribe:
      NavigationLink(value: appAccountToken.map(AccountDestination.subscription)) {
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

  /// The row says "Plus" once subscribed, as main's; VoiceOver hears where it's managed.
  private func rowLabel(status: Text) -> some View {
    LabeledContent {
      if access.subscriptionAction != .subscribe {
        PlusMark()
      }
    } label: {
      subscriptionLabel
    }
    .foregroundStyle(.primary)
  }
}

#Preview {
  AccountSheet()
    .environment(SessionStore.preview())
    .environment(AppStoreSubscriptionStore.live())
}
