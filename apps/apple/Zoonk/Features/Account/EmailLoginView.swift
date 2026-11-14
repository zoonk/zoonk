import SwiftUI

struct EmailLoginView: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(SessionStore.self) private var session
  @State private var code = ""
  @State private var email = ""
  @State private var hasSentCode = false
  @FocusState private var focusedField: Field?

  private enum Field {
    case email
    case code
  }

  var body: some View {
    ZoonkList {
      Section {
        if hasSentCode {
          FormField(
            title: Text("Code from the email", tableName: "Account"),
            isFocused: focusedField == .code
          ) {
            TextField(
              text: $code,
              prompt: Text(
                "6-digit code",
                tableName: "Account",
                comment: "Placeholder for the email sign-in code")
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
            isFocused: focusedField == .email
          ) {
            TextField(
              text: $email,
              prompt: Text(
                "you@example.com",
                tableName: "Account",
                comment:
                  "Example email address in the sign-in field: localize \"you\" and keep example.com"
              )
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

      // Sign-in's one exception to the bottom bar: Continue stays under its field.
      Section {
        VStack(spacing: 12) {
          if hasSentCode {
            BusyButton(isBusy: session.isWorking, action: signIn) {
              Text("Continue", tableName: "Account", comment: "Button that verifies an email code")
            }
            .buttonStyle(.mainAction)
            .disabled(!isCodeValid && !session.isWorking)
            .keyboardShortcut(.defaultAction)

            Button {
              code = ""
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
            .disabled(!isEmailValid && !session.isWorking)
            .keyboardShortcut(.defaultAction)
          }
        }
        .controlSize(.large)
        .buttonSizing(.flexible)
        .listRowSeparator(.hidden)
      }

      if session.failure != nil {
        Section {
          AccountFailureMessage(failure: session.failure)
        }
      }
    }
    .navigationTitle(
      Text("Log in", tableName: "Account", comment: "Email login navigation title")
    )
    .toolbarTitleDisplayMode(.inline)
    .onChange(of: hasSentCode) { _, sent in
      focusedField = sent ? .code : .email
    }
    .onChange(of: session.state) { _, state in
      dismissAfterSignIn(state)
    }
  }

  private var normalizedEmail: String {
    email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
  }

  private var normalizedCode: String {
    code.filter(\.isNumber)
  }

  private var isEmailValid: Bool {
    let parts = normalizedEmail.split(separator: "@", omittingEmptySubsequences: false)
    return parts.count == 2 && !parts[0].isEmpty && parts[1].contains(".")
  }

  private var isCodeValid: Bool {
    normalizedCode.count == 6
  }

  private func sendEmailCode() {
    guard isEmailValid, !session.isWorking else {
      return
    }

    Task {
      hasSentCode = await session.sendEmailCode(email: normalizedEmail)
    }
  }

  private func signIn() {
    guard isCodeValid, !session.isWorking else {
      return
    }

    Task {
      await session.signInWithEmailCode(
        email: normalizedEmail,
        code: normalizedCode)
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
