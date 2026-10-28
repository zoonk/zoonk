import Observation
import QuartzCore
import SwiftUI

extension ActivityRenderer {
  static let notationPlayer = ActivityRenderer(template: "notationPlayer") { context in
    if let fields = try? context.fields(as: NotationPlayerFields.self) {
      NotationPlayerCanvas(fields: fields)
    }
  }
}

struct NotationPlayerFields: Decodable, Hashable, Sendable {
  enum View: String, Decodable, Hashable, Sendable {
    case staff, tab
  }

  let notation: String
  let tempo: Int
  let view: View
}

/// Plays a tune on the piano and follows it: which note sounds, and which bar. Audio and the
/// highlight start together on the same moment of the host clock.
@MainActor
@Observable
final class NotationPlayback {
  struct Event {
    let element: NotationElementID
    let start: Double
  }

  private(set) var startTime: TimeInterval?
  @ObservationIgnored private var events: [Event] = []
  @ObservationIgnored private var finishTask: Task<Void, Never>?

  var isPlaying: Bool { startTime != nil }

  /// The note or rest sounding at host time `now`.
  func current(at now: TimeInterval) -> NotationElementID? {
    guard let startTime else {
      return nil
    }

    return events.last { $0.start <= now - startTime }?.element
  }

  func play(_ tune: ABCTune, bpm: Int, audio: MusicAudio) {
    stop(audio: audio)

    let (events, sounds, length) = Self.schedule(tune, bpm: bpm)

    guard !events.isEmpty, let soonest = audio.soonestHeardTime() else {
      return
    }

    let start = soonest + 0.05
    audio.play(sounds, on: .piano, from: start)
    self.events = events
    startTime = start

    finishTask = Task { [weak self] in
      try? await Task.sleep(for: .seconds(start + length - CACurrentMediaTime()))

      guard let self, !Task.isCancelled else {
        return
      }

      self.startTime = nil
      self.finishTask = nil
    }
  }

  func stop(audio: MusicAudio) {
    finishTask?.cancel()
    finishTask = nil

    if startTime != nil {
      audio.stop()
    }

    startTime = nil
  }

  /// Every note and rest in playing order with its start, the notes as sounds (a tie rings on
  /// instead of striking again), and how long the tune lasts, all in seconds: a beat (abcjs's
  /// beat length for the meter) lasts 60 / `bpm`.
  nonisolated static func schedule(_ tune: ABCTune, bpm: Int) -> (
    events: [Event], sounds: [MusicSound], length: Double
  ) {
    let secondsPerWhole = 60 / Double(bpm) / tune.meter.beatLength
    let played = tune.playOrder.flatMap { bar in
      tune.bars[bar].elements.enumerated().map {
        (NotationElementID(bar: bar, index: $0.offset), $0.element)
      }
    }

    var events: [Event] = []
    var sounds: [MusicSound] = []
    var time = 0.0

    for (index, (id, element)) in played.enumerated() {
      events.append(Event(element: id, start: time))

      for pitch in element.pitches where !pitch.continuesTie {
        var length = element.sounding
        var next = index
        var isTied = pitch.isTied

        while isTied, next + 1 < played.count,
          let held = played[next + 1].1.pitches.first(where: {
            $0.midi == pitch.midi && $0.continuesTie
          })
        {
          next += 1
          length += played[next].1.sounding
          isTied = held.isTied
        }

        sounds.append(MusicSound(at: time, midi: pitch.midi, duration: length * secondsPerWhole))
      }

      time += element.sounding * secondsPerWhole
    }

    return (events, sounds, time)
  }
}

/// A short melody drawn on the staff (or with guitar tab under it) that plays while the sounding
/// note lights up. The learner can slow it down and switch views; the question below asks about
/// what they read and heard. VoiceOver reads the notes bar by bar.
private struct NotationPlayerCanvas: View {
  @State private var view: NotationPlayerFields.View
  @State private var tempo: Int
  @State private var audio = MusicAudio()
  @State private var playback = NotationPlayback()

  let fields: NotationPlayerFields
  private let tune: ABCTune

  init(fields: NotationPlayerFields) {
    self.fields = fields
    tune = ABCTune(notation: fields.notation)
    _view = State(initialValue: fields.view)
    _tempo = State(initialValue: fields.tempo)
  }

  var body: some View {
    MusicCanvas {
      header

      if tune.hasMusic {
        NotationStaff(tune: tune, showsTab: view == .tab, playback: playback)
          .accessibilityElement()
          .accessibilityLabel(
            tune.title
              ?? String(
                localized: "Melody", table: "ActivitiesMusic", comment: "A melody without a title")
          )
          .accessibilityValue(outlineText)
          .accessibilityAddTraits(.isImage)

        TimelineView(.animation(minimumInterval: 0.1, paused: !playback.isPlaying)) { _ in
          controls(bar: playback.current(at: CACurrentMediaTime()).map { $0.bar + 1 })
        }
      } else {
        Text(
          "This music couldn't be drawn.", tableName: "ActivitiesMusic",
          comment: "When a melody's notation can't be read"
        )
        .font(.subheadline)
        .foregroundStyle(.secondary)
      }

      MusicSoundNote(audio: audio)
    }
    .onAppear {
      audio.onInterruption = { playback.stop(audio: audio) }
    }
    .onDisappear {
      playback.stop(audio: audio)
      audio.close()
    }
  }

  private var header: some View {
    ViewThatFits(in: .horizontal) {
      HStack(alignment: .top) {
        titles
        Spacer(minLength: 12)
        viewPicker.fixedSize()
      }

      VStack(alignment: .leading, spacing: 12) {
        titles
        viewPicker
      }
    }
  }

  private var titles: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(
        tune.title
          ?? String(
            localized: "Melody", table: "ActivitiesMusic", comment: "A melody without a title")
      )
      .font(.headline)

      if let composer = tune.composer {
        Text(composer)
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }
    }
  }

  private var viewPicker: some View {
    Picker(selection: $view) {
      Text("Staff", tableName: "ActivitiesMusic", comment: "Shows the melody on a music staff")
        .tag(NotationPlayerFields.View.staff)
      Text("Tab", tableName: "ActivitiesMusic", comment: "Shows guitar tablature under the staff")
        .tag(NotationPlayerFields.View.tab)
    } label: {
      Text(
        "Show the music as", tableName: "ActivitiesMusic", comment: "Chooses staff or guitar tab")
    }
    .pickerStyle(.segmented)
    .onChange(of: view) { playback.stop(audio: audio) }
  }

  @ViewBuilder
  private func controls(bar: Int?) -> some View {
    let bars = tune.outline.count

    HStack(spacing: 12) {
      Button {
        if playback.isPlaying {
          playback.stop(audio: audio)
        } else {
          playback.play(tune, bpm: tempo, audio: audio)
        }
      } label: {
        Label {
          playback.isPlaying
            ? Text("Stop", tableName: "ActivitiesMusic", comment: "Stops the melody")
            : Text(
              "Play the melody", tableName: "ActivitiesMusic",
              comment: "Plays the melody on the staff")
        } icon: {
          Image(systemName: playback.isPlaying ? "stop.fill" : "play.fill")
        }
        .labelStyle(.iconOnly)
        .frame(minWidth: 24, minHeight: 24)
      }
      .buttonStyle(.mainAction)
      .buttonBorderShape(.circle)
      .controlSize(.large)

      VStack(alignment: .leading, spacing: 6) {
        ProgressView(value: Double(bar ?? 0), total: Double(max(bars, 1)))
          .tint(.purple)
          .accessibilityHidden(true)

        Group {
          if let bar {
            Text(
              "Bar \(bar) of \(bars)", tableName: "ActivitiesMusic",
              comment: "Which bar of the melody is playing")
          } else {
            Text(
              "\(bars) bars", tableName: "ActivitiesMusic", comment: "How many bars the melody has")
          }
        }
        .font(.caption.monospacedDigit())
        .foregroundStyle(.secondary)
      }

      Picker(selection: $tempo) {
        ForEach(ABCTune.practiceTempos(fields.tempo), id: \.self) { option in
          Text(
            "\(option) bpm", tableName: "ActivitiesMusic",
            comment: "A rhythm's tempo in beats per minute"
          )
          .tag(option)
        }
      } label: {
        Text("Tempo", tableName: "ActivitiesMusic", comment: "Chooses how fast the melody plays")
      }
      .pickerStyle(.menu)
      .fixedSize()
      .onChange(of: tempo) { playback.stop(audio: audio) }
    }
  }

  /// The notes bar by bar, as VoiceOver reads the staff: "Bar 1: E, E, F, G."
  private var outlineText: String {
    tune.outline.enumerated().map { bar, midis in
      let notes = midis.map { MusicLabels.spoken(MusicNotes.pitchClassName($0)) }.joined(
        separator: ", ")
      return String(
        localized: "Bar \(bar + 1): \(notes).", table: "ActivitiesMusic",
        comment: "VoiceOver: the notes of one bar of the melody")
    }
    .joined(separator: " ")
  }
}

/// The tune drawn crisply at the width it's shown, in the text color so it follows light, dark
/// and Increase Contrast; the note playing turns mint (main's `viz-accent`). The staff scales
/// with Dynamic Type.
private struct NotationStaff: View {
  @ScaledMetric(relativeTo: .body) private var space = 8
  @ScaledMetric(relativeTo: .caption2) private var tabSpace = 13
  @ScaledMetric(relativeTo: .caption) private var textHeight = 16
  @State private var width: CGFloat = 0

  let tune: ABCTune
  let showsTab: Bool
  let playback: NotationPlayback

  var body: some View {
    let drawing =
      width > 0
      ? NotationDrawing(
        tune: tune, width: width, space: space, tabSpace: showsTab ? tabSpace : nil,
        textHeight: textHeight)
      : NotationDrawing()

    TimelineView(.animation(paused: !playback.isPlaying)) { _ in
      let playing = playback.current(at: CACurrentMediaTime())

      Canvas { context, _ in
        for item in drawing.items {
          let shading: GraphicsContext.Shading =
            item.element != nil && item.element == playing ? .color(.mint) : .foreground

          switch item.mark {
          case .fill(let path):
            context.fill(path, with: shading)
          case .stroke(let path, let width):
            context.stroke(
              path, with: shading, style: StrokeStyle(lineWidth: width, lineCap: .round))
          case .text(let text, let point, let kind):
            draw(text, at: point, kind: kind, shading: shading, in: &context)
          }
        }
      }
    }
    .frame(height: drawing.height)
    .frame(maxWidth: .infinity)
    .onGeometryChange(for: CGFloat.self) {
      $0.size.width
    } action: {
      width = $0
    }
  }

  private func draw(
    _ text: String, at point: CGPoint, kind: NotationDrawing.TextKind,
    shading: GraphicsContext.Shading, in context: inout GraphicsContext
  ) {
    let font: Font =
      switch kind {
      case .chordSymbol: .caption
      case .tabFret: .caption2.weight(.semibold).monospacedDigit()
      case .tupletNumber: .caption2.italic()
      case .endingNumber: .caption2
      }

    var resolved = context.resolve(Text(text).font(font))
    resolved.shading = shading

    switch kind {
    case .tabFret:
      let size = resolved.measure(in: CGSize(width: 100, height: 100))
      let knockout = CGRect(
        x: point.x - size.width / 2 - 1, y: point.y - size.height / 2, width: size.width + 2,
        height: size.height)
      context.fill(Path(knockout), with: .color(Color(.secondarySystemBackground)))
      context.draw(resolved, at: point, anchor: .center)
    case .chordSymbol:
      context.draw(resolved, at: point, anchor: .bottomLeading)
    case .tupletNumber:
      context.draw(resolved, at: point, anchor: .center)
    case .endingNumber:
      context.draw(resolved, at: point, anchor: .topLeading)
    }
  }
}
