import Foundation

/// Notes, chords and their names, as core's `library/activities/templates/_utils/music.ts` grades
/// them and main's player (`music-notes.ts`) draws them: a note is a letter with "#" or "b" and an
/// optional octave ("C", "Eb", "F#4"), a pitch class is 0 for C up to 11 for B, and MIDI 60 is
/// middle C.
enum MusicNotes {
  static let octave = 12

  /// Note letters placed on the 12 semitones of an octave from C; "_" marks the black keys.
  private static let chromaticLetters = Array("C_D_EF_G_A_B")
  private static let letters = Array("CDEFGAB")

  /// How the keys are named in an answer: sharps, which core's pitch-class grading accepts.
  private static let sharpNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

  /// Chord roots the way musicians usually write them: Eb and Bb, but F#.
  private static let rootNames = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]

  /// Chords stack thirds, so each tone above the root is two more letters up (C, E, G, B).
  private static let lettersPerThird = 2
  private static let maxAccidental = 2
  private static let accidentals = [-2: "bb", -1: "b", 0: "", 1: "#", 2: "##"]

  static func mod(_ value: Int, _ by: Int) -> Int {
    ((value % by) + by) % by
  }

  /// Whether `note` is a note core takes: `^[A-G](?:#|b)?[0-8]?$`.
  static func isNote(_ note: String) -> Bool {
    var characters = Array(note)

    guard let letter = characters.first, letters.contains(letter) else {
      return false
    }

    characters.removeFirst()

    if let sign = characters.first, sign == "#" || sign == "b" {
      characters.removeFirst()
    }

    if let digit = characters.first, ("0"..."8").contains(digit) {
      characters.removeFirst()
    }

    return characters.isEmpty
  }

  /// The note's pitch class, 0 for C up to 11 for B, or nil when it isn't a note.
  static func pitchClass(_ note: String) -> Int? {
    guard isNote(note), let letter = note.first,
      let base = chromaticLetters.firstIndex(of: letter)
    else {
      return nil
    }

    return mod(base + accidentalShift(note), octave)
  }

  private static func accidentalShift(_ note: String) -> Int {
    switch note.dropFirst().first {
    case "#": 1
    case "b": -1
    default: 0
    }
  }

  /// The pitch classes of `notes`, sorted and once each, or nil when one isn't a note.
  static func pitchClasses(of notes: [String]) -> [Int]? {
    var classes: [Int] = []

    for note in notes {
      guard let pitch = pitchClass(note) else {
        return nil
      }

      classes.append(pitch)
    }

    return Array(Set(classes)).sorted()
  }

  static func chordPitchClasses(root: String, quality: ChordQuality) -> [Int]? {
    guard let rootClass = pitchClass(root) else {
      return nil
    }

    let above = quality.intervals.map { mod(rootClass + $0.semitones, octave) }
    return Array(Set([rootClass] + above)).sorted()
  }

  /// The note's name with the octave, like "C#4", from its MIDI number (60 is middle C).
  static func midiToNote(_ midi: Int) -> String {
    let octaveNumber = Int((Double(midi) / Double(octave)).rounded(.down)) - 1
    return "\(sharpNames[mod(midi, octave)])\(octaveNumber)"
  }

  /// A note's MIDI number; notes written without an octave sit in `defaultOctave`. Cb and B#
  /// cross the octave line: Cb4 sits just below C4.
  static func noteToMidi(_ note: String, defaultOctave: Int = 4) -> Int? {
    guard pitchClass(note) != nil, let letter = note.first,
      let letterPitch = chromaticLetters.firstIndex(of: letter)
    else {
      return nil
    }

    let written = note.last.flatMap { $0.wholeNumberValue }
    return ((written ?? defaultOctave) + 1) * octave + letterPitch + accidentalShift(note)
  }

  /// A pitch class named as a chord root would be: Eb rather than D#.
  static func pitchClassName(_ pitch: Int) -> String {
    rootNames[mod(pitch, octave)]
  }

  /// The root without its octave, as written: "Eb4" is "Eb".
  static func withoutOctave(_ note: String) -> String {
    note.last?.isNumber == true ? String(note.dropLast()) : note
  }

  /// The note `letterSteps` letters and `distance` semitones above `root`, spelled from the
  /// letter, so a minor third above C is Eb, never D#.
  private static func spellAbove(root: String, distance: Int, letterSteps: Int) -> String {
    let rootPitch = pitchClass(root) ?? 0
    let rootLetter = root.first.flatMap { letters.firstIndex(of: $0) } ?? 0
    let letter = letters[mod(rootLetter + letterSteps, letters.count)]
    let natural = pitchClass(String(letter)) ?? 0
    let offset = mod(rootPitch + distance - natural + maxAccidental, octave) - maxAccidental

    return "\(letter)\(accidentals[offset] ?? "")"
  }

  /// A chord's notes spelled from its root: C minor is C, Eb, G.
  static func spellChord(root: String, quality: ChordQuality) -> [String] {
    let name = withoutOctave(root)

    return [name]
      + quality.intervals.enumerated().map { index, interval in
        spellAbove(
          root: name, distance: interval.semitones, letterSteps: (index + 1) * lettersPerThird)
      }
  }

  /// A chord voiced upward from its root, as MIDI numbers: C4 minor is 60, 63, 67.
  static func chordMidis(root: String, quality: ChordQuality) -> [Int] {
    let base = noteToMidi(root) ?? 0
    return [base] + quality.intervals.map { base + $0.semitones }
  }

  /// The chord a set of pitch classes forms, if any, like C minor.
  static func nameChord(_ pitchClasses: [Int]) -> (root: String, quality: ChordQuality)? {
    let target = Array(Set(pitchClasses)).sorted()

    for root in rootNames {
      for quality in ChordQuality.allCases
      where chordPitchClasses(root: root, quality: quality) == target {
        return (root, quality)
      }
    }

    return nil
  }

  /// Whether a pitch class is a black key on the piano (its plain name needs a sharp).
  static func isBlackKey(_ pitch: Int) -> Bool {
    sharpNames[mod(pitch, octave)].count > 1
  }

  /// A note name for display, with real sharp and flat signs, in the learner's convention:
  /// German readers see B natural as "H" and B flat as "B".
  static func displayName(_ name: String, languageCode: String) -> String {
    var local = name

    if languageCode.hasPrefix("de"), name.hasPrefix("B") {
      local = name.hasPrefix("Bb") ? "B" + name.dropFirst(2) : "H" + name.dropFirst()
    }

    let rest = local.dropFirst()
    let accidental = rest.prefix { $0 == "#" || $0 == "b" }.prefix(maxAccidental)
    let signs = accidental.map { $0 == "#" ? "♯" : "♭" }.joined()

    return "\(local.prefix(1))\(signs)\(rest.dropFirst(accidental.count))"
  }
}

/// A chord's quality, in core's order (`CHORD_QUALITIES`), which decides the name a set of notes
/// gets first.
enum ChordQuality: String, CaseIterable, Codable, Hashable, Sendable {
  case augmented, diminished, dominant7, major, major7, minor, minor7

  /// The notes above the root, as intervals from it, lowest first.
  var intervals: [MusicInterval] {
    switch self {
    case .augmented: [.majorThird, .minorSixth]
    case .diminished: [.minorThird, .tritone]
    case .dominant7: [.majorThird, .perfectFifth, .minorSeventh]
    case .major: [.majorThird, .perfectFifth]
    case .major7: [.majorThird, .perfectFifth, .majorSeventh]
    case .minor: [.minorThird, .perfectFifth]
    case .minor7: [.minorThird, .perfectFifth, .minorSeventh]
    }
  }
}

/// Intervals one semitone apart, from a minor second to the octave.
enum MusicInterval: Int {
  case minorSecond = 1
  case majorSecond, minorThird, majorThird, perfectFourth, tritone, perfectFifth
  case minorSixth, majorSixth, minorSeventh, majorSeventh, octave

  var semitones: Int { rawValue }
}
