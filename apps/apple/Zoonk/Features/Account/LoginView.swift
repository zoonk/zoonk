import SwiftUI

struct LoginView: View {
  @Environment(SessionStore.self) private var session

  var body: some View {
    ScrollView {
      VStack(spacing: 24) {
        VStack(spacing: 8) {
          Image(systemName: "person.crop.circle.badge.checkmark")
            .font(.largeTitle)
            .imageScale(.large)
            .symbolRenderingMode(.hierarchical)
            .foregroundStyle(.tint)

          Text(
            "Sign in or create an account",
            tableName: "Account",
            comment:
              "Title above the native sign-in methods; new learners create an account here too"
          )
          .font(.title2.bold())
          .multilineTextAlignment(.center)

          Text(
            "Keep your plan and progress on all your devices.",
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
                  comment: "Link to the terms of service"
                )
                .underline()
              }
            )
            .frame(minHeight: 44)

            Link(
              destination: AccountLinks.privacy,
              label: {
                Text(
                  "Privacy Policy",
                  tableName: "Account",
                  comment: "Link to the privacy policy"
                )
                .underline()
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
      .foregroundStyle(.destructive)
      .multilineTextAlignment(.center)
      .accessibilityElement(children: .combine)
    }
  }

  @ViewBuilder
  private func message(for failure: AccountFailure) -> some View {
    switch failure {
    case .botDetected:
      Text(
        "A security check blocked this request. Try again or contact hello@zoonk.com.",
        tableName: "Account",
        comment:
          "Recovery when the security check blocks a sign-in or a verification code; avoids the verb on the Verify and delete button"
      )
    case .emailCodeDelivery:
      Text(
        "Zoonk couldn't send the verification code. Try again or contact hello@zoonk.com.",
        tableName: "Account",
        comment: "Generic email verification code delivery failure")
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
    case .disposableEmail:
      Text(
        "Temporary email addresses aren't supported. Use another email or a privacy alias.",
        tableName: "Account",
        comment: "Temporary inbox rejection; persistent privacy aliases remain supported")
    case .network:
      Text(
        "Zoonk couldn't connect. Check your connection and try again.",
        tableName: "Account",
        comment: "Error shown when an account request cannot reach the service")
    case .rateLimited:
      Text(
        "Too many attempts. Wait a moment, then try again.",
        tableName: "Account",
        comment: "Error shown when sign-in attempts are temporarily rate limited")
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
