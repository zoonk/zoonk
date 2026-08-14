import SwiftUI

struct LoginView: View {
  @Environment(SessionStore.self) private var session

  var body: some View {
    ScrollView {
      VStack(spacing: 24) {
        VStack(spacing: 8) {
          Image(systemName: "person.crop.circle.badge.checkmark")
            .font(.system(size: 48))
            .symbolRenderingMode(.hierarchical)
            .foregroundStyle(.tint)

          Text(
            "Sign in to Zoonk",
            tableName: "Account",
            comment: "Title above the native sign-in methods"
          )
          .font(.title2.bold())

          Text(
            "Keep your courses and progress available on all your devices.",
            tableName: "Account",
            comment: "Explains the benefit of signing in"
          )
          .foregroundStyle(.secondary)
          .multilineTextAlignment(.center)
        }

        VStack(spacing: 12) {
          AppleAuthorizationButton(
            isDisabled: session.isWorking,
            requestsProfile: true,
            onCredentials: { credentials in
              Task {
                await session.signInWithApple(credentials)
              }
            },
            onFailure: session.reportSignInFailure)

          if session.isGoogleSignInAvailable {
            GoogleAuthorizationButton(isDisabled: session.isWorking) { anchor in
              Task {
                await session.signInWithGoogle(from: anchor)
              }
            }
          }

          NavigationLink {
            EmailLoginView()
          } label: {
            HStack(spacing: 12) {
              Image(systemName: "envelope")
                .accessibilityHidden(true)

              Text(
                "Continue with email",
                tableName: "Account",
                comment: "Email sign-in button label"
              )
              .fixedSize(horizontal: false, vertical: true)
              .multilineTextAlignment(.center)
            }
            .font(.body.weight(.medium))
            .padding(.horizontal, 16)
            .authenticationButtonFrame()
            .foregroundStyle(.tint)
            .background(.background)
            .overlay {
              RoundedRectangle(cornerRadius: authenticationButtonCornerRadius)
                .strokeBorder(.secondary, lineWidth: 1)
            }
            .clipShape(RoundedRectangle(cornerRadius: authenticationButtonCornerRadius))
            .contentShape(RoundedRectangle(cornerRadius: authenticationButtonCornerRadius))
          }
          .buttonStyle(AuthenticationButtonStyle())
        }
        .frame(maxWidth: authenticationButtonMaximumWidth)
        .disabled(session.isWorking)

        if session.isWorking {
          ProgressView()
            .controlSize(.small)
        }

        AccountFailureMessage(failure: session.failure)

        VStack(spacing: 8) {
          Text(
            "By continuing, you agree to the Zoonk Terms of Service and Privacy Policy.",
            tableName: "Account",
            comment: "Legal agreement shown below sign-in methods"
          )
          .font(.footnote)
          .foregroundStyle(.secondary)
          .multilineTextAlignment(.center)

          HStack(spacing: 16) {
            Link(
              destination: AccountLinks.terms,
              label: {
                Text(
                  "Terms of Service",
                  tableName: "Account",
                  comment: "Link to the terms of service")
              }
            )
            .frame(minHeight: 44)

            Link(
              destination: AccountLinks.privacy,
              label: {
                Text(
                  "Privacy Policy",
                  tableName: "Account",
                  comment: "Link to the privacy policy")
              }
            )
            .frame(minHeight: 44)
          }
          .font(.footnote)
        }
      }
      .frame(maxWidth: 480)
      .padding(24)
      .frame(maxWidth: .infinity)
    }
  }
}

struct AccountFailureMessage: View {
  let failure: AccountFailure?

  @ViewBuilder
  var body: some View {
    if let failure {
      Label {
        message(for: failure)
      } icon: {
        Image(systemName: "exclamationmark.circle")
      }
      .font(.footnote)
      .foregroundStyle(.red)
      .multilineTextAlignment(.center)
      .accessibilityElement(children: .combine)
    }
  }

  /// Gives each recoverable state concise native copy while keeping raw provider and server errors out of the interface.
  @ViewBuilder
  private func message(for failure: AccountFailure) -> some View {
    switch failure {
    case .accountDeletion:
      Text(
        "Zoonk couldn't delete your account. Try again or contact hello@zoonk.com.",
        tableName: "Account",
        comment: "Generic account deletion failure message")
    case .accountMismatch:
      Text(
        "That code belongs to a different account. Request a new code for this account.",
        tableName: "Account",
        comment: "Error shown when an account deletion code belongs to a different account")
    case .invalidCode:
      Text(
        "That code is invalid or expired. Request a new code and try again.",
        tableName: "Account",
        comment: "Error shown when an email verification code is invalid or expired")
    case .invalidEmail:
      Text(
        "Enter a valid email address.",
        tableName: "Account",
        comment: "Error shown when an email address is invalid")
    case .network:
      Text(
        "Zoonk couldn't connect. Check your connection and try again.",
        tableName: "Account",
        comment: "Error shown when an account request cannot reach the service")
    case .usernameTaken:
      Text(
        "That username is already taken.",
        tableName: "Account",
        comment: "Error shown when a chosen username is unavailable")
    case .validation:
      Text(
        "Check the information and try again.",
        tableName: "Account",
        comment: "Error shown when profile information is invalid")
    case .signIn:
      Text(
        "Zoonk couldn't sign you in. Try again or contact hello@zoonk.com.",
        tableName: "Account",
        comment: "Generic sign-in failure message")
    }
  }
}

#Preview {
  NavigationStack {
    LoginView()
  }
  .environment(SessionStore.preview())
}
