import AVFoundation
import Observation

/// A spoken answer as the API takes it: AAC in an M4A file, and how long the learner spoke.
struct VoiceRecording: Sendable {
  let audio: Data
  let durationMs: Int
}

/// Records one short answer from the microphone: a word, a sentence, the level test's line. The
/// system asks for the microphone the first time; a learner who said no gets `denied`, and screens
/// explain how to turn it on. Each recording lives in a temporary file that's read and deleted as
/// soon as it stops, so nothing is kept. An interruption (a phone call, Siri) throws the recording
/// away: half a sentence isn't worth grading.
@MainActor
@Observable
final class VoiceRecorder {
  enum Status: Equatable {
    case idle
    case acquiring
    case recording(startedAt: Date)
    case denied
  }

  /// A spoken answer is one sentence; a longer recording is a microphone left on.
  static let maxDuration: TimeInterval = 30

  private(set) var status = Status.idle
  /// The input's loudness from 0 to 1, for a level meter while recording.
  private(set) var level: Double = 0

  @ObservationIgnored private var recorder: AVAudioRecorder?
  @ObservationIgnored private var delegate: RecorderDelegate?
  @ObservationIgnored private var meter: Task<Void, Never>?
  @ObservationIgnored private var interruption: (any NSObjectProtocol)?
  @ObservationIgnored private var onRecorded: (@MainActor (VoiceRecording) -> Void)?

  var isRecording: Bool {
    if case .recording = status {
      return true
    }

    return false
  }

  /// Whether the learner turned the microphone off for the app. Before they're asked it's false:
  /// tapping Record asks.
  var isDenied: Bool {
    status == .denied || AVAudioApplication.shared.recordPermission == .denied
  }

  /// Starts recording, asking for the microphone first if the learner wasn't asked yet. The
  /// recording comes to `onRecorded` when the learner stops or it reaches `maxDuration`. False when
  /// the microphone is off or couldn't start.
  @discardableResult
  func start(onRecorded: @escaping @MainActor (VoiceRecording) -> Void) async -> Bool {
    guard status == .idle || status == .denied else {
      return false
    }

    status = .acquiring

    guard await AVAudioApplication.requestRecordPermission() else {
      status = .denied
      return false
    }

    guard status == .acquiring, let recorder = makeRecorder() else {
      if status == .acquiring {
        status = .idle
      }

      return false
    }

    let delegate = RecorderDelegate { [weak self] in self?.finish() }
    recorder.delegate = delegate
    recorder.isMeteringEnabled = true

    guard recorder.record(forDuration: Self.maxDuration) else {
      discard(recorder)
      status = .idle
      return false
    }

    self.recorder = recorder
    self.delegate = delegate
    self.onRecorded = onRecorded
    status = .recording(startedAt: .now)
    observeInterruptions()
    startMeter()
    return true
  }

  /// Stops and delivers the recording.
  func stop() {
    recorder?.stop()
  }

  /// Stops without delivering anything, as leaving the screen does.
  func cancel() {
    onRecorded = nil
    recorder?.stop()
  }

  private func makeRecorder() -> AVAudioRecorder? {
    let session = AVAudioSession.sharedInstance()

    do {
      try session.setCategory(
        .playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetoothHFP])
      try session.setActive(true)
    } catch {
      return nil
    }

    let url = FileManager.default.temporaryDirectory
      .appending(path: "voice-\(UUID().uuidString).m4a")

    let settings: [String: Any] = [
      AVFormatIDKey: kAudioFormatMPEG4AAC,
      AVSampleRateKey: 22_050,
      AVNumberOfChannelsKey: 1,
      AVEncoderBitRateKey: 32_000,
    ]

    return try? AVAudioRecorder(url: url, settings: settings)
  }

  /// The recorder stopped: by Stop, its time limit, or an interruption.
  private func finish() {
    guard let recorder else {
      return
    }

    let durationMs: Int

    if case .recording(let startedAt) = status {
      durationMs = Int(min(Date.now.timeIntervalSince(startedAt), Self.maxDuration) * 1000)
    } else {
      durationMs = 0
    }

    let audio = try? Data(contentsOf: recorder.url)
    let deliver = onRecorded
    discard(recorder)
    self.recorder = nil
    delegate = nil
    onRecorded = nil
    meter?.cancel()
    meter = nil
    level = 0
    status = .idle
    stopObservingInterruptions()
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)

    if let audio, !audio.isEmpty, let deliver {
      deliver(VoiceRecording(audio: audio, durationMs: durationMs))
    }
  }

  private func discard(_ recorder: AVAudioRecorder) {
    recorder.deleteRecording()
  }

  /// Samples the input ten times a second. Screens draw it only while recording.
  private func startMeter() {
    meter = Task { [weak self] in
      while !Task.isCancelled {
        guard let self, let recorder = self.recorder else {
          return
        }

        recorder.updateMeters()
        // -50 dB is silence for speech; 0 dB is the loudest.
        let power = Double(recorder.averagePower(forChannel: 0))
        self.level = min(1, max(0, (power + 50) / 50))
        try? await Task.sleep(for: .milliseconds(100))
      }
    }
  }

  private func observeInterruptions() {
    interruption = NotificationCenter.default.addObserver(
      forName: AVAudioSession.interruptionNotification,
      object: AVAudioSession.sharedInstance(),
      queue: .main
    ) { [weak self] notification in
      let type = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt

      guard type == AVAudioSession.InterruptionType.began.rawValue else {
        return
      }

      MainActor.assumeIsolated {
        self?.cancel()
      }
    }
  }

  private func stopObservingInterruptions() {
    if let interruption {
      NotificationCenter.default.removeObserver(interruption)
    }

    interruption = nil
  }
}

/// `AVAudioRecorder` reports its end to an `NSObject` delegate.
private final class RecorderDelegate: NSObject, AVAudioRecorderDelegate, @unchecked Sendable {
  private let onFinish: @MainActor () -> Void

  init(onFinish: @escaping @MainActor () -> Void) {
    self.onFinish = onFinish
  }

  func audioRecorderDidFinishRecording(_ recorder: AVAudioRecorder, successfully flag: Bool) {
    Task { @MainActor in onFinish() }
  }

  func audioRecorderEncodeErrorDidOccur(_ recorder: AVAudioRecorder, error: (any Error)?) {
    Task { @MainActor in onFinish() }
  }
}
