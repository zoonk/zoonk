import AVFoundation
import Charts
import Combine
import SwiftUI

/// A long text right after another question on it (`continued`) shows its start with a way to read
/// it all again: the learner just read it.
struct ItemSetStimulusView: View {
  let set: PracticeItemSet
  var continued = false
  /// Where a recording's plays count (the block or mock it's asked in), so asking it again
  /// elsewhere starts with every play.
  var askedIn: String?
  var recordingQuestions: (prompts: [String], current: Int)?
  var transcript: [PracticeTranscriptLine]?
  /// A mock counts a recording's plays on the server, the same on any device (`ServedPlays`).
  var served: ServedPlays?

  var body: some View {
    if let listening = set.listening {
      VStack(alignment: .leading, spacing: 12) {
        SetPlace(set: set)
        ListeningPlayerView(
          listening: listening,
          playsKey: [askedIn, set.id].compactMap(\.self).joined(separator: ":"),
          questions: recordingQuestions,
          transcript: transcript ?? listening.transcript,
          served: served)
      }
    } else {
      SetTextView(set: set, continued: continued)
    }
  }
}

private struct SetPlace: View {
  let set: PracticeItemSet

  var body: some View {
    let position = set.position + 1

    Group {
      switch set.kind {
      case .audio:
        Text(
          "Question \(position) of \(set.count) on this recording", tableName: "Practice",
          comment: "Where a question sits among the questions about the same recording.")
      case .case:
        Text(
          "Question \(position) of \(set.count) on this case", tableName: "Practice",
          comment: "Where a question sits among the questions about the same case.")
      case .chart:
        Text(
          "Question \(position) of \(set.count) on this chart", tableName: "Practice",
          comment: "Where a question sits among the questions about the same chart.")
      case .text:
        Text(
          "Question \(position) of \(set.count) on this text", tableName: "Practice",
          comment: "Where a question sits among the questions about the same text.")
      }
    }
    .typeStyle(.meta.weight(.medium))
    .foregroundStyle(.mutedForeground)
  }
}

private struct SetTextView: View {
  let set: PracticeItemSet
  let continued: Bool
  @State private var isExpanded: Bool?
  @Environment(\.isPaneSplit) private var isPaneSplit

  /// Shorter texts fit in the folded height anyway, so they never fold.
  private static let foldMinCharacters = 400

  var body: some View {
    let folds = continued && !isPaneSplit && (set.text?.count ?? 0) >= Self.foldMinCharacters
    let expanded = isExpanded ?? !folds

    VStack(alignment: .leading, spacing: 12) {
      SetPlace(set: set)

      if let title = set.title {
        Text(title).typeStyle(.body.weight(.semibold))
      }

      if let text = set.text {
        ItemText(text)
          .typeStyle(.reading)
          .lineLimit(expanded ? nil : 4)
      }

      if folds {
        Button {
          isExpanded = !expanded
        } label: {
          Label {
            if expanded {
              Text("Show less", tableName: "Practice", comment: "Folds a shared text read before.")
            } else {
              Text(
                "Read it all again", tableName: "Practice",
                comment: "Unfolds a shared text read before.")
            }
          } icon: {
            Image(systemName: expanded ? "chevron.up" : "chevron.down")
          }
        }
        .buttonStyle(.outline)
        .controlSize(.small)
      }

      if let visual = set.visual {
        PracticeVisualView(visual: visual)
      }

      if let source = set.source {
        Text(source).typeStyle(.meta).foregroundStyle(.mutedForeground)
      }
    }
    .padding(.leading, 14)
    .overlay(alignment: .leading) {
      Rectangle().fill(Color.border).frame(width: 2)
    }
    .accessibilityElement(children: .contain)
  }
}

struct ItemSupportView: View {
  let context: String?
  let image: PracticeImage?
  let visual: PracticeVisual?

  var body: some View {
    if let context {
      ItemText(context).typeStyle(.reading).foregroundStyle(.mutedForeground)
    }

    if let image, let url = URL(string: image.url) {
      AsyncImage(url: url) { phase in
        if let picture = phase.image {
          picture.resizable().scaledToFit()
        } else {
          Color.muted
            .aspectRatio(
              CGFloat(image.width ?? 4) / CGFloat(max(image.height ?? 3, 1)), contentMode: .fit)
        }
      }
      .clipShape(RoundedRectangle(cornerRadius: Radius.xl, style: .continuous))
      .accessibilityLabel(Text(verbatim: image.alt))
    }

    if let visual {
      PracticeVisualView(visual: visual)
    }
  }
}

struct PracticeVisualView: View {
  let visual: PracticeVisual

  var body: some View {
    switch visual {
    case .chart(let chart):
      VStack(alignment: .leading, spacing: 8) {
        Text(chart.title).typeStyle(.body.weight(.semibold))

        Chart {
          ForEach(chart.series, id: \.name) { series in
            ForEach(Array(zip(chart.categories, series.values)), id: \.0) { category, value in
              if chart.chart == .bar {
                BarMark(
                  x: .value(chart.categoryLabel, category), y: .value(chart.valueLabel, value)
                )
                .foregroundStyle(by: .value(verbatim: "Series", series.name))
                .position(by: .value(verbatim: "Series", series.name))
              } else {
                LineMark(
                  x: .value(chart.categoryLabel, category), y: .value(chart.valueLabel, value)
                )
                .foregroundStyle(by: .value(verbatim: "Series", series.name))
                .symbol(by: .value(verbatim: "Series", series.name))
              }
            }
          }
        }
        .chartLegend(chart.series.count > 1 ? .visible : .hidden)
        .lessonValueAxis()
        .chartYAxisLabel(chart.unit.map { "\(chart.valueLabel) (\($0))" } ?? chart.valueLabel)
        .chartXAxisLabel(chart.categoryLabel)
        .frame(minHeight: 200)

        if let source = chart.source {
          Text(source).typeStyle(.meta).foregroundStyle(.mutedForeground)
        }
      }
    case .timeline(let timeline):
      VStack(alignment: .leading, spacing: 8) {
        Text(timeline.title).typeStyle(.body.weight(.semibold))

        ForEach(Array(timeline.events.enumerated()), id: \.offset) { _, event in
          HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(event.date).typeStyle(.data).foregroundStyle(.mutedForeground)
            VStack(alignment: .leading, spacing: 2) {
              Text(event.label).typeStyle(.reading.weight(.medium))
              if let detail = event.detail {
                Text(detail).typeStyle(.note).foregroundStyle(.mutedForeground)
              }
            }
          }
          .accessibilityElement(children: .combine)
        }
      }
    }
  }
}

/// Kept apart from the view that shows it: folding or unfolding iPhone Duo draws that view again, and
/// nothing the learner did with the recording may change for that.
@MainActor
@Observable
private final class SetRecordings {
  struct Panels {
    /// Open before the first play until the learner folds it, folded after it.
    var questions: Bool?
    var transcript = false
  }

  static let shared = SetRecordings()

  /// Plays already used, kept while the app runs, so moving between a set's questions keeps the
  /// exam's play limit.
  var used: [String: Int] = [:]
  var panels: [String: Panels] = [:]
  var failed: Set<String> = []
  private(set) var playing: String?
  private var reached: [String: TimeInterval] = [:]
  @ObservationIgnored private var player: AVPlayer?
  @ObservationIgnored private var shown: [String: Int] = [:]

  func play(_ url: URL, key: String) -> AVPlayerItem {
    try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
    let item = AVPlayerItem(url: url)
    let next = AVPlayer(playerItem: item)
    stop()
    player = next
    playing = key
    next.play()
    return item
  }

  /// Once a play is over, how far it got: its end after a full play.
  func elapsed(_ key: String) -> TimeInterval {
    guard playing == key else { return reached[key] ?? 0 }
    return player.map { $0.currentTime().seconds }.flatMap { $0.isFinite ? $0 : nil } ?? 0
  }

  func ended(_ item: AVPlayerItem?) {
    if let item, item == player?.currentItem { stop() }
  }

  func stop() {
    if let playing { reached[playing] = elapsed(playing) }
    player?.pause()
    player = nil
    playing = nil
  }

  func show(_ key: String) {
    shown[key, default: 0] += 1
  }

  /// A view drawn again appears as the old one goes, so this waits a turn before stopping.
  func hide(_ key: String) {
    shown[key, default: 1] -= 1

    Task {
      if shown[key, default: 0] <= 0, playing == key { stop() }
    }
  }
}

private struct RecordingProgress: View {
  let key: String
  let isPlaying: Bool
  let length: TimeInterval

  var body: some View {
    TimelineView(.animation(minimumInterval: 0.5, paused: !isPlaying)) { _ in
      let elapsed = min(SetRecordings.shared.elapsed(key), length)

      VStack(alignment: .leading, spacing: 4) {
        Meter(value: elapsed, total: length)
        Text(
          "\(clock(elapsed)) of \(clock(length))", tableName: "Practice",
          comment: "How far a recording has played, as in “0:42 of 3:19”."
        )
        .typeStyle(.data)
        .foregroundStyle(.mutedForeground)
      }
      .accessibilityElement(children: .combine)
    }
  }

  private func clock(_ seconds: TimeInterval) -> String {
    Duration.seconds(Int(seconds.rounded())).formatted(.time(pattern: .minuteSecond))
  }
}

/// Counting a play returns false when none were left (another device used the last one).
struct ServedPlays {
  let played: Int
  let record: @MainActor () async -> Bool
}

/// A play doesn't pause, as in the exam.
private struct ListeningPlayerView: View {
  let listening: PracticeItemSet.Listening
  let playsKey: String
  let questions: (prompts: [String], current: Int)?
  let transcript: [PracticeTranscriptLine]?
  let served: ServedPlays?
  @State private var played: Int

  init(
    listening: PracticeItemSet.Listening, playsKey: String,
    questions: (prompts: [String], current: Int)?, transcript: [PracticeTranscriptLine]?,
    served: ServedPlays?
  ) {
    self.listening = listening
    self.playsKey = playsKey
    self.questions = questions
    self.transcript = transcript
    self.served = served
    _played = State(initialValue: Self.played(playsKey, served: served))
  }

  var body: some View {
    let answered = transcript != nil
    let playsLeft = max(listening.plays - played, 0)
    let isPlaying = recordings.playing == playsKey

    VStack(alignment: .leading, spacing: 12) {
      if let title = listening.title {
        Text(title).typeStyle(.body.weight(.semibold))
      }

      if let task = listening.task {
        ItemText(task).typeStyle(.reading)
      }

      Text(rule(answered: answered, playsLeft: playsLeft, isPlaying: isPlaying))
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)

      Button(action: play) {
        Label {
          if isPlaying {
            Text("Playing", tableName: "Practice", comment: "The recording is playing.")
          } else if played > 0 {
            Text("Play it again", tableName: "Practice", comment: "Plays a recording another time.")
          } else {
            Text("Play the recording", tableName: "Practice", comment: "Plays a set's recording.")
          }
        } icon: {
          Image(systemName: isPlaying ? "waveform" : "play.fill")
        }
      }
      .buttonStyle(.outline)
      .disabled(isPlaying || (!answered && playsLeft == 0) || listening.audio == nil)

      if let durationMs = listening.audio?.durationMs, durationMs > 0 {
        RecordingProgress(key: playsKey, isPlaying: isPlaying, length: Double(durationMs) / 1000)
      }

      if recordings.failed.contains(playsKey) {
        FailureLine(
          message: LocalizedStringResource(
            "The recording didn't load. Check your connection and try again.",
            table: "Practice", comment: "Shown when a set's recording fails to load.")
        )
        .typeStyle(.note)
      }

      if let questions, !questions.prompts.isEmpty {
        DisclosureGroup(isExpanded: questionsExpanded) {
          VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(questions.prompts.enumerated()), id: \.offset) { index, prompt in
              Text("\(index + 1). \(ItemTextBlock.plain(prompt))")
                .typeStyle(.note.weight(index == questions.current ? .medium : .regular))
                .foregroundStyle(index == questions.current ? Color(.foreground) : .mutedForeground)
            }
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(.top, 6)
        } label: {
          Text(
            "Questions on this recording (\(questions.prompts.count))", tableName: "Practice",
            comment: "Folds the list of every question about a recording, to read before it plays."
          )
          .typeStyle(.body.weight(.medium))
        }
      }

      if let transcript, !transcript.isEmpty {
        DisclosureGroup(isExpanded: transcriptExpanded) {
          VStack(alignment: .leading, spacing: 10) {
            ForEach(Array(transcript.enumerated()), id: \.offset) { index, turn in
              VStack(alignment: .leading, spacing: 2) {
                if index == 0 || transcript[index - 1].speaker != turn.speaker {
                  Text(turn.speaker).typeStyle(.note.weight(.semibold))
                }
                Text(turn.text).typeStyle(.note)
              }
            }
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(.top, 6)
        } label: {
          Text("Transcript", tableName: "Practice", comment: "Folds who said what in a recording.")
            .typeStyle(.body.weight(.medium))
        }
      }
    }
    .announcesStatus(
      announcement(answered: answered, playsLeft: playsLeft, isPlaying: isPlaying)
    )
    .onAppear { recordings.show(playsKey) }
    // The next question on another recording: this one's play ends with its questions.
    .onChange(of: playsKey) { previous, key in
      recordings.hide(previous)
      recordings.show(key)
      played = Self.played(key, served: served)
    }
    .onChange(of: served?.played) { _, count in played = max(played, count ?? 0) }
    .onDisappear { recordings.hide(playsKey) }
    .onReceive(NotificationCenter.default.publisher(for: AVPlayerItem.didPlayToEndTimeNotification))
    {
      recordings.ended($0.object as? AVPlayerItem)
    }
  }

  private var recordings: SetRecordings { .shared }

  private static func played(_ key: String, served: ServedPlays?) -> Int {
    max(served?.played ?? 0, SetRecordings.shared.used[key] ?? 0)
  }

  private var questionsExpanded: Binding<Bool> {
    Binding(
      get: { recordings.panels[playsKey]?.questions ?? (played == 0) },
      set: { recordings.panels[playsKey, default: .init()].questions = $0 })
  }

  private var transcriptExpanded: Binding<Bool> {
    Binding(
      get: { recordings.panels[playsKey]?.transcript ?? false },
      set: { recordings.panels[playsKey, default: .init()].transcript = $0 })
  }

  /// Silent while an exam recording plays, since speech over it would cover what the learner must
  /// hear, and while its failure line says the recording didn't load.
  private func announcement(answered: Bool, playsLeft: Int, isPlaying: Bool) -> String? {
    if recordings.failed.contains(playsKey) || (isPlaying && !answered) {
      return nil
    }

    return String(localized: rule(answered: answered, playsLeft: playsLeft, isPlaying: isPlaying))
  }

  private func rule(answered: Bool, playsLeft: Int, isPlaying: Bool) -> LocalizedStringResource {
    if answered {
      return LocalizedStringResource(
        "Listen again as often as you like.", table: "Practice",
        comment: "Under a recording once its questions are answered.")
    }

    if isPlaying {
      return LocalizedStringResource(
        "Playing. It doesn't pause, like in the exam.", table: "Practice",
        comment: "Under a recording while it plays in exam conditions.")
    }

    if played == 0 {
      return listening.plays == 1
        ? LocalizedStringResource(
          "You hear it once, like in the exam. Read the questions first.", table: "Practice",
          comment: "Under a recording that plays once.")
        : LocalizedStringResource(
          "You hear it twice, like in the exam. Read the questions first.", table: "Practice",
          comment: "Under a recording that plays twice.")
    }

    return playsLeft > 0
      ? LocalizedStringResource(
        "You can listen one more time.", table: "Practice",
        comment: "Under a recording with one play left.")
      : LocalizedStringResource(
        "You've used every play. Answer from what you heard.", table: "Practice",
        comment: "Under a recording with no plays left.")
  }

  private func play() {
    guard let audio = listening.audio, let url = URL(string: audio.url) else { return }

    let key = playsKey
    recordings.failed.remove(key)
    let item = recordings.play(url, key: key)
    played += 1
    recordings.used[key] = played

    if let served {
      Task { @MainActor in
        guard await !served.record() else { return }
        if recordings.playing == key { recordings.stop() }
        played = listening.plays
      }
    }

    Task { @MainActor in
      for await status in item.publisher(for: \.status).values where status != .unknown {
        if status == .failed {
          recordings.failed.insert(key)
          if recordings.playing == key { recordings.stop() }
        }
        break
      }
    }
  }
}
