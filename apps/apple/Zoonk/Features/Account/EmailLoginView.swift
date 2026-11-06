import SwiftUI

struct EmailLoginView: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(SessionStore.self) private var session
  @State private var code = ""
  @State private var email = ""
  @State private var hasSentCode = false

  var body: some View {
    Form {
      Section {
        TextField(
          text: $email,
          prompt: Text(
            "you@example.com",
            tableName: "Account",
            comment:
              "Example email address in the sign-in field: localize \"you\" and keep example.com")
        ) {
          Text("Email", tableName: "Account", comment: "Email sign-in field label")
        }
        .textInputAutocapitalization(.never)
        .keyboardType(.emailAddress)
        .autocorrectionDisabled()
        .textContentType(.emailAddress)
        .submitLabel(.continue)
        .onSubmit(sendEmailCode)
        .accessibilityLabel(
          Text("Email", tableName: "Account", comment: "Email sign-in field label")
        )
        .disabled(hasSentCode || session.isWorking)

        if hasSentCode {
          TextField(
            text: $code,
            prompt: Text(
              "6-digit code",
              tableName: "Account",
              comment: "Placeholder for the email sign-in code")
          ) {
            Text(
              "Verification code",
              tableName: "Account",
              comment: "Email sign-in code field label")
          }
          .keyboardType(.numberPad)
          .textContentType(.oneTimeCode)
          .onSubmit(signIn)
          .accessibilityLabel(
            Text(
              "Verification code",
              tableName: "Account",
              comment: "Email sign-in code field label")
          )
          .disabled(session.isWorking)
        }
      } footer: {
        if hasSentCode {
          Text(
            "We sent a sign-in code to your email. It expires in 5 minutes.",
            tableName: "Account",
            comment: "Explains where the email code was sent and when it expires")
        }
      }

      Section {
        if hasSentCode {
          BusyButton(isBusy: session.isWorking, action: signIn) {
            Text(
              "Sign in",
              tableName: "Account",
              comment: "Button that verifies an email code"
            )
            .frame(maxWidth: .infinity, alignment: .leading)
          }
          .disabled(!isCodeValid)

          Button {
            code = ""
            hasSentCode = false
            session.clearFailure()
          } label: {
            Text(
              "Use a different email",
              tableName: "Account",
              comment: "Button that returns to the email entry step")
          }
          .disabled(session.isWorking)
        } else {
          BusyButton(isBusy: session.isWorking, action: sendEmailCode) {
            Text(
              "Send code",
              tableName: "Account",
              comment: "Button that sends an email sign-in code"
            )
            .frame(maxWidth: .infinity, alignment: .leading)
          }
          .disabled(!isEmailValid)
        }
      }

      if session.failure != nil {
        Section {
          AccountFailureMessage(failure: session.failure)
        }
      }
    }
    .navigationTitle(
      Text("Email sign-in", tableName: "Account", comment: "Email login navigation title")
    )
    .toolbarTitleDisplayMode(.inline)
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
