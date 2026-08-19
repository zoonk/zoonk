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
  @State private var code = ""
  @State private var hasSentCode = false
  @State private var isAppStoreSubscriptionManagementPresented = false
  @State private var isConfirmingDeletion = false
  @State private var isPerformingDeletion = false
  @State private var pendingDeletion: PendingAccountDeletion?
  @State private var phase = AccountDeletionPhase.ready

  let email: String
  let hasAppleAccount: Bool
  let storeSubscriptionProvider: StoreSubscriptionProvider?

  var body: some View {
    content
      .navigationTitle(
        Text(
          "Delete account",
          tableName: "Account",
          comment: "Account deletion navigation title")
      )
      .toolbarTitleDisplayMode(.inline)
      .confirmationDialog(
        Text(
          "Delete your Zoonk account?",
          tableName: "Account",
          comment: "Final confirmation title before permanent account deletion"),
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
          "This permanently deletes your profile, progress, and personalized courses. This can't be undone.",
          tableName: "Account",
          comment: "Explains the consequences of confirming permanent account deletion")
      }
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
    Form {
      Section {
        Label {
          Text(
            "Profile and account information",
            tableName: "Account",
            comment: "Account data removed during deletion")
        } icon: {
          Image(systemName: "person")
        }

        Label {
          Text(
            "Course progress",
            tableName: "Account",
            comment: "Learning data removed during account deletion")
        } icon: {
          Image(systemName: "chart.line.uptrend.xyaxis")
        }

        Label {
          Text(
            "Personalized courses",
            tableName: "Account",
            comment: "Personalized learning data removed during account deletion")
        } icon: {
          Image(systemName: "square.grid.2x2")
        }
      } header: {
        Text(
          "Permanently deleted",
          tableName: "Account",
          comment: "Heading above the data removed during account deletion")
      } footer: {
        Text(
          "Account deletion can't be undone.",
          tableName: "Account",
          comment: "Warns that account deletion is irreversible")
      }

      if let storeSubscriptionProvider {
        Section {
          subscriptionManagementControl(for: storeSubscriptionProvider)
        } header: {
          Text(
            "Subscription",
            tableName: "Account",
            comment: "Heading for mobile-store billing guidance during account deletion")
        } footer: {
          subscriptionDeletionMessage(for: storeSubscriptionProvider)
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
        Text(
          "Continue with Apple to confirm that this account is yours before deleting it.",
          tableName: "Account",
          comment: "Explains why Apple reauthorization is required for deletion")
      }
    } else {
      Section {
        Button(role: .destructive) {
          pendingDeletion = .direct
          isConfirmingDeletion = true
        } label: {
          Text(
            "Delete account",
            tableName: "Account",
            comment: "Starts permanent account deletion")
        }
        .disabled(session.isWorking)
      }
    }
  }

  private var emailReauthenticationSection: some View {
    Section {
      LabeledContent {
        Text(email)
          .foregroundStyle(.secondary)
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

        Button(role: .destructive) {
          pendingDeletion = .email
          isConfirmingDeletion = true
        } label: {
          workingLabel(
            title: Text(
              "Verify and delete",
              tableName: "Account",
              comment: "Verifies the email code and permanently deletes the account"))
        }
        .disabled(normalizedCode.count != 6 || session.isWorking)

        Button {
          Task {
            await sendEmailCode()
          }
        } label: {
          workingLabel(
            title: Text(
              "Send a new code",
              tableName: "Account",
              comment: "Sends a replacement account deletion verification code"))
        }
        .disabled(session.isWorking)
      } else {
        Button {
          Task {
            await sendEmailCode()
          }
        } label: {
          workingLabel(
            title: Text(
              "Send verification code",
              tableName: "Account",
              comment: "Sends an email code for account deletion reauthorization"))
        }
        .disabled(session.isWorking)
      }
    } header: {
      Text(
        "Sign in again",
        tableName: "Account",
        comment: "Heading for email reauthentication before account deletion")
    } footer: {
      Text(
        "For your security, enter a new code sent to the email on this account.",
        tableName: "Account",
        comment: "Explains the email reauthentication requirement for account deletion")
    }
  }

  private var deletedContent: some View {
    ContentUnavailableView {
      Label {
        Text(
          "Account deleted",
          tableName: "Account",
          comment: "Title shown after successful account deletion")
      } icon: {
        Image(systemName: "checkmark.circle")
      }
    } description: {
      Text(
        "Your Zoonk account and personalized data were permanently deleted.",
        tableName: "Account",
        comment: "Confirms that account data was permanently deleted")
    } actions: {
      Button(action: dismiss.callAsFunction) {
        Text("Done", tableName: "Account", comment: "Closes successful account deletion")
      }
      .buttonStyle(.borderedProminent)
    }
  }

  /// Keeps the completed deletion explicit while offering Apple's official account controls when the server could not confirm authorization revocation.
  private var manualAppleRevocationContent: some View {
    ContentUnavailableView {
      Label {
        Text(
          "Account deleted",
          tableName: "Account",
          comment: "Title shown after deletion when Apple authorization needs manual removal")
      } icon: {
        Image(systemName: "checkmark.circle")
      }
    } description: {
      Text(
        "Your Zoonk data was deleted, but Apple couldn't confirm that its authorization was removed. Remove Zoonk from Sign in with Apple to finish.",
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
        .buttonStyle(.borderedProminent)

        Button(action: dismiss.callAsFunction) {
          Text(
            "Done",
            tableName: "Account",
            comment: "Closes the Apple revocation outcome")
        }
      }
    }
  }

  private var normalizedCode: String {
    code.filter(\.isNumber)
  }

  private var normalizedEmail: String {
    email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
  }

  /// Closes a deletion flow whose account was removed through synchronized credentials, without hiding the result of the deletion currently running on this device.
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

  /// Explains that deleting product data cannot cancel billing owned by either mobile store.
  private func subscriptionDeletionMessage(for provider: StoreSubscriptionProvider) -> Text {
    switch provider {
    case .apple:
      Text(
        "Deleting your Zoonk account doesn't cancel App Store billing. Cancel the subscription first if you don't want it to renew.",
        tableName: "Account",
        comment:
          "Warns that App Store billing continues independently of Zoonk account deletion")
    case .google:
      Text(
        "Deleting your Zoonk account doesn't cancel Google Play billing. Use Google Play on an Android device to cancel it first if you don't want it to renew.",
        tableName: "Account",
        comment:
          "Warns that Google Play billing continues independently of Zoonk account deletion")
    }
  }

  /// Keeps progress feedback inside the active deletion row so the form does not jump while a sensitive request is running.
  private func workingLabel(title: Text) -> some View {
    HStack {
      title

      Spacer()

      if session.isWorking {
        ProgressView()
          .controlSize(.small)
      }
    }
  }

  /// Retains the single-use Apple assertion only until the user confirms permanent deletion in the native destructive dialog.
  private func prepareAppleDeletion(_ credentials: AppleSignInCredentials) {
    pendingDeletion = .apple(credentials)
    isConfirmingDeletion = true
  }

  /// Falls back to the account's fixed email whenever native Apple authorization is unavailable, while cancellation remains a no-op inside the system-button adapter.
  private func showEmailReauthentication() {
    session.clearFailure()
    pendingDeletion = nil
    phase = .emailReauthentication
  }

  /// Selects the correct freshness proof, preserves local authentication on failure, and moves to a recovery or completion state from the typed result.
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

  /// Requests the initial or replacement proof without discarding a still-usable code when the mail request itself fails.
  private func sendEmailCode() async {
    let didSendCode = await session.sendEmailCode(email: normalizedEmail)

    guard didSendCode else {
      return
    }

    code = ""
    hasSentCode = true
  }

  /// Reduces service outcomes to the UI states that change what the user can do next.
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
