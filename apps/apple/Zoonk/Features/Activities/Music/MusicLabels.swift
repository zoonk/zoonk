import Foundation

/// Note names as the learner reads them (E♭, or H in German) and as VoiceOver says them ("E
/// flat"), chord names, and what a guitar's strings and frets are called (main's
/// `use-music-labels.ts` and `use-fretboard-labels.ts`). Names come in with "#" and "b" and an
/// optional octave, like "Eb4".
enum MusicLabels {
  private static var languageCode: String {
    Bundle.main.preferredLocalizations.first ?? "en"
  }

  static func display(_ name: String) -> String {
    MusicNotes.displayName(MusicNotes.withoutOctave(name), languageCode: languageCode)
  }

  static func spoken(_ name: String) -> String {
    let shown = display(name)
    let letter = String(shown.prefix(1))

    if shown.contains("♯") {
      return String(
        localized: "\(letter) sharp", table: "ActivitiesMusic",
        comment: "A note name read aloud, like “F sharp”")
    }

    if shown.contains("♭") {
      return String(
        localized: "\(letter) flat", table: "ActivitiesMusic",
        comment: "A note name read aloud, like “E flat”")
    }

    return letter
  }

  /// Notes read aloud one after another, or "none".
  static func spokenList(_ names: [String]) -> String {
    names.isEmpty
      ? String(localized: "none", table: "ActivitiesMusic", comment: "No notes are on the keys")
      : names.map(spoken).formatted(.list(type: .and, width: .narrow))
  }

  /// A chord's full name, like "C minor", with the root shown as the learner reads notes.
  static func chord(root: String, quality: ChordQuality) -> String {
    let note = display(root)

    return switch quality {
    case .augmented:
      String(
        localized: "\(note) augmented", table: "ActivitiesMusic",
        comment: "A chord's name: its root note, then augmented")
    case .diminished:
      String(
        localized: "\(note) diminished", table: "ActivitiesMusic",
        comment: "A chord's name: its root note, then diminished")
    case .dominant7:
      String(
        localized: "\(note) dominant seventh", table: "ActivitiesMusic",
        comment: "A chord's name: its root note, then dominant seventh")
    case .major:
      String(
        localized: "\(note) major", table: "ActivitiesMusic",
        comment: "A chord's name: its root note, then major")
    case .major7:
      String(
        localized: "\(note) major seventh", table: "ActivitiesMusic",
        comment: "A chord's name: its root note, then major seventh")
    case .minor:
      String(
        localized: "\(note) minor", table: "ActivitiesMusic",
        comment: "A chord's name: its root note, then minor")
    case .minor7:
      String(
        localized: "\(note) minor seventh", table: "ActivitiesMusic",
        comment: "A chord's name: its root note, then minor seventh")
    }
  }

  /// The short names on the left of a guitar neck: E A D G B E.
  static let stringNames = ["E", "A", "D", "G", "B", "E"]

  /// A string's name for VoiceOver: "Low E string", "A string", "High E string".
  static func string(_ index: Int) -> String {
    if index == 0 {
      return String(
        localized: "Low E string", table: "ActivitiesMusic",
        comment: "The thickest guitar string, read aloud")
    }

    if index == Guitar.tuning.count - 1 {
      return String(
        localized: "High E string", table: "ActivitiesMusic",
        comment: "The thinnest guitar string, read aloud")
    }

    let note = spoken(stringNames[index])
    return String(
      localized: "\(note) string", table: "ActivitiesMusic",
      comment: "A guitar string named by its open note, like “A string”")
  }

  /// A place on a string for VoiceOver: "Not played", "Open, E" or "Fret 3, G".
  static func position(fret: Int?, midi: Int?) -> String {
    guard let fret, let midi else {
      return String(
        localized: "Not played", table: "ActivitiesMusic",
        comment: "A guitar string left silent (muted)")
    }

    let note = spoken(MusicNotes.midiToNote(midi))

    return fret == 0
      ? String(
        localized: "Open, \(note)", table: "ActivitiesMusic",
        comment: "A guitar string played open, with the note it sounds")
      : String(
        localized: "Fret \(fret), \(note)", table: "ActivitiesMusic",
        comment: "A fret on a guitar string, with the note it sounds")
  }
}
