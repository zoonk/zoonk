import StoreKit
import SwiftUI

private enum AccountDestination: Hashable {
  case createAccount
  case deleteAccount(AccountDeletionDestination)
  case memory
  case preferences
  case plus(AccountSubscription)
  case profile
  case subscription(UUID)
}

private struct AccountDeletionDestination: Hashable {
  let email: String
  let hasAppleAccount: Bool
  let subscription: AccountSubscription?
}

struct AccountSheet: View {
  /// A guest gets sign-in instead of the hub. Any sign-in made in the sheet closes it once the
  /// profile is set up.
  var signsIn = false

  @Environment(\.dismiss) private var dismiss
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(SessionStore.self) private var session
  @State private var isAppStoreSubscriptionManagementPresented = false
  @State private var isGooglePlayManagementPresented = false
  @State private var isFeedbackPresented = false
  @State private var path = [AccountDestination]()
  @State private var isBeside = false

  var body: some View {
    PaneBeside(isAvailable: isShowingHub) {
      NavigationStack {
        accountContent(sectionOpen: AccountSectionOpen(shown: path.first, open: show))
      }
    } content: { isBeside in
      // Beside the list a section is always open over this root.
      NavigationStack(path: $path) {
        Group {
          if isBeside {
            Color.clear
          } else {
            accountContent(sectionOpen: nil)
          }
        }
        .toolbar {
          if !isBeside, !requiresProfileSetup {
            ToolbarItem(placement: .topBarTrailing) {
              closeButton
            }
          }
        }
        .navigationDestination(for: AccountDestination.self) { destination in
          page(destination, isBeside: isBeside)
        }
      }
      .onChange(of: isBeside, initial: true) {
        self.isBeside = isBeside
        openDefaultSectionBeside()
      }
    }
    .onChange(of: session.state) { previous, state in
      reconcileNavigation(from: previous, to: state)
    }
    .onChange(of: path) {
      // Closing a deletion's result leaves nothing of the deleted account to show.
      if session.account == nil, !isShowingDeletion {
        path.removeAll()
      }

      openDefaultSectionBeside()
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
    .sheet(isPresented: $isFeedbackPresented) {
      FeedbackSheet(api: FeedbackAPI.live(), context: FeedbackContext(screen: "account-menu"))
    }
    .task {
      await session.reconcileSynchronizedCredential()
    }
    .onChange(of: isSignedInForGood) { wasSignedIn, isSignedIn in
      if !wasSignedIn, isSignedIn {
        dismiss()
      }
    }
  }

  private var isShowingDeletion: Bool {
    path.contains { if case .deleteAccount = $0 { true } else { false } }
  }

  private var isShowingHub: Bool {
    guard case .signedIn(let account) = session.state else {
      return false
    }

    return isGuest ? !signsIn : !account.needsProfileSetup
  }

  private func show(_ section: AccountDestination) {
    withTransaction(\.disablesAnimations, true) {
      path = [section]
    }
  }

  /// As main: the profile, or preferences for a guest, who has none.
  private func openDefaultSectionBeside() {
    if isBeside, path.isEmpty {
      show(isGuest ? .preferences : .profile)
    }
  }

  private func page(_ destination: AccountDestination, isBeside: Bool) -> some View {
    let isSection = if case .deleteAccount = destination { false } else { true }

    return self.destination(destination)
      .navigationBarBackButtonHidden(isBeside && isSection)
      .toolbar {
        if isBeside, isSection {
          ToolbarItem(placement: .topBarTrailing) {
            closeButton
          }
        }
      }
  }

  @ViewBuilder
  private func destination(_ destination: AccountDestination) -> some View {
    switch destination {
    case .createAccount:
      LoginView()
    case .deleteAccount(let deletion):
      AccountDeletionView(
        email: deletion.email,
        hasAppleAccount: deletion.hasAppleAccount,
        subscription: deletion.subscription)
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
    case .plus(let subscription):
      PlusStatusView(subscription: subscription)
    case .subscription(let appAccountToken):
      SubscriptionView(appAccountToken: appAccountToken)
    }
  }

  private var isSignedInForGood: Bool {
    guard case .signedIn(let account) = session.state else {
      return false
    }

    return !isGuest && !account.needsProfileSetup
  }

  private var closeButton: some View {
    Button(role: .close, action: dismiss.callAsFunction)
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
  private func accountContent(sectionOpen: AccountSectionOpen?) -> some View {
    switch session.state {
    case .restoring:
      ProgressView()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .navigationTitle(accountTitle)
        .toolbarTitleDisplayMode(.inline)
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
          sectionOpen: sectionOpen,
          sendFeedback: { isFeedbackPresented = true },
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
      .navigationTitle(accountTitle)
      .toolbarTitleDisplayMode(.inline)
    }
  }

  private var accountTitle: Text {
    Text("Account", tableName: "Account", comment: "Account sheet navigation title")
  }

  /// Leaves a local deletion result visible until the user dismisses it, and the open pages to
  /// the same learner's updated account.
  private func reconcileNavigation(
    from previous: AccountSessionState, to state: AccountSessionState
  ) {
    switch state {
    case .signedIn(let account) where previous.account?.user.id == account.user.id:
      break
    case .signedIn:
      path.removeAll()
    case .signedOut, .unavailable:
      switch path.last {
      case .createAccount, .memory, .plus, .preferences, .profile, .subscription:
        path.removeAll()
      case .deleteAccount, nil:
        break
      }
    case .restoring:
      break
    }
  }

}

/// A guest gets "Create an account" instead of logging out, which would lose their plan.
private struct SettingsHubView: View {
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(SessionStore.self) private var session
  @Environment(SettingsStore.self) private var settings
  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @ScaledMetric(relativeTo: .body) private var avatarSize = 40.0

  let account: CurrentAccount
  let sectionOpen: AccountSectionOpen?
  let sendFeedback: () -> Void
  let manageAppStoreSubscription: () -> Void
  let showGooglePlayManagement: () -> Void

  var body: some View {
    List {
      if !isGuest {
        Section {
          AccountSectionLink(destination: .profile, sectionOpen: sectionOpen) {
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
        AccountSectionLink(destination: .preferences, sectionOpen: sectionOpen) {
          LabeledContent {
            Group {
              if let buddy = settings.preferences.value?.buddy {
                Text(verbatim: "\(buddy.displayName) · \(appLanguageName)")
              } else {
                Text(appLanguageName)
              }
            }
            .foregroundStyle(.secondary)
          } label: {
            Text("Preferences", tableName: "Account", comment: "Settings row for Preferences")
          }
        }

        AccountSectionLink(destination: .memory, sectionOpen: sectionOpen) {
          LabeledContent {
            if let count = settings.memory.value?.facts.count {
              Text(count, format: .number)
                .monospacedDigit()
                .foregroundStyle(.secondary)
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
          sectionOpen: sectionOpen,
          manageAppStoreSubscription: manageAppStoreSubscription,
          showGooglePlayManagement: showGooglePlayManagement)

        Link(destination: AccountLinks.support) {
          Text("Help", tableName: "Account", comment: "Settings row that opens Zoonk's help pages")
        }
        .foregroundStyle(.primary)

        Button(action: sendFeedback) {
          Text(
            "Send feedback", tableName: "Account",
            comment: "Settings row that opens the form to write to Zoonk")
        }
        .foregroundStyle(.primary)
      }

      Section {
        if isGuest {
          AccountSectionLink(destination: .createAccount, sectionOpen: sectionOpen) {
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
  }

  private var isGuest: Bool {
    learner.summary.value?.identity.isAnonymous == true
  }
}

private struct AccountSectionOpen {
  let shown: AccountDestination?
  let open: (AccountDestination) -> Void
}

/// Beside the sections a row shows its section there instead of pushing it.
private struct AccountSectionLink<Label: View>: View {
  let destination: AccountDestination?
  let sectionOpen: AccountSectionOpen?
  @ViewBuilder let label: Label

  var body: some View {
    if let sectionOpen, let destination {
      let isShown = sectionOpen.shown == destination

      Button {
        sectionOpen.open(destination)
      } label: {
        label
      }
      .foregroundStyle(.primary)
      .listRowBackground(isShown ? Color(.tertiarySystemFill) : nil)
      .accessibilityAddTraits(isShown ? .isSelected : [])
    } else {
      NavigationLink(value: destination) {
        label
      }
    }
  }
}

/// Captured in the navigation value so the deletion result stays visible after the session is removed.
private func makeDeletionDestination(_ account: CurrentAccount) -> AccountDeletionDestination {
  AccountDeletionDestination(
    email: account.user.email,
    hasAppleAccount: account.account.deletion.hasAppleAccount,
    subscription: account.account.subscription)
}

private struct AccountSubscriptionRow: View {
  let access: AccountAccess
  let appAccountToken: UUID?
  let sectionOpen: AccountSectionOpen?
  let manageAppStoreSubscription: () -> Void
  let showGooglePlayManagement: () -> Void

  @ViewBuilder
  var body: some View {
    switch access.subscriptionAction {
    case .subscribe:
      AccountSectionLink(
        destination: appAccountToken.map(AccountDestination.subscription), sectionOpen: sectionOpen
      ) {
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
      AccountSectionLink(
        destination: access.subscription.map(AccountDestination.plus), sectionOpen: sectionOpen
      ) {
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
    LabeledContent {
      if access.subscriptionAction != .subscribe {
        PlusMark(
          accessibilityLabel: Text(
            "Plus", tableName: "Account", comment: "Zoonk Plus, the plan's name"))
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
