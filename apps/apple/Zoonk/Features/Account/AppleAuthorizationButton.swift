import AuthenticationServices
import SwiftUI

#if os(tvOS)
  let authenticationButtonSize = CGSize(width: 312, height: 73)
#elseif os(visionOS)
  let authenticationButtonSize = CGSize(width: 257, height: 60)
#else
  let authenticationButtonSize = CGSize(width: 214, height: 50)
#endif

struct AppleAuthorizationButton: View {
  @Environment(\.colorScheme) private var colorScheme
  @State private var nonce: String?

  let isDisabled: Bool
  let requestsProfile: Bool
  let onCredentials: (AppleSignInCredentials) -> Void
  let onFailure: () -> Void

  var body: some View {
    SignInWithAppleButton(
      .continue,
      onRequest: prepareRequest,
      onCompletion: handleCompletion
    )
    .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .whiteOutline)
    .frame(
      width: authenticationButtonSize.width,
      height: authenticationButtonSize.height
    )
    .disabled(isDisabled)
  }

  /// Adds a nonce to every native authorization and requests personal details only during initial sign-in because Apple supplies them at most once.
  private func prepareRequest(_ request: ASAuthorizationAppleIDRequest) {
    do {
      let nonce = try AuthenticationNonce.make()
      self.nonce = nonce
      request.nonce = AuthenticationNonce.hash(nonce)
      request.requestedScopes = requestsProfile ? [.email, .fullName] : []
    } catch {
      nonce = nil
      onFailure()
    }
  }

  /// Converts the system credential into the provider assertion shared by sign-in and account-deletion reauthorization without exposing AuthenticationServices to either screen.
  private func handleCompletion(_ result: Result<ASAuthorization, any Error>) {
    switch result {
    case .success(let authorization):
      guard
        let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
        let authorizationCodeData = credential.authorizationCode,
        let authorizationCode = String(data: authorizationCodeData, encoding: .utf8),
        let tokenData = credential.identityToken,
        let identityToken = String(data: tokenData, encoding: .utf8),
        let nonce
      else {
        onFailure()
        return
      }

      onCredentials(
        AppleSignInCredentials(
          authorizationCode: authorizationCode,
          email: credential.email,
          firstName: credential.fullName?.givenName,
          identityToken: identityToken,
          lastName: credential.fullName?.familyName,
          nonce: nonce))

    case .failure(let error):
      if let authorizationError = error as? ASAuthorizationError,
        authorizationError.code == .canceled
      {
        return
      }

      onFailure()
    }
  }
}
