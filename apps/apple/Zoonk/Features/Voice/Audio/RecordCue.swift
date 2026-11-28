import SwiftUI

// VoiceOver speech during recording would be captured in the take.
struct RecordCue: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @ScaledMetric(relativeTo: .subheadline) private var height = 24.0

  enum Phase: Equatable {
    case before
    case gettingReady
    case live
    case checking
  }

  private enum Source {
    case recorder(VoiceRecorder?, isChecking: Bool)
    case fixed(Phase, levels: [Double])
  }

  private let source: Source

  init(recorder: VoiceRecorder?, isChecking: Bool = false) {
    source = .recorder(recorder, isChecking: isChecking)
  }

  init(phase: Phase, levels: [Double] = []) {
    source = .fixed(phase, levels: levels)
  }

  private var phase: Phase {
    switch source {
    case .fixed(let phase, _):
      phase
    case .recorder(let recorder, let isChecking):
      switch recorder?.status {
      case .acquiring: .gettingReady
      case .recording: .live
      case .idle, .failedToStart, nil: isChecking ? .checking : .before
      }
    }
  }

  private var levels: [Double] {
    switch source {
    case .fixed(_, let levels): levels
    case .recorder(let recorder, _): recorder?.recentLevels ?? []
    }
  }

  var body: some View {
    let phase = phase

    ZStack(alignment: .leading) {
      Text(
        "Say it after “Speak now”", tableName: "Voice",
        comment: "Before recording. “Speak now” must match the cue shown when the microphone is on."
      )
      .foregroundStyle(.mutedForeground)
      .opacity(phase == .before ? 1 : 0)

      track(
        label: Text(LocalizedStringResource("Getting ready…", table: "Today"))
          .foregroundStyle(.mutedForeground),
        levels: [], color: .border
      )
      .opacity(phase == .gettingReady ? 1 : 0)

      track(
        label: Text(
          "Speak now", tableName: "Voice",
          comment: "Shown the moment the microphone is on: an instruction to start talking now, not a button."
        )
        .fontWeight(.medium),
        levels: phase == .live && !reduceMotion ? levels : [],
        color: Color(.foreground)
      )
      .opacity(phase == .live ? 1 : 0)
    }
    .typeStyle(.body)
    .frame(minHeight: height)
    .accessibilityHidden(true)
    .sensoryFeedback(.impact(weight: .light), trigger: phase == .live) { _, isLive in isLive }
  }

  private func track(label: some View, levels: [Double], color: Color) -> some View {
    HStack(spacing: 12) {
      label
        .layoutPriority(1)

      LevelBars(levels: levels, color: color)
        .frame(height: height)
    }
  }
}

private struct LevelBars: View {
  let levels: [Double]
  let color: Color

  private let width = 4.0
  private let gap = 4.0

  var body: some View {
    Canvas { context, size in
      let count = Int((size.width + gap) / (width + gap))
      let shown = levels.suffix(count)
      let empty = count - shown.count

      for slot in 0..<count {
        let level = slot < empty ? 0 : shown[shown.startIndex + slot - empty]
        let barHeight = max(width, level * size.height)
        let rect = CGRect(
          x: Double(slot) * (width + gap), y: (size.height - barHeight) / 2, width: width,
          height: barHeight)
        context.fill(Path(roundedRect: rect, cornerRadius: width / 2), with: .color(color))
      }
    }
  }
}
