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

  /// Other apps' audio comes back once nobody uses it.
  static func release(for user: AnyObject) {
    guard users.remove(ObjectIdentifier(user)) != nil, users.isEmpty else {
      return
    }

    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
  }
}
