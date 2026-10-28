import AVFoundation
import Charts
import Combine
import SwiftUI

/// The text, case, chart or recording a set's questions share, above each of them. A text shows
/// whole, except a long one right after another question on it (`continued`): the learner just
/// read it, so it shows its start with a way to read it all again.
struct ItemSetStimulusView: View {
  let set: PracticeItemSet
  var continued = false
  /// Where a recording's plays count (the block or mock it's asked in), so asking it again
  /// elsewhere starts with every play.
  var askedIn: String?
  /// The questions of a recording, to read before it plays; the one on screen is `current`.
  var recordingQuestions: (prompts: [String], current: Int)?
  var transcript: [PracticeTranscriptLine]?

  var body: some View {
    if let listening = set.listening {
      VStack(alignment: .leading, spacing: 12) {
        SetPlace(set: set)
        ListeningPlayerView(
          listening: listening,
          playsKey: [askedIn, set.id].compactMap(\.self).joined(separator: ":"),
          questions: recordingQuestions,
          transcript: transcript ?? listening.transcript)
      }
    } else {
      SetTextView(set: set, continued: continued)
    }
  }
}

/// "Question 2 of 4 on this text": where the question sits among the ones sharing the stimulus.
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
    .font(.caption.weight(.medium))
    .foregroundStyle(.secondary)
  }
}

private struct SetTextView: View {
  let set: PracticeItemSet
  let continued: Bool
  @State private var isExpanded: Bool?

  /// Shorter texts fit in the folded height anyway, so they never fold.
  private static let foldMinCharacters = 400

  var body: some View {
    let folds = continued && (set.text?.count ?? 0) >= Self.foldMinCharacters
    let expanded = isExpanded ?? !folds

    VStack(alignment: .leading, spacing: 12) {
      SetPlace(set: set)

      if let title = set.title {
        Text(title).font(.headline)
      }

      if let text = set.text {
        ItemText(text)
          .font(.callout)
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
        .buttonStyle(.bordered)
        .controlSize(.small)
      }

      if let visual = set.visual {
        PracticeVisualView(visual: visual)
      }

      if let source = set.source {
        Text(source).font(.caption).foregroundStyle(.secondary)
      }
    }
    .padding(.leading, 14)
    .overlay(alignment: .leading) {
      Rectangle().fill(Color(.separator)).frame(width: 2)
    }
    .accessibilityElement(children: .contain)
  }
}

/// A question's own context, picture or chart, right above it.
struct ItemSupportView: View {
  let context: String?
  let image: PracticeImage?
  let visual: PracticeVisual?

  var body: some View {
    if let context {
      ItemText(context).font(.callout).foregroundStyle(.secondary)
    }

    if let image, let url = URL(string: image.url) {
      AsyncImage(url: url) { phase in
        if let picture = phase.image {
          picture.resizable().scaledToFit()
        } else {
          Color(.secondarySystemFill)
            .aspectRatio(
              CGFloat(image.width ?? 4) / CGFloat(max(image.height ?? 3, 1)), contentMode: .fit)
        }
      }
      .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
      .accessibilityLabel(Text(verbatim: image.alt))
    }

    if let visual {
      PracticeVisualView(visual: visual)
    }
  }
}

/// A chart with Swift Charts, or a timeline as a list of dated events.
struct PracticeVisualView: View {
  let visual: PracticeVisual

  var body: some View {
    switch visual {
    case .chart(let chart):
      VStack(alignment: .leading, spacing: 8) {
        Text(chart.title).font(.subheadline.weight(.semibold))

        Chart {
          ForEach(chart.series, id: \.name) { series in
            ForEach(Array(zip(chart.categories, series.values)), id: \.0) { category, value in
              if chart.chart == .bar {
                BarMark(
                  x: .value(chart.categoryLabel, category), y: .value(chart.valueLabel, value)
                )
                .foregroundStyle(by: .value("Series", series.name))
                .position(by: .value("Series", series.name))
              } else {
                LineMark(
                  x: .value(chart.categoryLabel, category), y: .value(chart.valueLabel, value)
                )
                .foregroundStyle(by: .value("Series", series.name))
                .symbol(by: .value("Series", series.name))
              }
            }
          }
        }
        .chartLegend(chart.series.count > 1 ? .visible : .hidden)
        .chartYAxisLabel(chart.unit.map { "\(chart.valueLabel) (\($0))" } ?? chart.valueLabel)
        .chartXAxisLabel(chart.categoryLabel)
        .frame(minHeight: 200)

        if let source = chart.source {
          Text(source).font(.caption).foregroundStyle(.secondary)
        }
      }
    case .timeline(let timeline):
      VStack(alignment: .leading, spacing: 8) {
        Text(timeline.title).font(.subheadline.weight(.semibold))

        ForEach(Array(timeline.events.enumerated()), id: \.offset) { _, event in
          HStack(alignment: .firstTextBaseline, spacing: 12) {
            Text(event.date).font(.footnote.monospacedDigit()).foregroundStyle(.secondary)
            VStack(alignment: .leading, spacing: 2) {
              Text(event.label).font(.callout.weight(.medium))
              if let detail = event.detail {
                Text(detail).font(.footnote).foregroundStyle(.secondary)
              }
            }
          }
          .accessibilityElement(children: .combine)
        }
      }
    }
  }
}

// MARK: - Recording

/// Plays already used per asking of a recording (`playsKey`), kept while the app runs, so moving
/// between a set's questions keeps the exam's play limit.
@MainActor
private enum ListeningPlays {
  static var used: [String: Int] = [:]
}

/// The recording a set's questions are about: the exam's play limit kept across the set's
/// questions, its questions to read before it plays, and, once they're answered, free replays and
/// the transcript on request. A play doesn't pause, as in the exam.
private struct ListeningPlayerView: View {
  let listening: PracticeItemSet.Listening
  let playsKey: String
  let questions: (prompts: [String], current: Int)?
  let transcript: [PracticeTranscriptLine]?
  @State private var player: AVPlayer?
  @State private var isPlaying = false
  @State private var played = 0
  @State private var failed = false
  @State private var showsQuestions: Bool?
  @State private var showsTranscript = false

  var body: some View {
    let answered = transcript != nil
    let playsLeft = max(listening.plays - played, 0)

    VStack(alignment: .leading, spacing: 12) {
      if let title = listening.title {
        Text(title).font(.headline)
      }

      if let task = listening.task {
        ItemText(task).font(.callout)
      }

      Text(rule(answered: answered, playsLeft: playsLeft))
        .font(.footnote)
        .foregroundStyle(.secondary)

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
      .buttonStyle(.bordered)
      .disabled(isPlaying || (!answered && playsLeft == 0) || listening.audio == nil)

      if failed {
        Text(
          "The recording didn't load. Check your connection and try again.", tableName: "Practice",
          comment: "Shown when a set's recording fails to load."
        )
        .font(.footnote)
        .foregroundStyle(.pink)
      }

      if let questions, !questions.prompts.isEmpty {
        DisclosureGroup(isExpanded: questionsExpanded) {
          VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(questions.prompts.enumerated()), id: \.offset) { index, prompt in
              Text("\(index + 1). \(ItemTextBlock.plain(prompt))")
                .font(.footnote)
                .fontWeight(index == questions.current ? .medium : .regular)
                .foregroundStyle(index == questions.current ? .primary : .secondary)
            }
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(.top, 6)
        } label: {
          Text(
            "Questions on this recording (\(questions.prompts.count))", tableName: "Practice",
            comment: "Folds the list of every question about a recording, to read before it plays."
          )
          .font(.subheadline.weight(.medium))
        }
      }

      if let transcript, !transcript.isEmpty {
        DisclosureGroup(isExpanded: $showsTranscript) {
          VStack(alignment: .leading, spacing: 10) {
            ForEach(Array(transcript.enumerated()), id: \.offset) { index, turn in
              VStack(alignment: .leading, spacing: 2) {
                if index == 0 || transcript[index - 1].speaker != turn.speaker {
                  Text(turn.speaker).font(.footnote.weight(.semibold))
                }
                Text(turn.text).font(.footnote)
              }
            }
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(.top, 6)
        } label: {
          Text("Transcript", tableName: "Practice", comment: "Folds who said what in a recording.")
            .font(.subheadline.weight(.medium))
        }
      }
    }
    .onAppear { played = ListeningPlays.used[playsKey] ?? 0 }
    .onDisappear {
      player?.pause()
      player = nil
    }
    .onReceive(NotificationCenter.default.publisher(for: AVPlayerItem.didPlayToEndTimeNotification))
    {
      notification in
      guard let item = notification.object as? AVPlayerItem, item == player?.currentItem else {
        return
      }
      isPlaying = false
    }
  }

  private var questionsExpanded: Binding<Bool> {
    Binding(get: { showsQuestions ?? (played == 0) }, set: { showsQuestions = $0 })
  }

  private func rule(answered: Bool, playsLeft: Int) -> LocalizedStringResource {
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

    failed = false
    try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
    let item = AVPlayerItem(url: url)
    let next = AVPlayer(playerItem: item)
    player = next
    isPlaying = true
    played += 1
    ListeningPlays.used[playsKey] = played
    next.play()

    Task { @MainActor in
      for await status in item.publisher(for: \.status).values where status != .unknown {
        if status == .failed {
          failed = true
          isPlaying = false
        }
        break
      }
    }
  }
}
