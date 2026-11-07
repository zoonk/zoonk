import SwiftUI

private enum AccountDestination: Hashable {
  case certificate(code: String)
  case certificates
  case createAccount
  case deleteAccount(AccountDeletionDestination)
  case memory
  case preferences
  case plus(AccountSubscription)
  case profile
  case reminders
  case subscription(UUID)
}

enum AccountPage: Hashable {
  case certificates
  case memory
  case preferences
  case profile
  case reminders
}

extension AccountDestination {
  fileprivate init(_ page: AccountPage) {
    switch page {
    case .certificates: self = .certificates
    case .memory: self = .memory
    case .preferences: self = .preferences
    case .profile: self = .profile
    case .reminders: self = .reminders
    }
  }
}

private struct AccountDeletionDestination: Hashable {
  let email: String
  let hasAppleAccount: Bool
  let subscription: AccountSubscription?
}

struct AccountSheet: View {
  /// A guest gets sign-in instead of the hub. Any sign-in made in the sheet closes it once the
  /// profile is set up.
  let signsIn: Bool

  @Environment(\.dismiss) private var dismiss
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(SessionStore.self) private var session
  @State private var isFeedbackPresented = false
  @State private var path = [AccountDestination]()
  @State private var isBeside = false
  @State private var opensAt: AccountPage?

  /// `page` opens over the hub as if picked there, so back leads to the hub.
  init(signsIn: Bool = false, page: AccountPage? = nil) {
    self.signsIn = signsIn
    _opensAt = State(initialValue: page)
  }

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
    // Pushed once the hub is in place: a stack that starts at the page lays its list out without
    // the sheet's trailing margin.
    .onChange(of: isShowingHub, initial: true) {
      if let opensAt, isShowingHub {
        show(AccountDestination(opensAt))
        self.opensAt = nil
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
    .feedbackSheet(
      isPresented: $isFeedbackPresented, context: FeedbackContext(screen: "account-menu")
    )
    .task {
      await session.reconcileSynchronizedCredential()
    }
    .onChange(of: isSignedInForGood) { wasSignedIn, isSignedIn in
      if wasSignedIn == false, isSignedIn == true {
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
    let isSection =
      switch destination {
      case .certificate, .deleteAccount: false
      default: true
      }

    return self.destination(destination)
      // Inline like the hub: a page the sheet opens at can't take it from a hub shown before it.
      .toolbarTitleDisplayMode(.inline)
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
    case .certificate(let code):
      CertificateScreen(code: code)
    case .certificates:
      CertificatesScreen { code in
        path.append(.certificate(code: code))
      }
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
    case .reminders:
      RemindersView {
        path.append(.createAccount)
      }
    case .profile:
      // A guest has no profile: creating the account gives them one.
      if isGuest {
        LoginView()
      } else if let account = session.account {
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

  /// Nil while the saved sign-in is checked or can't be: only a sign-in made in the sheet closes
  /// it.
  private var isSignedInForGood: Bool? {
    switch session.state {
    case .restoring, .unavailable: nil
    case .signedIn(let account): !isGuest && !account.needsProfileSetup
    case .signedOut: false
    }
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
          sendFeedback: { isFeedbackPresented = true }
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
        BusyButton(isBusy: session.isWorking, icon: .retry) {
          Task {
            await session.retryRestore()
          }
        } label: {
          Text("Try again", tableName: "Account", comment: "Retries loading the saved account")
        }
        .buttonStyle(.mainAction)
      }
      .navigationTitle(accountTitle)
      .toolbarTitleDisplayMode(.inline)
    }
  }

  private var accountTitle: Text {
    Text("Account", tableName: "Account", comment: "Account sheet navigation title")
  }

  /// Leaves a local deletion result visible until the user dismisses it, and the open pages to
  /// the same learner's updated or restored account.
  private func reconcileNavigation(
    from previous: AccountSessionState, to state: AccountSessionState
  ) {
    switch state {
    case .signedIn(let account)
    where previous == .restoring || previous == .unavailable
      || previous.account?.user.id == account.user.id:
      break
    case .signedIn:
      path.removeAll()
    case .signedOut, .unavailable:
      switch path.last {
      case .certificate, .certificates, .createAccount, .memory, .plus, .preferences, .profile,
        .reminders, .subscription:
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
  @Environment(CertificatesStore.self) private var certificates
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(SessionStore.self) private var session
  @Environment(SettingsStore.self) private var settings
  @Environment(StudyRemindersStore.self) private var reminders
  @ScaledMetric(relativeTo: .body) private var avatarSize = 36.0

  let account: CurrentAccount
  let sectionOpen: AccountSectionOpen?
  let sendFeedback: () -> Void

  var body: some View {
    ZoonkList {
      Section {
        if !isGuest {
          AccountSectionLink(destination: .profile, sectionOpen: sectionOpen) {
            AccessibilityStack(spacing: 12, stackedSpacing: 8) {
              AccountAvatar(user: account.user, size: avatarSize)
                .accessibilityHidden(true)

              VStack(alignment: .leading, spacing: 1) {
                Text(account.user.preferredName)
                  .typeStyle(.rowTitle)

                Text(account.user.email)
                  .typeStyle(.meta)
                  .foregroundStyle(.mutedForeground)
              }
            }
          }
        }

        AccountSectionLink(destination: .certificates, sectionOpen: sectionOpen) {
          ListRow(
            Text(
              "Certificates", tableName: "Account",
              comment: "Settings row for the learner's certificates")
          ) {
            EmptyView()
          } trailing: {
            if let count = certificates.list.value?.count {
              Text(count, format: .number)
            }
          }
        }
      }

      Section {
        AccountSectionLink(destination: .preferences, sectionOpen: sectionOpen) {
          ListRow(
            Text("Preferences", tableName: "Account", comment: "Settings row for Preferences")
          ) {
            EmptyView()
          } trailing: {
            // Words, not data: main's summary is in the sans face.
            Group {
              if let buddy = settings.preferences.value?.buddy {
                Text(verbatim: "\(buddy.displayName)\u{00A0}· \(appLanguageName)")
              } else {
                Text(appLanguageName)
              }
            }
            .typeStyle(.meta)
          }
        }

        AccountSectionLink(destination: .reminders, sectionOpen: sectionOpen) {
          ListRow(
            Text("Reminders", tableName: "Account", comment: "Settings row for study reminders")
          ) {
            EmptyView()
          } trailing: {
            Group {
              if let reminder = reminders.reminder.value {
                if reminder.emailOn || reminder.pushOn {
                  Text(ReminderTime.formatted(reminder.time))
                } else {
                  Text("Off", tableName: "Account", comment: "Study reminders are off")
                }
              }
            }
            .typeStyle(.meta)
          }
        }

        AccountSectionLink(destination: .memory, sectionOpen: sectionOpen) {
          ListRow(
            Text("Memory", tableName: "Account", comment: "Settings row for what Zoonk remembers")
          ) {
            EmptyView()
          } trailing: {
            if let count = settings.memory.value?.facts.count {
              Text(count, format: .number)
            }
          }
        }
      }

      Section {
        AccountSubscriptionRow(
          access: account.account,
          appAccountToken: UUID(uuidString: account.user.id),
          sectionOpen: sectionOpen)

        Link(destination: AccountLinks.support) {
          ListRow(
            Text(
              "Help", tableName: "Account", comment: "Settings row that opens Zoonk's help pages"))
        }
        .foregroundStyle(.primary)

        Button(action: sendFeedback) {
          ListRow(
            Text(
              "Send feedback", tableName: "Account",
              comment: "Settings row that opens the form to write to Zoonk"))
        }
        .foregroundStyle(.primary)
      }

      Section {
        if isGuest {
          AccountSectionLink(destination: .createAccount, sectionOpen: sectionOpen) {
            ListRow(
              Text(
                "Create an account", tableName: "Account",
                comment: "Settings row where a guest creates the account that keeps their plan"))
          }
        } else {
          BusyButton(isBusy: session.isWorking, role: .destructive, isRow: true) {
            Task {
              await session.signOut()
            }
          } label: {
            Text("Log out", tableName: "Account", comment: "Account log-out action")
              .typeStyle(.rowTitle)
          }
          .foregroundStyle(.destructiveText)
        }
      }

      if session.failure != nil {
        Section {
          AccountFailureMessage(failure: session.failure)
        }
      }
    }
    .loads(
      settings.preferences, settings.memory, reminders.reminder, certificates.list,
      refreshable: false)
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
      .currentRow(isShown)
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

  var body: some View {
    AccountSectionLink(destination: destination, sectionOpen: sectionOpen) {
      ListRow(subscriptionLabel) {
        EmptyView()
      } trailing: {
        if access.subscription != nil {
          PlusMark(
            accessibilityLabel: Text(
              "Plus", tableName: "Account", comment: "Zoonk Plus, the plan's name"))
        }
      }
    }
    .accessibilityLabel(subscriptionLabel)
    .accessibilityValue(status)
  }

  private var destination: AccountDestination? {
    if let subscription = access.subscription {
      .plus(subscription)
    } else {
      appAccountToken.map(AccountDestination.subscription)
    }
  }

  private var status: Text {
    guard let subscription = access.subscription else {
      return freeStatus
    }

    return switch StoreSubscriptionProvider(rawValue: subscription.provider) {
    case .apple: appStoreStatus
    case .google: googlePlayStatus
    case nil: activeStatus
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
}

#Preview {
  AccountSheet()
    .environment(SessionStore.preview())
    .environment(AppStoreSubscriptionStore.live())
}
