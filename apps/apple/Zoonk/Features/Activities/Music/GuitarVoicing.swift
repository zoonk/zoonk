import Foundation

/// One fret per string, low E first; nil is a string that isn't played.
typealias GuitarVoicing = [Int?]

/// Mirrors main's `guitar-voicing.ts`.
enum Guitar {
  /// Open strings from the low E to the high E, as MIDI numbers (E2 A2 D3 G3 B3 E4).
  static let tuning = [40, 45, 50, 55, 59, 64]

  /// Frets shown at once: one hand's reach plus one.
  static let fretboardSpan = 4

  static let highestWindow = 12

  static let unplayed: GuitarVoicing = tuning.map { _ in nil }

  /// Frets a hand spans without moving.
  private static let handSpan = 4
  private static let maxFingers = 4
  private static let highestPosition = 10

  static func noteMidi(string: Int, fret: Int) -> Int {
    tuning[string] + fret
  }

  private static func pitch(string: Int, fret: Int) -> Int {
    noteMidi(string: string, fret: fret) % MusicNotes.octave
  }

  /// Fretted notes need fingers; the lowest fret can be barred when nothing open sits under it.
  static func fingersNeeded(_ voicing: GuitarVoicing) -> Int {
    let fretted = voicing.enumerated().compactMap { index, fret in
      fret.flatMap { $0 > 0 ? (fret: $0, index: index) : nil }
    }

    guard let lowest = fretted.map(\.fret).min() else {
      return 0
    }

    let barred = fretted.filter { $0.fret == lowest }
    let first = barred.first?.index ?? 0
    let last = barred.last?.index ?? 0
    let openUnderBarre = voicing[first...last].contains { $0 == 0 }
    let canBarre = barred.count > 1 && !openUnderBarre

    return canBarre ? fretted.count - barred.count + 1 : fretted.count
  }

  /// Strings that sound must be next to each other, so a strum reaches them all.
  private static func isContiguous(_ voicing: GuitarVoicing) -> Bool {
    let played = voicing.indices.filter { voicing[$0] != nil }

    guard let first = played.first, let last = played.last else {
      return true
    }

    return played.count == last - first + 1
  }

  private static func isPlayable(_ voicing: GuitarVoicing, bass: Int, pitchClasses: [Int]) -> Bool {
    let sounding = voicing.enumerated().compactMap { index, fret in
      fret.map { pitch(string: index, fret: $0) }
    }

    return sounding.first == bass && pitchClasses.allSatisfy { sounding.contains($0) }
      && isContiguous(voicing) && fingersNeeded(voicing) <= maxFingers
  }

  /// Lower is better: full and near the nut together (each string played is worth a fret of
  /// reach), then nearer the nut, then easier to finger.
  private static func cost(_ voicing: GuitarVoicing) -> [Int] {
    let frets = voicing.compactMap { $0 }
    let highest = max(0, frets.max() ?? 0)

    return [highest - frets.count, highest, fingersNeeded(voicing), frets.reduce(0, +)]
  }

  private static func isCheaper(_ first: [Int], than second: [Int]) -> Bool {
    guard let index = first.indices.first(where: { first[$0] != second[$0] }) else {
      return false
    }

    return first[index] < second[index]
  }

  private static func combinations(_ options: [[Int?]]) -> [GuitarVoicing] {
    options.reduce([[]]) { partials, choices in
      partials.flatMap { partial in choices.map { partial + [$0] } }
    }
  }

  private static func voicings(at position: Int, pitchClasses: [Int]) -> [GuitarVoicing] {
    var frets: [Int] = [0]

    for offset in 0..<handSpan where !frets.contains(position + offset) {
      frets.append(position + offset)
    }

    let options = tuning.indices.map { string in
      [nil] + frets.filter { pitchClasses.contains(pitch(string: string, fret: $0)) }
    }

    return combinations(options)
  }

  /// A playable shape for these pitch classes with `bass` as the lowest note (the chord's root,
  /// or the lowest key pressed), or nil when one hand can't reach them all.
  static func voicing(bass: Int, pitchClasses: [Int]) -> GuitarVoicing? {
    guard !pitchClasses.isEmpty, pitchClasses.count <= tuning.count else {
      return nil
    }

    var best: (voicing: GuitarVoicing, cost: [Int])?

    for position in 1...highestPosition {
      for voicing in voicings(at: position, pitchClasses: pitchClasses)
      where isPlayable(voicing, bass: bass, pitchClasses: pitchClasses) {
        let voicingCost = cost(voicing)

        if let current = best, !isCheaper(voicingCost, than: current.cost) {
          continue
        }

        best = (voicing, voicingCost)
      }
    }

    return best?.voicing
  }
}
