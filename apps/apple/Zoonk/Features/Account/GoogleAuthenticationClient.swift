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

  func signOut() {
    GIDSignIn.sharedInstance.signOut()
  }

  func handle(_ url: URL) {
    _ = GIDSignIn.sharedInstance.handle(url)
  }

  /// The SDK raises an Objective-C exception without the public OAuth build settings.
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

  /// The SDK flow crashes when the reversed client ID isn't a registered URL scheme.
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
  fileprivate var topPresentedViewController: UIViewController {
    presentedViewController?.topPresentedViewController ?? self
  }
}
