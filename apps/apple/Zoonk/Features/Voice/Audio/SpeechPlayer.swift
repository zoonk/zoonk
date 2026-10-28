import AVFoundation
import CryptoKit
import Observation

/// What to play: a recording, or text read aloud in its language when it has none (a clip asked
/// for on the learner's tap). `personal` text is the learner's own words, read in a clip of theirs.
enum SpokenSound: Hashable, Sendable {
  case recording(URL)
  case text(String, language: String, personal: Bool = false)

  /// A word with a native recording plays it; without one, it's read aloud.
  static func word(_ text: String, recording: URL?, language: String) -> SpokenSound {
    recording.map(SpokenSound.recording) ?? .text(text, language: language)
  }
}

/// Every sound the app plays for learning, one at a time: starting one stops the last, and the
/// screen that started it sees whether it's loading, playing or failed. Text without a recording
/// is voiced by `POST /v1/speech-clips` on the learner's tap only, once per session however often
/// it plays; the files are kept on disk so a word heard yesterday plays at once and offline.
@MainActor
@Observable
final class SpeechPlayer {
  enum State: Equatable {
    case idle
    case loading
    case playing
    /// The sound didn't come; with a limit when the plan's help for the day is used up.
    case failed(HelpLimit?)
  }

  /// Slow enough to hear each sound, close enough to real speech to still sound like the word.
  static let slowRate: Float = 0.7

  /// What the sound `owner` started is doing; other screens' sounds read as idle.
  func state(for owner: AnyHashable) -> State {
    current?.owner == owner ? current?.state ?? .idle : .idle
  }

  @ObservationIgnored private let api: VoiceAPI
  @ObservationIgnored private let session: SessionStore
  @ObservationIgnored private let files: VoiceFileCache
  @ObservationIgnored private var clips: [ClipKey: Task<URL, any Error>] = [:]
  @ObservationIgnored private var clipsSession: AuthenticatedSession?
  @ObservationIgnored private var player: AVAudioPlayer?
  @ObservationIgnored private var delegate: PlayerDelegate?
  @ObservationIgnored private var run = 0
  private var current: (owner: AnyHashable, state: State)?

  init(api: VoiceAPI, session: SessionStore, files: VoiceFileCache) {
    self.api = api
    self.session = session
    self.files = files
  }

  /// Plays `sound` for `owner` and returns when it ends, stops or fails. A recording that won't
  /// play is read aloud instead when `fallback` text is given.
  func play(
    _ sound: SpokenSound,
    rate: Float = 1,
    owner: AnyHashable,
    fallback: (text: String, language: String)? = nil
  ) async {
    stopCurrent()
    run += 1
    let mine = run
    current = (owner, .loading)

    do {
      let file = try await file(for: sound)

      guard run == mine else {
        return
      }

      try await playFile(file, rate: rate, run: mine)

      if run == mine {
        current = nil
      }
    } catch is CancellationError {
      if run == mine {
        current = nil
      }
    } catch {
      guard run == mine else {
        return
      }

      if case .recording = sound, let fallback {
        await play(
          .text(fallback.text, language: fallback.language), rate: rate, owner: owner)
        return
      }

      current = (owner, .failed((error as? VoiceRefusal)?.limit))
    }
  }

  /// Stops `owner`'s sound; another screen's keeps playing.
  func stop(owner: AnyHashable) {
    guard current?.owner == owner else {
      return
    }

    stopCurrent()
    current = nil
  }

  private func stopCurrent() {
    run += 1
    player?.stop()
    player = nil
    delegate?.finish()
    delegate = nil
  }

  private func file(for sound: SpokenSound) async throws -> URL {
    switch sound {
    case .recording(let url):
      return try await files.file(for: url, token: nil)
    case .text(let text, let language, let personal):
      let clip = try await clipURL(ClipKey(text: text, language: language, personal: personal))
      // A personal clip is the learner's private file: only the API's own origin gets the session.
      let token = personal ? session.authenticatedSession?.bearerToken : nil
      return try await files.file(for: clip, token: token)
    }
  }

  /// The clip for the text, asked for once per session. A failure isn't kept, so trying again
  /// asks again. Another session never reuses this one's clips.
  private func clipURL(_ key: ClipKey) async throws -> URL {
    guard let owner = session.authenticatedSession else {
      throw APIError.unauthorized
    }

    if clipsSession != owner {
      for task in clips.values {
        task.cancel()
      }

      clips = [:]
      clipsSession = owner
    }

    if let task = clips[key] {
      return try await task.value
    }

    let api = api
    let task = Task {
      try await api.speechClip(
        text: key.text, language: key.language, personal: key.personal, token: owner.bearerToken)
    }

    clips[key] = task

    do {
      return try await task.value
    } catch {
      if clipsSession == owner {
        clips[key] = nil
      }

      throw error
    }
  }

  private func playFile(_ file: URL, rate: Float, run mine: Int) async throws {
    try AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
    try AVAudioSession.sharedInstance().setActive(true)
    let player = try AVAudioPlayer(contentsOf: file)
    player.enableRate = true
    player.rate = rate

    try await withCheckedThrowingContinuation {
      (continuation: CheckedContinuation<Void, any Error>) in
      let delegate = PlayerDelegate(continuation: continuation)
      player.delegate = delegate
      self.player = player
      self.delegate = delegate

      guard player.play() else {
        delegate.finish(throwing: APIError.unavailable)
        return
      }

      current = (current?.owner ?? AnyHashable(0), .playing)
    }

    if run == mine {
      self.player = nil
      self.delegate = nil
    }
  }
}

private struct ClipKey: Hashable {
  let text: String
  let language: String
  let personal: Bool
}

/// `AVAudioPlayer` reports its end to an `NSObject` delegate; the continuation resumes once.
@MainActor
private final class PlayerDelegate: NSObject, AVAudioPlayerDelegate {
  private var continuation: CheckedContinuation<Void, any Error>?

  init(continuation: CheckedContinuation<Void, any Error>) {
    self.continuation = continuation
  }

  /// Stopped by a newer sound or the screen: the playback ends quietly.
  func finish() {
    finish(throwing: CancellationError())
  }

  func finish(throwing error: (any Error)? = nil) {
    guard let continuation else {
      return
    }

    self.continuation = nil

    if let error {
      continuation.resume(throwing: error)
    } else {
      continuation.resume()
    }
  }

  nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
    Task { @MainActor in self.finish(throwing: flag ? nil : APIError.unavailable) }
  }

  nonisolated func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: (any Error)?) {
    Task { @MainActor in self.finish(throwing: APIError.unavailable) }
  }
}

/// Sound files kept in the app's caches folder by their URL, so a clip downloads once. The system
/// may clear the folder when space runs low; a missing file downloads again.
struct VoiceFileCache: Sendable {
  private let apiURL: URL
  private let directory: URL
  private let session: URLSession

  init(apiURL: URL) {
    self.apiURL = apiURL
    directory = URL.cachesDirectory.appending(path: "VoiceClips", directoryHint: .isDirectory)
    let configuration = URLSessionConfiguration.ephemeral
    configuration.httpCookieAcceptPolicy = .never
    configuration.httpShouldSetCookies = false
    configuration.timeoutIntervalForRequest = 30
    session = URLSession(configuration: configuration)
  }

  func file(for url: URL, token: String?) async throws -> URL {
    if url.isFileURL {
      return url
    }

    let name = SHA256.hash(data: Data(url.absoluteString.utf8))
      .map { String(format: "%02x", $0) }.joined()
    let file = directory.appending(
      path: name + "." + (url.pathExtension.isEmpty ? "mp3" : url.pathExtension))

    if FileManager.default.fileExists(atPath: file.path()) {
      return file
    }

    var request = URLRequest(url: url)

    // The session only ever goes to the API's own origin, never to a public file host.
    if let token, url.scheme == apiURL.scheme, url.host() == apiURL.host(), url.port == apiURL.port
    {
      request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    }

    let (downloaded, response) = try await session.download(for: request)

    guard (response as? HTTPURLResponse)?.statusCode == 200 else {
      try? FileManager.default.removeItem(at: downloaded)
      throw APIError.unavailable
    }

    try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
    try? FileManager.default.removeItem(at: file)
    try FileManager.default.moveItem(at: downloaded, to: file)
    return file
  }
}
