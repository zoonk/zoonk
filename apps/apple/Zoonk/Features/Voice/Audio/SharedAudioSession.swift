import AVFoundation

/// Every window shares one audio session, and deactivating it stops all of its audio. It stays
/// active while any player or recorder still uses it, and the last one to let go deactivates it.
@MainActor
enum SharedAudioSession {
  private static var users: Set<ObjectIdentifier> = []

  static func activate(for user: AnyObject) throws {
    try AVAudioSession.sharedInstance().setActive(true)
    users.insert(ObjectIdentifier(user))
  }

  /// Sets the session up and activates it off the main actor, where it can block while the audio
  /// route changes. The user holds the session from the start, so another user letting go
  /// meanwhile doesn't deactivate it.
  static func activate(
    for user: AnyObject,
    configure: @escaping @Sendable (AVAudioSession) throws -> Void
  ) async throws {
    users.insert(ObjectIdentifier(user))

    do {
      try await Task.detached(priority: .userInitiated) {
        let session = AVAudioSession.sharedInstance()
        try configure(session)
        try session.setActive(true)
      }.value
    } catch {
      release(for: user)
      throw error
    }
  }

  /// Other apps' audio comes back once nobody uses it.
  static func release(for user: AnyObject) {
    guard users.remove(ObjectIdentifier(user)) != nil, users.isEmpty else {
      return
    }

    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }
}
