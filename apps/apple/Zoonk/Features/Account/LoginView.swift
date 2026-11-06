import SwiftUI

struct LoginView: View {
  @Environment(SessionStore.self) private var session

  var body: some View {
    ScrollView {
      VStack(spacing: 24) {
        VStack(spacing: 8) {
          Image(systemName: "person.crop.circle.badge.checkmark")
            .typeStyle(.heroTitle.weight(.regular))
            .imageScale(.large)
            .symbolRenderingMode(.hierarchical)
            .foregroundStyle(.tint)
            .accessibilityHidden(true)

          Text(title)
            .typeStyle(.section)
            .multilineTextAlignment(.center)
            .accessibilityAddTraits(.isHeader)
            .heroTitle()

          Text(
            "Keep your plan and progress on all your devices.",
            tableName: "Account",
            comment: "Explains the benefit of signing in"
          )
          .foregroundStyle(.mutedForeground)
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
            .typeStyle(.body.weight(.medium))
            .padding(.horizontal, 16)
            .authenticationButtonFrame()
            .foregroundStyle(.tint)
            .background(.background)
            .overlay {
              RoundedRectangle(cornerRadius: authenticationButtonCornerRadius)
                .strokeBorder(.mutedForeground, lineWidth: 1)
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

        Text(
          "By continuing, you agree to the Zoonk \(termsLink) and \(privacyLink).",
          tableName: "Account",
          comment:
            "Legal agreement below the sign-in methods; the arguments are the links to the terms of service and the privacy policy"
        )
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
        .multilineTextAlignment(.center)
      }
      .frame(maxWidth: 480)
      .padding(24)
      .frame(maxWidth: .infinity)
    }
    .navigationTitle(title)
    .barTitleAfterHero(title)
  }

  private var title: String {
    String(
      localized: "Sign in or create an account", table: "Account",
      comment: "Title above the native sign-in methods; new learners create an account here too")
  }

  private var termsLink: AttributedString {
    linked(
      AttributedString(
        localized: "Terms of Service", table: "Account", comment: "Link to the terms of service"),
      to: AccountLinks.terms)
  }

  private var privacyLink: AttributedString {
    linked(
      AttributedString(
        localized: "Privacy Policy", table: "Account", comment: "Link to the privacy policy"),
      to: AccountLinks.privacy)
  }

  /// The tint is ink, so a link inside a sentence is told apart by its underline.
  private func linked(_ title: AttributedString, to url: URL) -> AttributedString {
    var link = title
    link.link = url
    link.underlineStyle = .single
    return link
  }
}

struct AccountFailureMessage: View {
  let failure: AccountFailure?

  @ViewBuilder
  var body: some View {
    if let failure {
      FailureLine(message: message(for: failure), systemImage: "exclamationmark.circle")
        .typeStyle(.note)
        .multilineTextAlignment(.center)
        .accessibilityElement(children: .combine)
    }
  }

  private func message(for failure: AccountFailure) -> LocalizedStringResource {
    switch failure {
    case .botDetected:
      LocalizedStringResource(
        "A security check blocked this request. Try again or contact hello@zoonk.com.",
        table: "Account",
        comment:
          "Recovery when the security check blocks a sign-in or a verification code; avoids the verb on the Verify and delete button"
      )
    case .emailCodeDelivery:
      LocalizedStringResource(
        "Zoonk couldn't send the verification code. Try again or contact hello@zoonk.com.",
        table: "Account",
        comment: "Generic email verification code delivery failure")
    case .accountDeletion:
      LocalizedStringResource(
        "Zoonk couldn't delete your account. Try again or contact hello@zoonk.com.",
        table: "Account",
        comment: "Generic account deletion failure message")
    case .accountMismatch:
      LocalizedStringResource(
        "That code belongs to a different account. Request a new code for this account.",
        table: "Account",
        comment: "Error shown when an account deletion code belongs to a different account")
    case .invalidCode:
      LocalizedStringResource(
        "That code is invalid or expired. Request a new code and try again.",
        table: "Account",
        comment: "Error shown when an email verification code is invalid or expired")
    case .invalidEmail:
      LocalizedStringResource(
        "Enter a valid email address.",
        table: "Account",
        comment: "Error shown when an email address is invalid")
    case .disposableEmail:
      LocalizedStringResource(
        "Temporary email addresses aren't supported. Use another email or a privacy alias.",
        table: "Account",
        comment: "Temporary inbox rejection; persistent privacy aliases remain supported")
    case .network:
      LocalizedStringResource(
        "Zoonk couldn't connect. Check your connection and try again.",
        table: "Account",
        comment: "Error shown when an account request cannot reach the service")
    case .rateLimited:
      LocalizedStringResource(
        "Too many tries. Wait a minute, then try again.",
        table: "Account",
        comment: "Error shown when sign-in attempts are temporarily rate limited")
    case .usernameTaken:
      LocalizedStringResource(
        "That username is already taken.",
        table: "Account",
        comment: "Error shown when a chosen username is unavailable")
    case .validation:
      LocalizedStringResource(
        "Check the information and try again.",
        table: "Account",
        comment: "Error shown when profile information is invalid")
    case .signIn:
      LocalizedStringResource(
        "Zoonk couldn't sign you in. Try again or contact hello@zoonk.com.",
        table: "Account",
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
