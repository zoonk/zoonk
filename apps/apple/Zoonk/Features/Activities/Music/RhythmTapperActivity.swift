import QuartzCore
import SwiftUI

extension ActivityRenderer {
  static let rhythmTapper = ActivityRenderer(
    template: "rhythmTapper", badge: .always(.tapAlong), grade: Rhythm.grade
  ) { context in
    if let fields = try? context.fields(as: RhythmTapperFields.self) {
      RhythmTapperCanvas(fields: fields, context: context)
    }
  }
}

/// The device's sound delay for rhythms, kept on the device as main keeps it in the browser:
/// measured once (a number), skipped by the learner (`skipped`), or not asked yet (nothing).
private enum RhythmDeviceDelay {
  static let key = "rhythmDeviceDelay"
  static let skipped = "skipped"
}

/// The answer is the taps with the device's measured delay, which core grades after taking it out.
private struct RhythmTapperCanvas: View {
  @AppStorage(RhythmDeviceDelay.key) private var storedDelay: String?
  @State private var audio = MusicAudio()
  @State private var isCalibrating = false

  let fields: RhythmTapperFields
  let context: ActivityCanvasContext

  private var isChecked: Bool {
    if case .checked = context.phase { true } else { false }
  }

  var body: some View {
    MusicCanvas {
      if !isChecked, storedDelay == nil || isCalibrating {
        RhythmCalibrationView(audio: audio) { delayMs in
          storedDelay = String(Int(delayMs))
          isCalibrating = false
        } onSkip: {
          storedDelay = RhythmDeviceDelay.skipped
          isCalibrating = false
        }
      } else {
        RhythmRunView(
          fields: fields, context: context, audio: audio,
          deviceDelayMs: storedDelay.flatMap(Double.init)
        ) {
          context.setAnswer(nil)
          isCalibrating = true
        }
      }

      MusicSoundNote(audio: audio)
    }
    .onDisappear { audio.close() }
  }
}

private struct RhythmRunView: View {
  @State private var run = RhythmRun()

  let fields: RhythmTapperFields
  let context: ActivityCanvasContext
  let audio: MusicAudio
  let deviceDelayMs: Double?
  let onCalibrate: () -> Void

  private var isChecked: Bool {
    if case .checked = context.phase { true } else { false }
  }

  var body: some View {
    TimelineView(.animation(paused: !run.isRunning)) { _ in
      let now = CACurrentMediaTime()
      let phase = run.phase(at: now)
      let answeredTaps = context.answer?.tapTimesMs
      let taps = phase == .idle || phase == .done ? answeredTaps : nil
      let results = taps.map {
        Rhythm.results(
          beatMs: fields.beatMs, deviceDelayMs: deviceDelayMs, expectedMs: fields.tapTimesMs,
          tapsMs: $0, toleranceMs: Double(fields.toleranceMs))
      }

      VStack(alignment: .leading, spacing: 16) {
        RhythmStatus(
          tempo: fields.tempo, rounds: fields.rounds,
          round: phase == .tapping
            ? run.position(at: now, patternLength: fields.pattern.count).map { $0.round + 1 } : nil)

        RhythmGrid(
          fields: fields, position: run.position(at: now, patternLength: fields.pattern.count),
          results: results?.hits)

        if !isChecked {
          RhythmTapPad(
            isActive: phase == .countIn || phase == .tapping, isCountingIn: phase == .countIn
          ) { time in
            run.tap(at: time, fields: fields)
          }
        }

        if !isChecked, !run.isRunning {
          RhythmControls(hasTried: taps != nil, onCalibrate: onCalibrate) {
            run.start(.listen, fields: fields, audio: audio) { _ in }
          } onStart: {
            context.setAnswer(nil)
            run.start(.tap, fields: fields, audio: audio) { taps in
              context.setAnswer(
                taps.isEmpty ? nil : .rhythm(tapTimesMs: taps, deviceDelayMs: deviceDelayMs))
            }
          }
        }

        if let results {
          RhythmFeedback(hits: results.hits, extraTaps: results.extraTaps)
        }
      }
    }
    .onAppear {
      audio.onInterruption = { run.reset() }
    }
    .onDisappear { run.reset() }
  }
}

private struct RhythmStatus: View {
  let tempo: Int
  let rounds: Int
  let round: Int?

  var body: some View {
    HStack(spacing: 4) {
      Text(
        "\(tempo) bpm", tableName: "ActivitiesMusic",
        comment: "A rhythm's tempo in beats per minute")
      Text(verbatim: "·")

      if let round {
        Text(
          "Round \(round) of \(rounds)", tableName: "ActivitiesMusic",
          comment: "Which round of the rhythm is playing")
      } else {
        Text(
          "\(rounds) rounds", tableName: "ActivitiesMusic",
          comment: "How many times the rhythm repeats")
      }
    }
    .font(.subheadline.monospacedDigit())
    .foregroundStyle(.secondary)
    .accessibilityElement(children: .combine)
  }
}

private struct RhythmGrid: View {
  @ScaledMetric(relativeTo: .body) private var cellHeight = 32

  let fields: RhythmTapperFields
  let position: RhythmPosition?
  let results: [Rhythm.HitResult]?

  var body: some View {
    let steps = Array(fields.pattern)
    let hitSteps = fields.hitSteps

    VStack(alignment: .leading, spacing: 8) {
      ForEach(0..<fields.rounds, id: \.self) { round in
        HStack(alignment: .bottom, spacing: 2) {
          ForEach(steps.indices, id: \.self) { step in
            if step > 0, step.isMultiple(of: fields.stepsPerBeat) {
              Color.clear.frame(width: 4, height: 1)
            }

            let isHit = steps[step] == "x"
            let index = round * hitSteps.count + (hitSteps.firstIndex(of: step) ?? 0)
            let result = isHit ? results.flatMap { index < $0.count ? $0[index] : nil } : nil

            VStack(spacing: 4) {
              dot(result?.status)

              RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(isHit ? Color.orange : Color(.systemBackground))
                .frame(height: cellHeight)
                .overlay {
                  if position == RhythmPosition(round: round, step: step) {
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                      .strokeBorder(.primary, lineWidth: 2)
                  }
                }
            }
          }
        }
      }

      HStack(spacing: 2) {
        ForEach(0..<fields.beats, id: \.self) { beat in
          if beat > 0 {
            Color.clear.frame(width: 4, height: 1)
          }

          Text(beat + 1, format: .number)
            .font(.caption.monospacedDigit())
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
      }

      ViewThatFits(in: .horizontal) {
        HStack(spacing: 16) { legend }
        VStack(alignment: .leading, spacing: 4) { legend }
      }
      .font(.caption)
      .foregroundStyle(.secondary)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(
      Text(
        "A rhythm of \(fields.pattern.count) steps with a beat every \(fields.stepsPerBeat). Tap on steps \(hitSteps.map { String($0 + 1) }.joined(separator: ", ")), over a click on every beat.",
        tableName: "ActivitiesMusic", comment: "VoiceOver description of a rhythm's grid"))
  }

  @ViewBuilder
  private func dot(_ status: Rhythm.TapStatus?) -> some View {
    switch status {
    case .onTime:
      Circle().fill(.success).frame(width: 8, height: 8)
    case .early, .late:
      Circle().fill(.warning).frame(width: 8, height: 8)
    case .missed:
      Circle().strokeBorder(.destructive, lineWidth: 2).frame(width: 8, height: 8)
    case nil:
      Color.clear.frame(width: 8, height: 8)
    }
  }

  @ViewBuilder
  private var legend: some View {
    Label {
      Text(
        "Rhythm hits", tableName: "ActivitiesMusic",
        comment: "Legend: the colored cells are the taps")
    } icon: {
      RoundedRectangle(cornerRadius: 3).fill(.orange).frame(width: 10, height: 10)
    }

    Label {
      Text(
        "On time", tableName: "ActivitiesMusic", comment: "Legend: a tap that landed on its beat")
    } icon: {
      Circle().fill(.success).frame(width: 10, height: 10)
    }

    Label {
      Text(
        "Early or late", tableName: "ActivitiesMusic", comment: "Legend: a tap that missed its beat"
      )
    } icon: {
      Circle().fill(.warning).frame(width: 10, height: 10)
    }
  }
}

private struct RhythmControls: View {
  let hasTried: Bool
  let onCalibrate: () -> Void
  let onListen: () -> Void
  let onStart: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      ViewThatFits(in: .horizontal) {
        HStack { buttons }
        VStack(alignment: .leading) { buttons }
      }

      Button(action: onCalibrate) {
        Label {
          Text(
            "Check the sound delay again", tableName: "ActivitiesMusic",
            comment: "Runs the sound check again, for new headphones")
        } icon: {
          Image(systemName: "timer")
        }
      }
      .buttonStyle(.borderless)
      .font(.subheadline)
    }
  }

  @ViewBuilder
  private var buttons: some View {
    Button(action: onListen) {
      Label {
        Text("Listen first", tableName: "ActivitiesMusic", comment: "Plays one round of the rhythm")
      } icon: {
        Image(systemName: "headphones")
      }
    }
    .buttonStyle(.bordered)
    .controlSize(.large)

    Button(action: onStart) {
      if hasTried {
        Label {
          Text(
            "Try again", tableName: "ActivitiesMusic",
            comment: "Runs the rhythm or the sound check again")
        } icon: {
          Image(systemName: "arrow.counterclockwise")
        }
      } else {
        Text(
          "Start tapping", tableName: "ActivitiesMusic",
          comment: "Counts in a bar, then times the taps")
      }
    }
    .buttonStyle(.mainAction)
    .controlSize(.large)
  }
}

private struct RhythmFeedback: View {
  let hits: [Rhythm.HitResult]
  let extraTaps: Int

  var body: some View {
    let onTime = hits.filter { $0.status == .onTime }.count
    let worst = Rhythm.worstHit(hits)

    VStack(alignment: .leading, spacing: 2) {
      Text(
        "\(onTime) of \(hits.count) taps on time.", tableName: "ActivitiesMusic",
        comment: "How many of the rhythm's taps were on time")

      if let worst {
        detail(worst.hit, tap: worst.index + 1)
      }

      if extraTaps > 0 {
        Text(
          "\(extraTaps) extra taps.", tableName: "ActivitiesMusic",
          comment: "Rhythm result: the learner's taps on the screen that matched no beat")
      }
    }
    .font(.subheadline)
    .accessibilityElement(children: .combine)
  }

  @ViewBuilder
  private func detail(_ hit: Rhythm.HitResult, tap: Int) -> some View {
    let ms = Int(abs(hit.offsetMs ?? 0))

    switch hit.status {
    case .early:
      Text(
        "Tap \(tap) came \(ms) ms early.", tableName: "ActivitiesMusic",
        comment: "The tap furthest off the beat came early")
    case .late:
      Text(
        "Tap \(tap) came \(ms) ms late.", tableName: "ActivitiesMusic",
        comment: "The tap furthest off the beat came late")
    case .missed:
      Text(
        "Tap \(tap) was missed.", tableName: "ActivitiesMusic",
        comment: "A beat of the rhythm got no tap")
    case .onTime:
      EmptyView()
    }
  }
}

/// The delay the device adds (Bluetooth headphones add up to half a second) is taken out of every
/// rhythm after.
private struct RhythmCalibrationView: View {
  @State private var calibration = RhythmCalibration()

  let audio: MusicAudio
  let onDone: (Double) -> Void
  let onSkip: () -> Void

  /// A reading this close to zero is a device with no delay worth mentioning.
  private static let onTimeMs = 20.0

  var body: some View {
    TimelineView(.animation(paused: !calibration.isRunning)) { _ in
      let phase = calibration.phase(at: CACurrentMediaTime())

      VStack(alignment: .leading, spacing: 16) {
        VStack(alignment: .leading, spacing: 4) {
          Text(
            "Set up your sound", tableName: "ActivitiesMusic",
            comment: "Title of the rhythm sound check"
          )
          .font(.headline)
          .accessibilityAddTraits(.isHeader)

          status(phase)
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }

        RhythmTapPad(isActive: calibration.isRunning, isCountingIn: phase == .countIn) { time in
          calibration.tap(at: time)
        }

        if !calibration.isRunning {
          buttons(phase)
        }
      }
    }
    .onAppear {
      audio.onInterruption = { calibration.cancel() }
    }
    .onDisappear { calibration.cancel() }
  }

  @ViewBuilder
  private func buttons(_ phase: RhythmCalibration.Phase) -> some View {
    ViewThatFits(in: .horizontal) {
      HStack { buttonRow(phase) }
      VStack(alignment: .leading) { buttonRow(phase) }
    }
  }

  @ViewBuilder
  private func buttonRow(_ phase: RhythmCalibration.Phase) -> some View {
    if case .done(let delay?) = phase {
      Button {
        onDone(delay)
      } label: {
        Text(
          "Continue", tableName: "ActivitiesMusic",
          comment: "Keeps the measured sound delay and opens the rhythm")
      }
      .buttonStyle(.mainAction)
      .controlSize(.large)
    } else {
      Button {
        calibration.start(audio: audio)
      } label: {
        if case .done = phase {
          Text(
            "Try again", tableName: "ActivitiesMusic",
            comment: "Runs the rhythm or the sound check again")
        } else {
          Text(
            "Start the sound check", tableName: "ActivitiesMusic",
            comment: "Starts the clicks to tap along with")
        }
      }
      .buttonStyle(.mainAction)
      .controlSize(.large)

      Button(action: onSkip) {
        Text(
          "Skip for now", tableName: "ActivitiesMusic",
          comment: "Opens the rhythm without measuring the sound delay")
      }
      .buttonStyle(.borderless)
      .controlSize(.large)
    }
  }

  private func status(_ phase: RhythmCalibration.Phase) -> Text {
    switch phase {
    case .countIn:
      Text(
        "Listen to the clicks…", tableName: "ActivitiesMusic", comment: "The sound check counts in")
    case .tapping(let click):
      Text(
        "Tap with each click · \(min(click, Rhythm.calibrationClicks)) of \(Rhythm.calibrationClicks)",
        tableName: "ActivitiesMusic", comment: "The sound check: which click of how many")
    case .done(nil):
      Text(
        "We couldn't match enough taps to the clicks. Try again, tapping with each one.",
        tableName: "ActivitiesMusic", comment: "The sound check got too few taps")
    case .done(let delay?) where delay < Self.onTimeMs:
      Text(
        "Sound on this device arrives on time.", tableName: "ActivitiesMusic",
        comment: "The sound check found no delay")
    case .done(let delay?):
      Text(
        "Sound on this device arrives about \(Int(delay)) ms late. Rhythms here take that out.",
        tableName: "ActivitiesMusic", comment: "The sound check's reading, in milliseconds")
    case .idle:
      Text(
        "Headphones can play sound a little late. Tap along with \(Rhythm.calibrationClicks) clicks once, and rhythms on this device are timed fairly.",
        tableName: "ActivitiesMusic", comment: "Why the sound check runs, before it starts")
    }
  }
}
