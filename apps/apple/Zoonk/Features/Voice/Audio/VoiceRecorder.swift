import AVFoundation
import Observation

struct VoiceRecording: Sendable {
  let audio: Data
  let durationMs: Int
}

/// Each recording lives in a temporary file that's read and deleted as soon as it stops, so nothing
/// is kept. An interruption (a phone call, Siri) throws the recording away: half a sentence isn't
/// worth grading.
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
  /// From 0 to 1.
  private(set) var level: Double = 0

  @ObservationIgnored private var recorder: AVAudioRecorder?
  @ObservationIgnored private var delegate: RecorderDelegate?
  @ObservationIgnored private var meter: Task<Void, Never>?
  @ObservationIgnored private var interruption: (any NSObjectProtocol)?
  @ObservationIgnored private var onRecorded: (@MainActor (VoiceRecording) -> Void)?
  @ObservationIgnored private var acquisition = 0

  var isRecording: Bool {
    if case .recording = status {
      return true
    }

    return false
  }

  /// False before the learner is asked: tapping Record asks.
  var isDenied: Bool {
    status == .denied || AVAudioApplication.shared.recordPermission == .denied
  }

  /// False when the microphone is off or couldn't start.
  @discardableResult
  func start(onRecorded: @escaping @MainActor (VoiceRecording) -> Void) async -> Bool {
    guard status == .idle || status == .denied else {
      return false
    }

    status = .acquiring
    acquisition += 1
    let mine = acquisition
    let isAllowed = await AVAudioApplication.requestRecordPermission()

    guard acquisition == mine else {
      return false
    }

    guard isAllowed else {
      status = .denied
      return false
    }

    guard let recorder = makeRecorder() else {
      status = .idle
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

  func stop() {
    recorder?.stop()
  }

  func cancel() {
    acquisition += 1
    onRecorded = nil

    if status == .acquiring {
      status = .idle
    }

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
