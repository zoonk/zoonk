import Foundation
import GoogleSignIn
import UIKit

enum GoogleAuthenticationError: Error {
  case canceled
  case invalidToken
  case unavailable
}

@MainActor
protocol GoogleAuthenticating {
  var isAvailable: Bool { get }

  func handle(_ url: URL)
  func signIn(from anchor: GoogleAuthenticationAnchor) async throws -> String
  func signOut()
}

struct GoogleAuthenticationAnchor {
  fileprivate let viewController: UIViewController

  init(viewController: UIViewController) {
    self.viewController = viewController
  }
}

@MainActor
struct GoogleAuthenticationClient: GoogleAuthenticating {
  var isAvailable: Bool {
    hasRequiredConfiguration
  }

  /// Presents Google's supported native authorization flow and returns the signed ID token that Better Auth verifies on the server.
  func signIn(from anchor: GoogleAuthenticationAnchor) async throws -> String {
    guard isAvailable else {
      throw GoogleAuthenticationError.unavailable
    }

    do {
      let result = try await providerSignInResult(from: anchor)

      guard let identityToken = result.user.idToken?.tokenString else {
        throw GoogleAuthenticationError.invalidToken
      }

      return identityToken
    } catch {
      let providerError = error as NSError
      if providerError.domain == kGIDSignInErrorDomain,
        providerError.code == GIDSignInError.Code.canceled.rawValue
      {
        throw GoogleAuthenticationError.canceled
      }

      throw error
    }
  }

  /// Removes Google's local credential after Zoonk signs out so the SDK cannot silently reuse a provider session that the app no longer represents.
  func signOut() {
    GIDSignIn.sharedInstance.signOut()
  }

  /// Forwards the custom-scheme OAuth callback to the SDK instead of parsing provider credentials in product code.
  func handle(_ url: URL) {
    _ = GIDSignIn.sharedInstance.handle(url)
  }

  /// Prevents the provider SDK from raising an Objective-C exception when a developer has not supplied the public OAuth build settings yet.
  private var hasRequiredConfiguration: Bool {
    guard
      let clientID = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String,
      !clientID.isEmpty,
      let serverClientID = Bundle.main.object(forInfoDictionaryKey: "GIDServerClientID")
        as? String,
      !serverClientID.isEmpty
    else {
      return false
    }

    return hasCallbackScheme(for: clientID)
  }

  /// Confirms the reversed client identifier was embedded as a URL scheme so Google can return from the browser without crashing the SDK flow.
  private func hasCallbackScheme(for clientID: String) -> Bool {
    guard
      let urlTypes = Bundle.main.object(forInfoDictionaryKey: "CFBundleURLTypes")
        as? [[String: Any]]
    else {
      return false
    }

    let callbackScheme = clientID.split(separator: ".").reversed().joined(separator: ".")
    let registeredSchemes = urlTypes.flatMap {
      $0["CFBundleURLSchemes"] as? [String] ?? []
    }
    return registeredSchemes.contains(callbackScheme)
  }

  /// Starts the iOS flow from the controller currently presenting the account sheet.
  private func providerSignInResult(from anchor: GoogleAuthenticationAnchor) async throws
    -> GIDSignInResult
  {
    guard
      let rootViewController = anchor.viewController.viewIfLoaded?.window?.rootViewController
    else {
      throw GoogleAuthenticationError.unavailable
    }

    return try await GIDSignIn.sharedInstance.signIn(
      withPresenting: rootViewController.topPresentedViewController)
  }
}

extension UIViewController {
  /// Follows the active presentation chain so Google's system sheet is anchored to the account sheet the user interacted with.
  fileprivate var topPresentedViewController: UIViewController {
    presentedViewController?.topPresentedViewController ?? self
  }
}
