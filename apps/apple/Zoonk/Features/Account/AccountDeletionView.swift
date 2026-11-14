import StoreKit
import SwiftUI

private enum AccountDeletionPhase: Equatable {
  case ready
  case emailReauthentication
  case deleted
  case deletedWithManualAppleRevocation
}

private enum PendingAccountDeletion {
  case apple(AppleSignInCredentials)
  case direct
  case email
}

struct AccountDeletionView: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(SessionStore.self) private var session
  @Environment(SettingsStore.self) private var settings
  @State private var code = ""
  @State private var hasSentCode = false
  @State private var isAppStoreSubscriptionManagementPresented = false
  @State private var isConfirmingDeletion = false
  @State private var isPerformingDeletion = false
  @State private var pendingDeletion: PendingAccountDeletion?
  @State private var phase = AccountDeletionPhase.ready

  let email: String
  let hasAppleAccount: Bool
  let subscription: AccountSubscription?

  var body: some View {
    content
      .barTitleAfterHero(
        String(
          localized: "Delete account", table: "Account",
          comment: "Account deletion navigation title")
      )
      .confirmationDialog(
        Text(
          "Delete your account?",
          tableName: "Account"),
        isPresented: $isConfirmingDeletion,
        titleVisibility: .visible
      ) {
        Button(role: .destructive) {
          Task {
            await performConfirmedDeletion()
          }
        } label: {
          Text(
            "Delete account",
            tableName: "Account",
            comment: "Confirms permanent account deletion")
        }

        Button(role: .cancel) {
          pendingDeletion = nil
        } label: {
          Text("Cancel", tableName: "Account", comment: "Cancels permanent account deletion")
        }
      } message: {
        Text(
          verbatim: [deletedForGood, webPlusNotice]
            .compactMap(\.self)
            .joined(separator: "\n\n"))
      }
      .loads(settings.webPlus, refreshable: false)
      .onAppear {
        session.clearFailure()
      }
      .onChange(of: session.account?.user.id) { _, accountId in
        dismissStaleDeletion(accountId: accountId)
      }
      .manageSubscriptionsSheet(isPresented: $isAppStoreSubscriptionManagementPresented)
  }

  @ViewBuilder
  private var content: some View {
    switch phase {
    case .ready, .emailReauthentication:
      deletionForm
    case .deleted:
      deletedContent
    case .deletedWithManualAppleRevocation:
      manualAppleRevocationContent
    }
  }

  private var deletionForm: some View {
    ZoonkList {
      Section {
        PageHeader(
          Text(
            "Delete your account?", tableName: "Account",
            comment: "Final confirmation title before permanent account deletion"),
          supporting: Text(verbatim: deletedForGood))
      }

      if let storeSubscriptionProvider {
        Section {
          subscriptionManagementControl(for: storeSubscriptionProvider)
        } footer: {
          SectionFooter {
            subscriptionDeletionMessage(for: storeSubscriptionProvider)
          }
        }
      }

      deletionActionSection

      if session.failure != nil {
        Section {
          AccountFailureMessage(failure: session.failure)
        }
      }
    }
  }

  @ViewBuilder
  private var deletionActionSection: some View {
    if phase == .emailReauthentication {
      emailReauthenticationSection
    } else if hasAppleAccount {
      Section {
        HStack {
          Spacer()

          AppleAuthorizationButton(
            isDisabled: session.isWorking,
            requestsProfile: false,
            onCredentials: prepareAppleDeletion,
            onFailure: showEmailReauthentication)

          Spacer()
        }

        Button {
          showEmailReauthentication()
        } label: {
          Text(
            "Use email instead",
            tableName: "Account",
            comment: "Uses email OTP when Apple deletion reauthorization is unavailable")
        }
        .disabled(session.isWorking)
      } footer: {
        SectionFooter {
          logInAgainReason
        }
      }
    } else {
      Section {
        BusyButton(isBusy: isPerformingDeletion, role: .destructive, isRow: true) {
          pendingDeletion = .direct
          isConfirmingDeletion = true
        } label: {
          Text(
            "Delete account",
            tableName: "Account",
            comment: "Starts permanent account deletion")
        }
        .foregroundStyle(.destructiveText)
        .disabled(session.isWorking && !isPerformingDeletion)
      }
    }
  }

  private var emailReauthenticationSection: some View {
    Section {
      LabeledContent {
        Text(email)
          .foregroundStyle(.mutedForeground)
      } label: {
        Text(
          "Email",
          tableName: "Account",
          comment: "Fixed account email used to reauthorize deletion")
      }

      if hasSentCode {
        TextField(
          text: $code,
          prompt: Text(
            "6-digit code",
            tableName: "Account",
            comment: "Placeholder for the account deletion verification code")
        ) {
          Text(
            "Verification code",
            tableName: "Account",
            comment: "Account deletion verification code field label")
        }
        .keyboardType(.numberPad)
        .textContentType(.oneTimeCode)
        .accessibilityLabel(
          Text(
            "Verification code",
            tableName: "Account",
            comment: "Account deletion verification code field label")
        )
        .disabled(session.isWorking)

        BusyButton(isBusy: isPerformingDeletion, role: .destructive, isRow: true) {
          pendingDeletion = .email
          isConfirmingDeletion = true
        } label: {
          Text(
            "Verify and delete",
            tableName: "Account",
            comment: "Verifies the email code and permanently deletes the account")
        }
        .foregroundStyle(.destructiveText)
        .disabled((normalizedCode.count != 6 || session.isWorking) && !isPerformingDeletion)

        BusyButton(isBusy: session.isWorking && !isPerformingDeletion, isRow: true) {
          Task {
            await sendEmailCode()
          }
        } label: {
          Text(
            "Send a new code",
            tableName: "Account",
            comment: "Sends a replacement account deletion verification code")
        }
        .disabled(isPerformingDeletion)
      } else {
        BusyButton(isBusy: session.isWorking, isRow: true) {
          Task {
            await sendEmailCode()
          }
        } label: {
          Text(
            "Send verification code",
            tableName: "Account",
            comment: "Sends an email code for account deletion reauthorization")
        }
      }
    } footer: {
      SectionFooter {
        logInAgainReason
      }
    }
  }

  private var deletedContent: some View {
    ContentUnavailableView {
      Label {
        accountDeleted
      } icon: {
        Image(systemName: "checkmark.circle")
      }
    } actions: {
      Button(action: dismiss.callAsFunction) {
        Text("Done", tableName: "Account", comment: "Closes successful account deletion")
      }
      .buttonStyle(.mainAction)
    }
  }

  private var manualAppleRevocationContent: some View {
    ContentUnavailableView {
      Label {
        accountDeleted
      } icon: {
        Image(systemName: "checkmark.circle")
      }
    } description: {
      Text(
        "To finish, remove Zoonk from Sign in with Apple.",
        tableName: "Account",
        comment:
          "Explains that Zoonk deletion succeeded but Apple authorization needs manual removal")
    } actions: {
      VStack(spacing: 12) {
        Link(destination: AccountLinks.appleAccountAuthorizations) {
          Text(
            "Manage Sign in with Apple",
            tableName: "Account",
            comment: "Opens Apple account authorization management after deletion")
        }
        .buttonStyle(.mainAction)

        Button(action: dismiss.callAsFunction) {
          Text(
            "Done",
            tableName: "Account",
            comment: "Closes the Apple revocation outcome")
        }
      }
    }
  }

  private var deletedForGood: String {
    String(
      localized:
        "Your goals, plans, progress, memory and uploads are deleted for good. This can't be undone.",
      table: "Account")
  }

  private var logInAgainReason: Text {
    Text(
      "For your safety, log in again, then delete your account.", tableName: "Account")
  }

  private var accountDeleted: Text {
    Text(
      "Your account was deleted.", tableName: "Account")
  }

  private var storeSubscriptionProvider: StoreSubscriptionProvider? {
    subscription.flatMap { StoreSubscriptionProvider(rawValue: $0.provider) }
  }

  /// Main's `DeletionPlusNotice`. A read that failed says nothing and never stops the deletion.
  private var webPlusNotice: String? {
    settings.webPlus.value == nil
      ? nil
      : String(
        localized: "Deleting your account ends Plus right away.", table: "Account",
        comment:
          "Shown only to subscribers, in the box that deletes their account.")
  }

  private var normalizedCode: String {
    code.filter(\.isNumber)
  }

  private var normalizedEmail: String {
    email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
  }

  /// Never hides the result of the deletion running on this device.
  private func dismissStaleDeletion(accountId: String?) {
    guard accountId == nil, !session.isWorking, !isPerformingDeletion else {
      return
    }

    guard phase == .ready || phase == .emailReauthentication else {
      return
    }

    dismiss()
  }

  @ViewBuilder
  private func subscriptionManagementControl(for provider: StoreSubscriptionProvider) -> some View {
    switch provider {
    case .apple:
      Button {
        isAppStoreSubscriptionManagementPresented = true
      } label: {
        Label {
          Text(
            "Manage App Store subscription",
            tableName: "Account",
            comment: "Opens Apple's subscription management before account deletion")
        } icon: {
          Image(systemName: "gearshape")
        }
      }
    case .google:
      Label {
        Text(
          "Managed on Google Play",
          tableName: "Account",
          comment: "Identifies Google Play as the owner of subscription billing")
      } icon: {
        Image(systemName: "info.circle")
      }
    }
  }

  private func subscriptionDeletionMessage(for provider: StoreSubscriptionProvider) -> Text {
    switch provider {
    case .apple:
      Text(
        "Plus from the App Store keeps charging until you cancel it there.",
        tableName: "Account",
        comment:
          "Shown only to subscribers, in the box that deletes their account.")
    case .google:
      Text(
        "Plus from Google Play keeps charging until you cancel it there.",
        tableName: "Account",
        comment:
          "Shown only to subscribers, in the box that deletes their account.")
    }
  }

  private func prepareAppleDeletion(_ credentials: AppleSignInCredentials) {
    pendingDeletion = .apple(credentials)
    isConfirmingDeletion = true
  }

  private func showEmailReauthentication() {
    session.clearFailure()
    pendingDeletion = nil
    phase = .emailReauthentication
  }

  private func performConfirmedDeletion() async {
    guard let pendingDeletion else {
      return
    }

    isPerformingDeletion = true
    defer { isPerformingDeletion = false }

    let result: AccountDeletionResult

    switch pendingDeletion {
    case .apple(let credentials):
      result = await session.deleteAccount(reauthorizedWith: credentials)
    case .direct:
      result = await session.deleteAccount()
    case .email:
      result = await session.deleteAccount(
        reauthorizedEmail: normalizedEmail,
        code: normalizedCode)
    }

    apply(result)
    self.pendingDeletion = nil
  }

  private func sendEmailCode() async {
    guard
      session.account?.user.email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        == normalizedEmail
    else { return }

    let didSendCode = await session.sendAccountDeletionEmailCode()

    guard didSendCode else {
      return
    }

    code = ""
    hasSentCode = true
  }

  private func apply(_ result: AccountDeletionResult) {
    switch result {
    case .deleted:
      phase = .deleted
    case .deletedWithManualAppleRevocation:
      phase = .deletedWithManualAppleRevocation
    case .emailReauthenticationRequired:
      phase = .emailReauthentication
    case .failed:
      break
    case .signedOut:
      dismiss()
    }
  }
}
