import SwiftUI

/// The surface a music activity draws on: main's `ActivityCanvas`, a soft panel.
struct MusicCanvas<Content: View>: View {
  @ViewBuilder let content: Content

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      content
    }
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding()
    .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 20, style: .continuous))
  }
}

/// An outlined "Hear it" button: plays a sound the canvas shows.
struct MusicSoundButton: View {
  let title: Text
  var isDisabled = false
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      Label {
        title
      } icon: {
        Image(systemName: "speaker.wave.2")
      }
    }
    .buttonStyle(.bordered)
    .buttonBorderShape(.capsule)
    .disabled(isDisabled)
  }
}

/// Says when the sound couldn't start, so silence isn't mistaken for a broken key.
struct MusicSoundNote: View {
  let audio: MusicAudio

  var body: some View {
    if audio.isUnavailable {
      Text(
        "The sound couldn't play. You can still see every note.", tableName: "ActivitiesMusic",
        comment: "Under an instrument when the device couldn't play sound"
      )
      .font(.subheadline)
      .foregroundStyle(.secondary)
    }
  }
}

/// A note's name in a circle, drawn on a piano key or a guitar string: pressed (`new`), kept,
/// taken away, sounding, and after a check right, wrong or missing.
struct NoteMark: View {
  @ScaledMetric(relativeTo: .caption2) private var size = 28

  let kind: NoteMarkKind
  let label: String

  var body: some View {
    Text(label)
      .font(.caption2.weight(.semibold).monospacedDigit())
      .minimumScaleFactor(0.6)
      .lineLimit(1)
      .foregroundStyle(textColor)
      .padding(2)
      .frame(width: size, height: size)
      .background(fill, in: .circle)
      .overlay {
        if let border {
          Circle()
            .strokeBorder(border, style: StrokeStyle(lineWidth: 2, dash: isDashed ? [3, 2] : []))
        }
      }
      .accessibilityHidden(true)
  }

  private var fill: Color {
    switch kind {
    case .correct: .success
    case .heard, .new: .mint
    case .kept: .primary
    case .missed, .removed, .wrong: Color(.systemBackground)
    }
  }

  private var textColor: Color {
    switch kind {
    case .correct, .heard, .new, .kept: Color(.systemBackground)
    case .missed: .success
    case .removed: .secondary
    case .wrong: .destructive
    }
  }

  private var border: Color? {
    switch kind {
    case .missed: .success
    case .removed: .secondary
    case .wrong: .destructive
    case .correct, .heard, .new, .kept: nil
    }
  }

  private var isDashed: Bool {
    kind == .missed || kind == .removed
  }
}

extension Color {
  /// A piano's keys keep their look in dark mode, as main's do: ivory turns a soft light gray so
  /// it doesn't glare, and the black keys stay black. No system color is a piano key.
  static let pianoWhiteKey = Color(
    uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(white: 0.88, alpha: 1) : .white })
  static let pianoBlackKey = Color(
    uiColor: UIColor {
      $0.userInterfaceStyle == .dark
        ? UIColor(white: 0.04, alpha: 1) : UIColor(white: 0.09, alpha: 1)
    })
}

/// A piano keyboard drawn to scale, for pressing notes or showing them. Each key is a button
/// named by its note ("E flat") and selected while pressed. With a hardware keyboard it's one
/// stop: the arrows move between keys and Return or Space presses the focused one.
struct PianoKeyboard: View {
  @ScaledMetric(relativeTo: .caption) private var height = 150
  @FocusState private var isFocused: Bool
  @State private var focusedMidi: Int?
  @State private var width: CGFloat = 0

  let from: Int
  let to: Int
  let label: String
  let marks: [Int: NoteMarkKind]
  let nameOf: (Int) -> String
  let spokenNameOf: (Int) -> String
  var isPressed: (Int) -> Bool = { _ in false }
  /// Pressing a key toggles it; without it the keyboard only shows notes.
  var onPress: ((Int) -> Void)?

  /// A key people press is at least 44 points wide: white keys of 72 keep the black keys above
  /// it, so a keyboard wider than the screen scrolls sideways.
  private static let pressableWhiteKey: CGFloat = 72
  private static let blackKeyShare: CGFloat = 0.62

  private var midis: [Int] { Array(from...to) }
  private var whiteKeys: [Int] { midis.filter { !MusicNotes.isBlackKey($0) } }

  var body: some View {
    let keyboardHeight = min(height, 220)

    Group {
      if onPress != nil {
        ScrollView(.horizontal) {
          keys(
            width: max(width, CGFloat(whiteKeys.count) * Self.pressableWhiteKey),
            height: keyboardHeight)
        }
        .scrollIndicators(.visible)
        .scrollBounceBehavior(.basedOnSize)
        .focusable()
        .focused($isFocused)
        .focusEffectDisabled()
        .onKeyPress(keys: [.leftArrow, .rightArrow, .return, .space]) { press in
          handleKey(press.key)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(label)
      } else {
        keys(width: width, height: keyboardHeight)
          .accessibilityHidden(true)
      }
    }
    .frame(height: keyboardHeight)
    .frame(maxWidth: .infinity)
    .onGeometryChange(for: CGFloat.self) {
      $0.size.width
    } action: {
      width = $0
    }
  }

  private func keys(width: CGFloat, height: CGFloat) -> some View {
    let whiteWidth = width / CGFloat(max(whiteKeys.count, 1))

    return ZStack(alignment: .topLeading) {
      HStack(spacing: 0) {
        ForEach(whiteKeys, id: \.self) { midi in
          key(midi, isBlack: false)
            .frame(width: whiteWidth)
        }
      }

      ForEach(midis.filter(MusicNotes.isBlackKey), id: \.self) { midi in
        let whitesBefore = whiteKeys.filter { $0 < midi }.count
        let blackWidth = whiteWidth * Self.blackKeyShare

        key(midi, isBlack: true)
          .frame(width: blackWidth, height: height * 0.6)
          .offset(x: CGFloat(whitesBefore) * whiteWidth - blackWidth / 2)
      }
    }
    .frame(width: width, height: height)
  }

  @ViewBuilder
  private func key(_ midi: Int, isBlack: Bool) -> some View {
    let mark = marks[midi]
    let shape = UnevenRoundedRectangle(
      bottomLeadingRadius: isBlack ? 8 : 12, bottomTrailingRadius: isBlack ? 8 : 12,
      style: .continuous)

    Button {
      focusedMidi = midi
      onPress?(midi)
    } label: {
      VStack {
        Spacer(minLength: 0)

        if let mark {
          NoteMark(kind: mark, label: nameOf(midi))
        } else if midi % MusicNotes.octave == 0 {
          Text(nameOf(midi))
            .font(.caption.weight(.medium))
            .foregroundStyle(Color.black.opacity(0.55))
        }
      }
      .padding(.bottom, isBlack ? 6 : 8)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .contentShape(shape)
    }
    .buttonStyle(PianoKeyStyle(isBlack: isBlack, shape: shape))
    .overlay {
      if isFocused, focusedMidi ?? from == midi {
        shape.inset(by: 2).strokeBorder(.tint, lineWidth: 3)
      }
    }
    .disabled(onPress == nil)
    .accessibilityLabel(spokenNameOf(midi))
    .accessibilityAddTraits(isPressed(midi) ? .isSelected : [])
  }

  private func handleKey(_ key: KeyEquivalent) -> KeyPress.Result {
    let current = focusedMidi ?? from

    switch key {
    case .leftArrow:
      focusedMidi = max(from, current - 1)
    case .rightArrow:
      focusedMidi = min(to, current + 1)
    default:
      focusedMidi = current
      onPress?(current)
    }

    return .handled
  }
}

private struct PianoKeyStyle: ButtonStyle {
  @Environment(\.isEnabled) private var isEnabled

  let isBlack: Bool
  let shape: UnevenRoundedRectangle

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .background {
        shape.fill(isBlack ? Color.pianoBlackKey : Color.pianoWhiteKey)
          .overlay {
            if configuration.isPressed {
              shape.fill(isBlack ? Color.white.opacity(0.25) : Color.black.opacity(0.08))
            }
          }
      }
      .overlay {
        shape.strokeBorder(Color.black.opacity(isBlack ? 0 : 0.22), lineWidth: 1)
      }
  }
}

/// A guitar neck in standard tuning, drawn the way tab reads it (high E on top) with a window of
/// frets. It shows a shape, or, with `onChange`, lets the learner pick one fret per string (or
/// mute it). VoiceOver reads each string as one adjustable element: swipe up or down to move
/// along it.
struct GuitarFretboard: View {
  @ScaledMetric(relativeTo: .body) private var rowHeight = 44
  @ScaledMetric(relativeTo: .caption) private var nameWidth = 20

  let firstFret: Int
  let voicing: GuitarVoicing
  var markOf: (Int) -> NoteMarkKind = { _ in .new }
  let nameOf: (Int) -> String
  /// Picking a fret (or nil to mute) for a string; without it the fretboard only shows.
  var onChange: ((Int, Int?) -> Void)?

  /// How tab and chord charts mark a string that isn't played.
  private static let mutedMark = "×"

  private var frets: [Int] { Array(firstFret..<(firstFret + Guitar.fretboardSpan)) }

  /// Muted and open each get a column when picking, one shared column when only showing.
  private var leadingWidth: CGFloat { onChange == nil ? 32 : 88 }

  var body: some View {
    VStack(spacing: 0) {
      ForEach(Guitar.tuning.indices.reversed(), id: \.self) { string in
        HStack(spacing: 0) {
          Text(MusicLabels.display(MusicLabels.stringNames[string]))
            .font(.caption.weight(.medium))
            .foregroundStyle(.secondary)
            .frame(width: nameWidth)
            .accessibilityHidden(true)

          if let onChange {
            picker(string: string, onChange: onChange)
          } else {
            openOrMuted(voicing[string])
              .frame(width: leadingWidth)

            ForEach(frets, id: \.self) { fret in
              fretCell(string: string, fret: fret, height: rowHeight * 0.75)
            }
          }
        }
        // Every cell takes the row's height, so frets and the nut run unbroken down the neck.
        .fixedSize(horizontal: false, vertical: true)
      }

      HStack(spacing: 0) {
        Color.clear.frame(width: nameWidth + leadingWidth, height: 1)

        ForEach(frets, id: \.self) { fret in
          Text(fret, format: .number)
            .font(.caption.monospacedDigit())
            .foregroundStyle(.secondary)
            .frame(minWidth: 44, maxWidth: .infinity)
        }
      }
      .padding(.top, 4)
      .accessibilityHidden(true)
    }
    .accessibilityHidden(onChange == nil)
  }

  private func openOrMuted(_ fret: Int?) -> some View {
    ZStack {
      Color.clear

      if fret == nil {
        Text(Self.mutedMark)
          .font(.subheadline.weight(.semibold))
          .foregroundStyle(.secondary)
      } else if fret == 0 {
        Circle().strokeBorder(.primary, lineWidth: 2).frame(width: 14, height: 14)
      }
    }
  }

  private func picker(string: Int, onChange: @escaping (Int, Int?) -> Void) -> some View {
    let current = voicing[string]
    let options: [Int?] = [nil, 0] + frets.map { Optional($0) }

    return HStack(spacing: 0) {
      Button {
        onChange(string, nil)
      } label: {
        Text(Self.mutedMark)
          .font(.subheadline.weight(.semibold))
          .foregroundStyle(current == nil ? AnyShapeStyle(.primary) : AnyShapeStyle(.quaternary))
          .frame(width: 44, height: rowHeight)
          .contentShape(.rect)
      }

      Button {
        onChange(string, 0)
      } label: {
        Circle()
          .strokeBorder(
            current == 0 ? AnyShapeStyle(.primary) : AnyShapeStyle(.quaternary), lineWidth: 2
          )
          .background(Circle().fill(current == 0 ? Color.primary.opacity(0.1) : .clear))
          .frame(width: 14, height: 14)
          .frame(width: 44, height: rowHeight)
          .contentShape(.rect)
      }
      .overlay(alignment: .trailing) {
        Rectangle()
          .fill(firstFret == 1 ? AnyShapeStyle(.primary.opacity(0.7)) : AnyShapeStyle(.separator))
          .frame(width: firstFret == 1 ? 4 : 2)
      }

      ForEach(frets, id: \.self) { fret in
        Button {
          onChange(string, fret)
        } label: {
          fretCell(string: string, fret: fret, height: rowHeight)
            .contentShape(.rect)
        }
      }
    }
    .buttonStyle(.plain)
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(MusicLabels.string(string))
    .accessibilityValue(
      MusicLabels.position(
        fret: current, midi: current.map { Guitar.noteMidi(string: string, fret: $0) })
    )
    .accessibilityAdjustableAction { direction in
      let index = options.firstIndex(of: current) ?? 0
      let next = direction == .increment ? min(index + 1, options.count - 1) : max(index - 1, 0)

      if next != index {
        onChange(string, options[next])
      }
    }
  }

  private func fretCell(string: Int, fret: Int, height: CGFloat) -> some View {
    ZStack {
      Rectangle()
        .fill(.secondary.opacity(0.5))
        .frame(height: 1)

      if voicing[string] == fret, fret > 0 {
        NoteMark(kind: markOf(string), label: nameOf(Guitar.noteMidi(string: string, fret: fret)))
      }
    }
    .frame(minWidth: 44, maxWidth: .infinity, minHeight: height, maxHeight: .infinity)
    .overlay(alignment: .trailing) {
      Rectangle().fill(.separator).frame(width: 2)
    }
    .overlay(alignment: .leading) {
      if onChange == nil, fret == firstFret, firstFret == 1 {
        Rectangle().fill(.primary.opacity(0.7)).frame(width: 4)
      }
    }
  }
}
