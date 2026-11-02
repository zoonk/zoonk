import Foundation

enum NoteTarget: Decodable, Hashable, Sendable {
  case chord(root: String, quality: ChordQuality)
  case notes([String])

  private enum CodingKeys: String, CodingKey {
    case kind, notes, quality, root
  }

  init(from decoder: any Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)

    if try container.decode(String.self, forKey: .kind) == "chord" {
      self = .chord(
        root: try container.decode(String.self, forKey: .root),
        quality: try container.decode(ChordQuality.self, forKey: .quality))
    } else {
      self = .notes(try container.decode([String].self, forKey: .notes))
    }
  }

  /// Its pitch classes, sorted, or none when a note isn't one.
  var pitches: [Int] {
    switch self {
    case .chord(let root, let quality):
      MusicNotes.chordPitchClasses(root: root, quality: quality) ?? []
    case .notes(let notes):
      MusicNotes.pitchClasses(of: notes) ?? []
    }
  }

  /// Its notes as written, without octaves: a chord spelled from its root (Eb in C minor).
  var spelling: [String] {
    switch self {
    case .chord(let root, let quality): MusicNotes.spellChord(root: root, quality: quality)
    case .notes(let notes): notes.map(MusicNotes.withoutOctave)
    }
  }
}

struct KeyboardFretboardFields: Decodable, Hashable, Sendable {
  /// The target sounds but isn't named or shown until the learner answers.
  let byEar: Bool?
  let instruments: [String]
  let start: NoteTarget?
  let target: NoteTarget

  var isByEar: Bool { byEar == true }
  var showsPiano: Bool { instruments.contains("piano") }
  var showsGuitar: Bool { instruments.contains("guitar") }
}

/// Mirrors main's `keyboard-fretboard-notes.ts`.
enum KeyboardFretboard {
  /// The keyboard shows one octave from middle C: every note has one key.
  static let keyboardFrom = 60
  static let keyboardTo = 71

  static let melodyGap = 0.7
  static let chordGap = 0.03
  static let strumGap = 0.04

  /// How each pitch class is spelled on screen: the way the target writes it (Eb in C minor),
  /// then the start, then the usual chord-root names.
  static func spelling(_ targets: [NoteTarget?]) -> @Sendable (Int) -> String {
    var spelled: [Int: String] = [:]

    for target in targets.reversed() {
      for name in target?.spelling ?? [] {
        if let pitch = MusicNotes.pitchClass(name) {
          spelled[pitch] = name
        }
      }
    }

    return { [spelled] pitch in
      spelled[MusicNotes.mod(pitch, MusicNotes.octave)] ?? MusicNotes.pitchClassName(pitch)
    }
  }

  static func toggle(_ pitches: [Int], _ pitch: Int) -> [Int] {
    pitches.contains(pitch) ? pitches.filter { $0 != pitch } : (pitches + [pitch]).sorted()
  }

  static func answeringMarks(pressed: [Int], start: [Int]) -> [Int: NoteMarkKind] {
    var marks: [Int: NoteMarkKind] = [:]

    for pitch in start where !pressed.contains(pitch) {
      marks[keyboardFrom + pitch] = .removed
    }

    for pitch in pressed {
      marks[keyboardFrom + pitch] = start.contains(pitch) ? .kept : .new
    }

    return marks
  }

  static func checkedMarks(expected: [Int], pressed: [Int]) -> [Int: NoteMarkKind] {
    var marks: [Int: NoteMarkKind] = [:]

    for pitch in expected where !pressed.contains(pitch) {
      marks[keyboardFrom + pitch] = .missed
    }

    for pitch in pressed {
      marks[keyboardFrom + pitch] = expected.contains(pitch) ? .correct : .wrong
    }

    return marks
  }

  /// The notes of an answer, one per pressed key, named the way core grades them.
  static func notes(of pitches: [Int]) -> [String] {
    pitches.map { MusicNotes.midiToNote(keyboardFrom + $0) }
  }

  /// The bass of a guitar shape: the chord's root when the notes form one, else the lowest note.
  private static func bass(of pitches: [Int]) -> Int {
    let root = MusicNotes.nameChord(pitches).flatMap { MusicNotes.pitchClass($0.root) }
    return root ?? pitches.first ?? 0
  }

  /// A guitar shape for the pressed notes, or nil when one hand can't play them.
  static func voicing(for pitches: [Int]) -> GuitarVoicing? {
    pitches.isEmpty ? nil : Guitar.voicing(bass: bass(of: pitches), pitchClasses: pitches)
  }

  static func pitches(of voicing: GuitarVoicing) -> [Int] {
    let pitches = voicing.enumerated().compactMap { string, fret in
      fret.map { Guitar.noteMidi(string: string, fret: $0) % MusicNotes.octave }
    }

    return Array(Set(pitches)).sorted()
  }

  static func midis(of voicing: GuitarVoicing) -> [Int] {
    voicing.enumerated().compactMap { string, fret in
      fret.map { Guitar.noteMidi(string: string, fret: $0) }
    }
  }

  /// The window of frets that shows a shape: from the nut unless the shape sits higher up.
  static func fretWindowStart(_ voicing: GuitarVoicing?, span: Int = Guitar.fretboardSpan) -> Int {
    let fretted = (voicing ?? []).compactMap { $0 }.filter { $0 > 0 }
    let highest = max(0, fretted.max() ?? 0)

    return highest <= span ? 1 : fretted.min() ?? 1
  }

  /// Where the notes start: the learner's answer when there is one, else the start chord, else
  /// (for a question about the target) the target itself to explore. A target found by ear stays
  /// hidden until it's explored or answered.
  static func initialPitches(
    answer: ActivityAnswer?, fields: KeyboardFretboardFields, isInteraction: Bool,
    phase: ActivityPhase
  ) -> [Int] {
    if let notes = answer?.notes, let answered = MusicNotes.pitchClasses(of: notes) {
      return answered
    }

    let showsTarget = fields.isByEar ? phase == .explore : !isInteraction
    return (fields.start ?? (showsTarget ? fields.target : nil))?.pitches ?? []
  }

  /// How a target sounds when it's found by ear: a chord struck together, and notes one after
  /// the other, each above the one before, so an interval is heard as a leap up.
  static func targetSound(_ target: NoteTarget) -> [MusicSound] {
    switch target {
    case .chord(let root, let quality):
      return MusicSound.together(MusicNotes.chordMidis(root: root, quality: quality), gap: chordGap)
    case .notes(let notes):
      var midis: [Int] = []

      for note in notes {
        let midi = MusicNotes.noteToMidi(note) ?? keyboardFrom

        if let previous = midis.last, midi <= previous {
          midis.append(midi + MusicNotes.octave)
        } else {
          midis.append(midi)
        }
      }

      return MusicSound.together(midis, gap: melodyGap)
    }
  }

  /// core's verdict (`pitchClasses` expected answer): the notes played, as pitch classes, are
  /// exactly the target's, in any octave.
  static func grade(_ content: ActivityStepContent, _ answer: ActivityAnswer) -> Bool {
    guard let fields = try? content.fields(as: KeyboardFretboardFields.self),
      answer.kind == "notes", let notes = answer.notes,
      let played = MusicNotes.pitchClasses(of: notes)
    else {
      return false
    }

    let expected = fields.target.pitches
    return !expected.isEmpty && played == expected
  }
}

enum NoteMarkKind: Hashable, Sendable {
  case correct, heard, kept, missed, new, removed, wrong
}

extension ActivityAnswer {
  /// A keyboard or fretboard answer: the notes played, as core grades them by pitch class.
  static func notes(_ notes: [String]) -> ActivityAnswer {
    ActivityAnswer(
      value: .object(["kind": .string("notes"), "notes": .array(notes.map(JSONValue.string))]))
  }

  var notes: [String]? {
    guard kind == "notes", case .array(let items) = value["notes"] else {
      return nil
    }

    return items.compactMap { if case .string(let text) = $0 { text } else { nil } }
  }
}
