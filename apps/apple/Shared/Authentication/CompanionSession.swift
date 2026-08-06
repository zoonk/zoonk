import Foundation

#if os(iOS) || os(watchOS)
  @preconcurrency import WatchConnectivity
#endif

nonisolated private let companionHasCredentialKey = "hasCredential"
nonisolated private let companionSessionTokenKey = "sessionToken"

@MainActor
protocol CompanionCredentialSyncing {
  func synchronize(token: String?)
}

@MainActor
struct NoopCompanionCredentialSync: CompanionCredentialSyncing {
  /// Keeps the shared session store platform-neutral on devices that cannot pair with Apple Watch.
  func synchronize(token: String?) {}
}

#if os(iOS)
  @MainActor
  final class PhoneCompanionCredentialSync: NSObject, CompanionCredentialSyncing,
    WCSessionDelegate
  {
    private var latestContext: [String: Any]?
    private let session: WCSession?

    /// Activates Apple's paired-device channel once so later login and logout changes can replace the latest Watch snapshot.
    override init() {
      session = WCSession.isSupported() ? .default : nil
      super.init()
      session?.delegate = self
      session?.activate()
    }

    /// Replaces the durable application context because Apple Watch only needs the latest Zoonk credential state, not a history of login events.
    func synchronize(token: String?) {
      let context: [String: Any] =
        token.map {
          [companionHasCredentialKey: true, companionSessionTokenKey: $0]
        } ?? [companionHasCredentialKey: false]

      latestContext = context
      publishLatestContext()
    }

    /// Publishes the latest snapshot only after activation so an app launch cannot lose a restored credential to WatchConnectivity's startup race.
    private func publishLatestContext() {
      guard let latestContext, session?.activationState == .activated else {
        return
      }

      try? session?.updateApplicationContext(latestContext)
    }

    /// Retries the latest account snapshot after WatchConnectivity finishes activating or replaces a paired-device session.
    nonisolated func session(
      _ session: WCSession,
      activationDidCompleteWith activationState: WCSessionActivationState,
      error: (any Error)?
    ) {
      let isActivated = activationState == .activated && error == nil

      Task { @MainActor [weak self] in
        if isActivated {
          self?.publishLatestContext()
        }
      }
    }

    /// Waits for Apple's matching deactivation callback before starting a replacement paired-device session.
    nonisolated func sessionDidBecomeInactive(_ session: WCSession) {}

    /// Reactivates the replacement Watch session after the user changes or unpairs their watch.
    nonisolated func sessionDidDeactivate(_ session: WCSession) {
      session.activate()
    }
  }
#endif

/// Selects the paired-device relay only on iPhone; all other Zoonk targets keep the same session-store API without pretending they can reach Apple Watch.
@MainActor
func makeCompanionCredentialSync() -> any CompanionCredentialSyncing {
  #if os(iOS)
    PhoneCompanionCredentialSync()
  #else
    NoopCompanionCredentialSync()
  #endif
}

#if os(watchOS)
  import Observation

  enum WatchCredentialState {
    case restoring
    case signedIn
    case signedOut
  }

  @MainActor
  @Observable
  final class WatchCredentialStore: NSObject, WCSessionDelegate {
    private(set) var state: WatchCredentialState
    private(set) var token: String?

    private let session: WCSession?

    /// Activates the paired iPhone channel and starts in a restoring state until WatchConnectivity supplies its latest application context.
    override init() {
      state = .restoring
      session = WCSession.isSupported() ? .default : nil
      super.init()
      session?.delegate = self
      session?.activate()

      if session == nil {
        state = .signedOut
      }
    }

    /// Creates inert state for SwiftUI previews without connecting the preview process to a paired iPhone.
    init(previewState: WatchCredentialState) {
      state = previewState
      token = previewState == .signedIn ? "preview-session" : nil
      session = nil
      super.init()
    }

    /// Applies one complete phone snapshot so a logout cannot leave a stale Watch credential behind.
    private func apply(hasCredential: Bool, token: String?) {
      guard hasCredential, let token, !token.isEmpty else {
        self.token = nil
        state = .signedOut
        return
      }

      self.token = token
      state = .signedIn
    }

    /// Uses the context already persisted by WatchConnectivity as soon as activation finishes, including when the iPhone app is not currently running.
    nonisolated func session(
      _ session: WCSession,
      activationDidCompleteWith activationState: WCSessionActivationState,
      error: (any Error)?
    ) {
      let context = session.receivedApplicationContext
      let hasSnapshot = context[companionHasCredentialKey] as? Bool
      let token = context[companionSessionTokenKey] as? String

      Task { @MainActor [weak self] in
        self?.apply(hasCredential: hasSnapshot == true, token: token)
      }
    }

    /// Replaces the visible account state whenever the paired iPhone publishes a newer login or logout snapshot.
    nonisolated func session(
      _ session: WCSession,
      didReceiveApplicationContext applicationContext: [String: Any]
    ) {
      let hasCredential = applicationContext[companionHasCredentialKey] as? Bool
      let token = applicationContext[companionSessionTokenKey] as? String

      Task { @MainActor [weak self] in
        self?.apply(hasCredential: hasCredential == true, token: token)
      }
    }
  }
#endif
