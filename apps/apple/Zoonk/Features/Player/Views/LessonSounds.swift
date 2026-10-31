import AVFoundation

/// Synthesized as main does, so no audio files ship.
@MainActor
final class LessonSounds {
  enum Sound {
    case correct, finish

    var notes: [Double] {
      switch self {
      case .correct: [659.25, 880]
      case .finish: [523.25, 659.25, 783.99]
      }
    }
  }

  static let shared = LessonSounds()

  private let engine = AVAudioEngine()
  private let player = AVAudioPlayerNode()
  private let format = AVAudioFormat(standardFormatWithSampleRate: 44_100, channels: 1)
  private var buffers: [Sound: AVAudioPCMBuffer] = [:]

  private init() {
    engine.attach(player)

    if let format {
      engine.connect(player, to: engine.mainMixerNode, format: format)
    }
  }

  func play(_ sound: Sound) {
    guard let buffer = buffer(for: sound) else {
      return
    }

    do {
      try AVAudioSession.sharedInstance().setCategory(.ambient, options: .mixWithOthers)

      if !engine.isRunning {
        try engine.start()
      }

      player.scheduleBuffer(buffer, at: nil, options: .interrupts)
      player.play()
    } catch {
      return
    }
  }

  /// Each note swells quickly and fades over twice its length, so the chime sounds soft.
  private func buffer(for sound: Sound) -> AVAudioPCMBuffer? {
    if let buffer = buffers[sound] {
      return buffer
    }

    guard let format else {
      return nil
    }

    let rate = format.sampleRate
    let noteSeconds = 0.12
    let notes = sound.notes
    let total = AVAudioFrameCount(rate * (noteSeconds * Double(notes.count) + noteSeconds * 2))

    guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: total),
      let samples = buffer.floatChannelData?[0]
    else {
      return nil
    }

    buffer.frameLength = total

    for frame in 0..<Int(total) {
      samples[frame] = 0
    }

    for (index, frequency) in notes.enumerated() {
      let start = Int(rate * noteSeconds * Double(index))
      let length = Int(rate * noteSeconds * 2)

      for offset in 0..<length where start + offset < Int(total) {
        let time = Double(offset) / rate
        let attack = min(time / 0.03, 1)
        let decay = exp(-time / (noteSeconds * 0.6))
        samples[start + offset] += Float(sin(2 * .pi * frequency * time) * 0.12 * attack * decay)
      }
    }

    buffers[sound] = buffer
    return buffer
  }
}
