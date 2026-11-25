import SwiftUI

struct EmailLoginView: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(SessionStore.self) private var session
  @State private var code = EmailVerificationCode()
  @State private var email = LoginEmail()
  @State private var hasSentCode = false
  @FocusState private var focusedField: Field?

  private enum Field {
    case email
    case code
  }

  var body: some View {
    ZoonkList {
      Section {
        Group {
          if hasSentCode {
            FormField(
              title: Text("Code from the email", tableName: "Account"),
              isFocused: focusedField == .code
            ) {
              TextField(
                text: $code.text,
                prompt: Text(
                  "6-digit code",
                  tableName: "Account",
                  comment: "Placeholder for the email sign-in code"
                ).fieldPrompt()
              ) {
                Text("Code from the email", tableName: "Account")
              }
              .keyboardType(.numberPad)
              .textContentType(.oneTimeCode)
              .focused($focusedField, equals: .code)
              .onSubmit(signIn)
              .disabled(session.isWorking)
            } hint: {
              Text(
                "Enter the code we sent to \(normalizedEmail).", tableName: "Account",
                comment: "Under the code field; the argument is the learner's email address")
            }
          } else {
            FormField(
              title: Text("Email", tableName: "Account", comment: "Email sign-in field label"),
              isFocused: focusedField == .email, isInvalid: email.failure != nil
            ) {
              TextField(
                text: $email.text,
                prompt: Text(
                  "you@example.com",
                  tableName: "Account",
                  comment:
                    "An example email address in an empty email field. Localize \"you\" and keep example.com."
                ).fieldPrompt()
              ) {
                Text("Email", tableName: "Account", comment: "Email sign-in field label")
              }
              .textInputAutocapitalization(.never)
              .keyboardType(.emailAddress)
              .autocorrectionDisabled()
              .textContentType(.emailAddress)
              .submitLabel(.continue)
              .focused($focusedField, equals: .email)
              .onSubmit(sendEmailCode)
              .disabled(session.isWorking)
            }
          }
        }
        .listRowSeparator(.hidden)

        // Sign-in's one exception to the bottom bar: Continue stays under its field, in its
        // section.
        VStack(spacing: 12) {
          if hasSentCode {
            BusyButton(isBusy: session.isWorking, action: signIn) {
              Text("Continue", tableName: "Account", comment: "Button that verifies an email code")
            }
            .buttonStyle(.mainAction)
            .disabled(!code.canSubmit && !session.isWorking)
            .keyboardShortcut(.defaultAction)

            Button {
              code = EmailVerificationCode()
              hasSentCode = false
              session.clearFailure()
            } label: {
              Text(
                "Change email", tableName: "Account",
                comment: "Button that returns to the email entry step")
            }
            .buttonStyle(.ghost)
            .disabled(session.isWorking)
          } else {
            BusyButton(isBusy: session.isWorking, action: sendEmailCode) {
              Text(
                "Continue", tableName: "Account", comment: "Button that sends an email log in code")
            }
            .buttonStyle(.mainAction)
            .disabled(normalizedEmail.isEmpty && !session.isWorking)
            .keyboardShortcut(.defaultAction)
          }
        }
        .controlSize(.large)
        .buttonSizing(.flexible)
        .listRowSeparator(.hidden)
      }

      if let failure = hasSentCode
        ? code.displayedFailure(session.failure) : email.failure ?? session.failure
      {
        Section {
          AccountFailureMessage(failure: failure)
        }
      }
    }
    .readableColumn(480)
    .navigationTitle(
      Text("Log in", tableName: "Account", comment: "Email login navigation title")
    )
    .toolbarTitleDisplayMode(.inline)
    .onChange(of: hasSentCode) { _, sent in
      focusedField = sent ? .code : .email
    }
    .onChange(of: focusedField) { previous, _ in
      if previous == .email {
        email.leave()
      }
    }
    .onChange(of: session.state) { _, state in
      dismissAfterSignIn(state)
    }
    // The number pad has no Return key, so a complete code signs in on its own.
    .onChange(of: code.normalized, signIn)
  }

  private var normalizedEmail: String {
    email.normalized
  }

  private func sendEmailCode() {
    guard !session.isWorking, !normalizedEmail.isEmpty, email.submit() else {
      return
    }

    Task {
      hasSentCode = await session.sendEmailCode(email: normalizedEmail)
    }
  }

  private func signIn() {
    Task {
      guard hasSentCode, code.canSubmit, !session.isWorking else {
        return
      }

      let submittedCode = code.normalized
      await session.signInWithEmailCode(email: normalizedEmail, code: submittedCode)
      code.recordFailure(session.failure, for: submittedCode)
    }
  }

  private func dismissAfterSignIn(_ state: AccountSessionState) {
    guard case .signedIn = state else {
      return
    }

    dismiss()
  }
}

#Preview {
  NavigationStack {
    EmailLoginView()
  }
  .environment(SessionStore.preview())
}

/// The address the learner logs in with. A wrong one says so under its field once they leave it or
/// press Continue, as main's login says it on Continue, and from then on as they fix it.
struct LoginEmail {
  var text = ""
  private var isChecked = false

  var normalized: String {
    text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
  }

  var isValid: Bool {
    let parts = normalized.split(separator: "@", omittingEmptySubsequences: false)
    return parts.count == 2 && !parts[0].isEmpty && parts[1].contains(".")
  }

  var failure: AccountFailure? {
    isChecked && !isValid ? .invalidEmail : nil
  }

  /// Leaving an empty field says nothing.
  mutating func leave() {
    isChecked = isChecked || !normalized.isEmpty
  }

  /// Whether the address can be sent.
  mutating func submit() -> Bool {
    isChecked = true
    return isValid
  }
}
