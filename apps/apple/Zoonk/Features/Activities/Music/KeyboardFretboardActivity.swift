import SwiftUI

extension ActivityRenderer {
  static let keyboardFretboard = ActivityRenderer(
    template: "keyboardFretboard", grade: KeyboardFretboard.grade
  ) { context in
    if let fields = try? context.fields(as: KeyboardFretboardFields.self) {
      KeyboardFretboardCanvas(fields: fields, context: context)
    }
  }
}

/// Press notes on a piano keyboard, or pick frets on a guitar, and see them on both. The keys
/// start with the start chord when there is one ("change one note"); the answer is the notes
/// pressed, graded by pitch class. With a choice check the instrument is free to explore.
private struct KeyboardFretboardCanvas: View {
  @State private var audio = MusicAudio()

  let fields: KeyboardFretboardFields
  let context: ActivityCanvasContext

  var body: some View {
    MusicCanvas {
      if fields.showsPiano {
        PianoBoard(fields: fields, context: context, audio: audio)
      } else {
        GuitarOnlyBoard(fields: fields, context: context, audio: audio)
      }

      MusicSoundNote(audio: audio)
    }
    .onDisappear { audio.close() }
  }
}

/// What both boards know from the context: whether the answer is the notes, and whether the
/// target shows yet.
private struct KeyboardFretboardState {
  let fields: KeyboardFretboardFields
  let context: ActivityCanvasContext

  var isInteraction: Bool {
    if case .interaction = context.check { true } else { false }
  }

  var isChecked: Bool {
    if case .checked = context.phase { true } else { false }
  }

  /// A target found by ear shows once answered, even when the question only asked to name it.
  var showsAnswer: Bool {
    isChecked && (isInteraction || fields.isByEar)
  }

  var spell: (Int) -> String {
    KeyboardFretboard.spelling([fields.target, fields.start])
  }

  var initialPitches: [Int] {
    KeyboardFretboard.initialPitches(
      answer: context.answer, fields: fields, isInteraction: isInteraction, phase: context.phase)
  }
}

private struct PianoBoard: View {
  @State private var pressed: [Int]

  let fields: KeyboardFretboardFields
  let context: ActivityCanvasContext
  let audio: MusicAudio

  init(fields: KeyboardFretboardFields, context: ActivityCanvasContext, audio: MusicAudio) {
    self.fields = fields
    self.context = context
    self.audio = audio
    _pressed = State(
      initialValue: KeyboardFretboardState(fields: fields, context: context).initialPitches)
  }

  var body: some View {
    let state = KeyboardFretboardState(fields: fields, context: context)
    let spell = state.spell
    let shown = state.showsAnswer ? fields.target.pitches : pressed
    let marks =
      state.showsAnswer
      ? KeyboardFretboard.checkedMarks(
        expected: shown, pressed: state.isInteraction ? pressed : shown)
      : KeyboardFretboard.answeringMarks(pressed: pressed, start: fields.start?.pitches ?? [])

    KeyboardFretboardHeader(
      fields: fields, isRevealed: context.phase != .answering, notes: shown.map(spell),
      onPlayTarget: { audio.play(KeyboardFretboard.targetSound(fields.target), on: .piano) },
      onHear: {
        audio.play(
          MusicSound.together(
            shown.map { KeyboardFretboard.keyboardFrom + $0 }, gap: KeyboardFretboard.chordGap),
          on: .piano)
      })

    PianoKeyboard(
      from: KeyboardFretboard.keyboardFrom, to: KeyboardFretboard.keyboardTo,
      label: String(
        localized: "Piano keys", table: "ActivitiesMusic",
        comment: "VoiceOver name of the piano keyboard"),
      marks: marks, nameOf: { MusicLabels.display(spell($0)) },
      spokenNameOf: { MusicLabels.spoken(spell($0)) },
      isPressed: { pressed.contains($0 % MusicNotes.octave) },
      onPress: state.isChecked ? nil : { press($0) })

    if fields.showsGuitar {
      GuitarMirror(pitches: shown, spell: spell, isChecked: state.showsAnswer)
    }
  }

  private func press(_ midi: Int) {
    let pitch = midi % MusicNotes.octave
    let next = KeyboardFretboard.toggle(pressed, pitch)
    pressed = next

    if next.contains(pitch) {
      audio.play([MusicSound(at: 0, midi: midi)], on: .piano)
    } else {
      audio.stop()
    }

    if KeyboardFretboardState(fields: fields, context: context).isInteraction {
      context.setAnswer(next.isEmpty ? nil : .notes(KeyboardFretboard.notes(of: next)))
    }
  }
}

/// The guitar alone: pick one fret per string (or leave it muted) and hear the shape. The window
/// moves up the neck for shapes past the fourth fret.
private struct GuitarOnlyBoard: View {
  @State private var voicing: GuitarVoicing
  @State private var firstFret: Int

  let fields: KeyboardFretboardFields
  let context: ActivityCanvasContext
  let audio: MusicAudio

  init(fields: KeyboardFretboardFields, context: ActivityCanvasContext, audio: MusicAudio) {
    self.fields = fields
    self.context = context
    self.audio = audio

    let initial = KeyboardFretboardState(fields: fields, context: context).initialPitches
    let voicing = KeyboardFretboard.voicing(for: initial) ?? Guitar.unplayed
    _voicing = State(initialValue: voicing)
    _firstFret = State(initialValue: KeyboardFretboard.fretWindowStart(voicing))
  }

  var body: some View {
    let state = KeyboardFretboardState(fields: fields, context: context)
    let spell = state.spell
    let played = KeyboardFretboard.pitches(of: voicing)

    KeyboardFretboardHeader(
      fields: fields, isRevealed: context.phase != .answering, notes: played.map(spell),
      onPlayTarget: { audio.play(KeyboardFretboard.targetSound(fields.target), on: .guitar) },
      onHear: {
        audio.play(
          MusicSound.together(
            KeyboardFretboard.midis(of: voicing), gap: KeyboardFretboard.strumGap),
          on: .guitar)
      })

    GuitarFretboard(
      firstFret: firstFret, voicing: voicing, markOf: { markOf(string: $0, state: state) },
      nameOf: { MusicLabels.display(spell($0)) },
      onChange: state.isChecked ? nil : { change(string: $0, fret: $1) }
    )
    .accessibilityElement(children: .contain)
    .accessibilityLabel(
      Text(
        "Guitar strings", tableName: "ActivitiesMusic", comment: "VoiceOver name of the guitar neck"
      ))

    if !state.isChecked {
      HStack {
        Button {
          firstFret -= 1
        } label: {
          Label {
            Text(
              "Lower frets", tableName: "ActivitiesMusic",
              comment: "Moves the guitar neck's window toward the nut")
          } icon: {
            Image(systemName: "chevron.left")
          }
          .labelStyle(.iconOnly)
        }
        .disabled(firstFret <= 1)

        Spacer()

        Text(
          "Frets \(firstFret) to \(firstFret + Guitar.fretboardSpan - 1)",
          tableName: "ActivitiesMusic",
          comment: "Which frets of the guitar neck show, like “Frets 1 to 4”"
        )
        .font(.subheadline.monospacedDigit())
        .foregroundStyle(.secondary)

        Spacer()

        Button {
          firstFret += 1
        } label: {
          Label {
            Text(
              "Higher frets", tableName: "ActivitiesMusic",
              comment: "Moves the guitar neck's window up the neck")
          } icon: {
            Image(systemName: "chevron.right")
          }
          .labelStyle(.iconOnly)
        }
        .disabled(firstFret >= Guitar.highestWindow)
      }
      .buttonStyle(.bordered)
      .buttonBorderShape(.circle)
      .controlSize(.large)
    }

    if state.showsAnswer {
      GuitarMirror(
        pitches: fields.target.pitches, spell: spell, isChecked: true,
        caption: Text(
          "One way to play the answer", tableName: "ActivitiesMusic",
          comment: "Above a guitar shape that plays the right notes, after the check"))
    }
  }

  private func markOf(string: Int, state: KeyboardFretboardState) -> NoteMarkKind {
    guard state.showsAnswer, state.isInteraction, let fret = voicing[string] else {
      return .new
    }

    let pitch = Guitar.noteMidi(string: string, fret: fret) % MusicNotes.octave
    return fields.target.pitches.contains(pitch) ? .correct : .wrong
  }

  private func change(string: Int, fret: Int?) {
    var next = voicing
    next[string] = fret
    voicing = next

    if let fret {
      audio.play(
        [MusicSound(at: 0, midi: Guitar.noteMidi(string: string, fret: fret))], on: .guitar)
    }

    if KeyboardFretboardState(fields: fields, context: context).isInteraction {
      let midis = KeyboardFretboard.midis(of: next)
      context.setAnswer(midis.isEmpty ? nil : .notes(midis.map(MusicNotes.midiToNote)))
    }
  }
}

/// What the learner is looking for (the chord's name, or how many notes) and the notes on the
/// keys now, with a button to hear them. Found by ear, the target isn't named until it's
/// answered, and a button plays it.
private struct KeyboardFretboardHeader: View {
  let fields: KeyboardFretboardFields
  let isRevealed: Bool
  let notes: [String]
  let onPlayTarget: () -> Void
  let onHear: () -> Void

  var body: some View {
    ViewThatFits(in: .horizontal) {
      HStack(alignment: .top, spacing: 12) {
        titles
        Spacer(minLength: 0)
        buttons
      }

      VStack(alignment: .leading, spacing: 12) {
        titles
        HStack { buttons }
      }
    }
  }

  private var titles: some View {
    VStack(alignment: .leading, spacing: 2) {
      title
        .font(.headline)

      Text(notes.isEmpty ? noNotes : notes.map(MusicLabels.display).joined(separator: ", "))
        .font(.subheadline)
        .foregroundStyle(.secondary)
        .accessibilityLabel(
          notes.isEmpty
            ? Text(noNotes)
            : Text(
              "On the keys: \(notes.map(MusicLabels.spoken).joined(separator: ", "))",
              tableName: "ActivitiesMusic", comment: "VoiceOver: the notes the instrument plays now"
            ))
    }
    .fixedSize(horizontal: false, vertical: true)
  }

  @ViewBuilder
  private var buttons: some View {
    if fields.isByEar {
      MusicSoundButton(
        title: Text(
          "Play the sound", tableName: "ActivitiesMusic",
          comment: "Plays the chord or notes to find by ear"),
        action: onPlayTarget)
    }

    MusicSoundButton(
      title: Text("Hear it", tableName: "ActivitiesMusic", comment: "Plays the notes on the keys"),
      isDisabled: notes.isEmpty, action: onHear)
  }

  private var noNotes: String {
    String(
      localized: "No notes yet", table: "ActivitiesMusic",
      comment: "Nothing is pressed on the instrument")
  }

  private var title: Text {
    if fields.isByEar, !isRevealed {
      return Text(
        "By ear", tableName: "ActivitiesMusic",
        comment: "Title while the target is only heard, not named")
    }

    switch fields.target {
    case .chord(let root, let quality):
      return Text(MusicLabels.chord(root: root, quality: quality))
    case .notes(let notes):
      return Text(
        "\(notes.count) notes", tableName: "ActivitiesMusic",
        comment: "How many notes the target has, like “2 notes”")
    }
  }
}

/// The notes on the keys as a guitar shape a hand can play, so a learner sees one idea on both
/// instruments. It follows the keys; after the check it shows the answer.
private struct GuitarMirror: View {
  let pitches: [Int]
  let spell: (Int) -> String
  let isChecked: Bool
  var caption: Text?

  var body: some View {
    if !pitches.isEmpty {
      let voicing = KeyboardFretboard.voicing(for: pitches)

      VStack(alignment: .leading, spacing: 8) {
        Divider()

        (caption ?? defaultCaption)
          .font(.caption)
          .foregroundStyle(.secondary)

        if let voicing {
          GuitarFretboard(
            firstFret: KeyboardFretboard.fretWindowStart(voicing), voicing: voicing,
            markOf: { _ in isChecked ? .correct : .new },
            nameOf: { MusicLabels.display(spell($0)) })
        } else {
          Text(
            "These notes don't fit in one hand shape on the guitar.", tableName: "ActivitiesMusic",
            comment: "Under the piano when the pressed notes can't be played as one guitar shape"
          )
          .font(.subheadline)
          .foregroundStyle(.secondary)
        }
      }
    }
  }

  private var defaultCaption: Text {
    MusicNotes.nameChord(pitches) == nil
      ? Text(
        "Same notes on guitar", tableName: "ActivitiesMusic",
        comment: "Above a guitar shape that plays the notes on the keys")
      : Text(
        "Same chord on guitar", tableName: "ActivitiesMusic",
        comment: "Above a guitar shape that plays the chord on the keys")
  }
}
