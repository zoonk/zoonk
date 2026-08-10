import Foundation

#if os(iOS) || os(watchOS)
  @preconcurrency import WatchConnectivity
#endif

nonisolated private let companionHasCredentialKey = "hasCredential"

@MainActor
protocol CompanionCredentialSyncing {
  func synchronize(isSignedIn: Bool)
}

@MainActor
struct NoopCompanionCredentialSync: CompanionCredentialSyncing {
  /// Keeps the shared session store platform-neutral on devices that cannot pair with Apple Watch.
  func synchronize(isSignedIn: Bool) {}
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

    /// Replaces the durable application context because Apple Watch only needs the latest Zoonk account state, not a history of login events.
    func synchronize(isSignedIn: Bool) {
      latestContext = [companionHasCredentialKey: isSignedIn]
      publishLatestContext()
    }

    /// Publishes the latest snapshot only after activation so an app launch cannot lose restored account state to WatchConnectivity's startup race.
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
    #if targetEnvironment(simulator)
      if !ProcessInfo.processInfo.arguments.contains("--enable-watch-connectivity") {
        return NoopCompanionCredentialSync()
      }
    #endif

    return PhoneCompanionCredentialSync()
  #else
    return NoopCompanionCredentialSync()
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

    private let session: WCSession?

    /// Activates the paired iPhone channel and starts in a restoring state until WatchConnectivity supplies its latest application context.
    override init() {
      #if targetEnvironment(simulator)
        #if DEBUG
          if ProcessInfo.processInfo.arguments.contains("--ui-testing-signed-in") {
            state = .signedIn
            session = nil
            super.init()
            return
          }
        #endif

        if !ProcessInfo.processInfo.arguments.contains("--enable-watch-connectivity") {
          state = .signedOut
          session = nil
          super.init()
          return
        }
      #endif

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
      session = nil
      super.init()
    }

    /// Applies the paired phone's latest account presence without copying its reusable bearer credential onto Apple Watch.
    private func apply(hasCredential: Bool) {
      state = hasCredential ? .signedIn : .signedOut
    }

    /// Uses the context already persisted by WatchConnectivity as soon as activation finishes, including when the iPhone app is not currently running.
    nonisolated func session(
      _ session: WCSession,
      activationDidCompleteWith activationState: WCSessionActivationState,
      error: (any Error)?
    ) {
      let context = session.receivedApplicationContext
      let hasSnapshot = context[companionHasCredentialKey] as? Bool

      Task { @MainActor [weak self] in
        self?.apply(hasCredential: hasSnapshot == true)
      }
    }

    /// Replaces the visible account state whenever the paired iPhone publishes a newer login or logout snapshot.
    nonisolated func session(
      _ session: WCSession,
      didReceiveApplicationContext applicationContext: [String: Any]
    ) {
      let hasCredential = applicationContext[companionHasCredentialKey] as? Bool

      Task { @MainActor [weak self] in
        self?.apply(hasCredential: hasCredential == true)
      }
    }
  }
#endif
