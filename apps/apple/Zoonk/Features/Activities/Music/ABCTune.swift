import Foundation

/// Read the way abcjs reads it for main's notation player. Ornaments, grace notes, slurs, lyrics and
/// other voices are read past and left out.
struct ABCTune: Hashable, Sendable {
  enum Clef: Hashable, Sendable {
    case treble, bass
  }

  enum Meter: Hashable, Sendable {
    case none
    case common
    case cut
    case fraction(Int, Int)

    /// The meter as a fraction; a tune without one counts in 4/4, as abcjs does.
    var fraction: (num: Int, den: Int) {
      switch self {
      case .none, .common: (4, 4)
      case .cut: (2, 2)
      case .fraction(let num, let den): (num, den)
      }
    }

    /// The share of a whole note one beat lasts (abcjs's `getBeatLength`): a dotted quarter in
    /// 6/8, a quarter in 4/4.
    var beatLength: Double {
      let (num, den) = fraction
      let multiplier =
        [6, 9, 12].contains(num) || (num == 3 && den == 8)
        ? 3 : den == 8 && [5, 7].contains(num) ? 2 : 1

      return Double(multiplier) / Double(den)
    }
  }

  enum Accidental: Hashable, Sendable {
    case sharp, flat, natural, doubleSharp, doubleFlat

    var semitones: Int {
      switch self {
      case .sharp: 1
      case .flat: -1
      case .natural: 0
      case .doubleSharp: 2
      case .doubleFlat: -2
      }
    }
  }

  struct Pitch: Hashable, Sendable {
    /// Letters from C0: C4 (middle C) is 28, E4 is 30.
    let step: Int
    let midi: Int
    /// The accidental written before it; one from the key or an earlier note isn't drawn.
    let accidental: Accidental?
    /// Tied to the same note in the next chord or note, which rings on instead of being struck.
    var isTied = false
    /// Rings on from the previous note's tie: no new sound.
    var continuesTie = false
  }

  struct Element: Hashable, Sendable {
    /// The notes struck together (one for a single note), or none for a rest.
    var pitches: [Pitch]
    /// The length as drawn, in whole notes.
    var written: Double
    /// The length it lasts, in whole notes (a tuplet's notes are shorter than drawn).
    var sounding: Double
    var isInvisible = false
    /// A space before it: its beam doesn't join the previous note's.
    var breaksBeam = false
    var chordSymbol: String?
    /// The number over a tuplet, on its first note, with how many notes it spans.
    var tuplet: (number: Int, count: Int)?

    var isRest: Bool { pitches.isEmpty }

    var isTied: Bool { pitches.contains(where: \.isTied) }

    var continuesTie: Bool { !pitches.isEmpty && pitches.allSatisfy(\.continuesTie) }

    static func == (lhs: Element, rhs: Element) -> Bool {
      lhs.pitches == rhs.pitches && lhs.written == rhs.written && lhs.sounding == rhs.sounding
        && lhs.isInvisible == rhs.isInvisible && lhs.breaksBeam == rhs.breaksBeam
        && lhs.chordSymbol == rhs.chordSymbol && lhs.tuplet?.number == rhs.tuplet?.number
        && lhs.tuplet?.count == rhs.tuplet?.count
    }

    func hash(into hasher: inout Hasher) {
      hasher.combine(pitches)
      hasher.combine(written)
      hasher.combine(sounding)
      hasher.combine(chordSymbol)
    }
  }

  enum BarLine: Hashable, Sendable {
    case single, double, final, none
  }

  struct Bar: Hashable, Sendable {
    var elements: [Element] = []
    var startsRepeat = false
    var endsRepeat = false
    /// A first or second ending: played only on that pass through the repeat.
    var ending: Int?
    var end = BarLine.none
    /// A new key signature from this bar on (sharps positive, flats negative).
    var fifths: Int?
  }

  var title: String?
  var composer: String?
  var meter = Meter.none
  var clef = Clef.treble
  /// Sharps (positive) or flats (negative) in the key signature.
  var fifths = 0
  var bars: [Bar] = []

  /// The bars that hold anything, as drawn: a bar line at the very end leaves no empty bar.
  var hasMusic: Bool {
    bars.contains { !$0.elements.isEmpty }
  }
}

extension ABCTune {
  init(notation: String) {
    var reader = ABCReader()
    self = reader.read(notation)
  }

  /// Tempos to practice at: slower steps rounded to 5, then the melody's own tempo.
  static func practiceTempos(_ tempo: Int) -> [Int] {
    let slower = [0.6, 0.8].map { Int(Rhythm.jsRound(Double(tempo) * $0 / 5)) * 5 }
    return Array(Set(slower + [tempo])).sorted()
  }

  /// The order bars play in, repeats and endings followed: a repeat goes back to its `|:` (or
  /// to the first bar after the last repeat), a first ending plays the first time and a second
  /// ending the second.
  var playOrder: [Int] {
    var order: [Int] = []
    var index = 0
    var repeatStart = 0
    var repeatEnd = -1
    var repeated = Set<Int>()
    var pass = 1

    while index < bars.count {
      let bar = bars[index]

      if pass == 2, bar.ending == nil, index > repeatEnd {
        pass = 1
        repeatStart = index
      }

      if bar.startsRepeat, pass == 1 {
        repeatStart = index
      }

      if let ending = bar.ending, ending != pass {
        index += 1
        continue
      }

      order.append(index)

      if bar.endsRepeat, !repeated.contains(index) {
        repeated.insert(index)
        pass = 2
        repeatEnd = index
        index = repeatStart
        continue
      }

      index += 1
    }

    return order
  }

  var outline: [[Int]] {
    let lastWithNotes = bars.lastIndex { !$0.elements.isEmpty } ?? -1

    return bars.prefix(lastWithNotes + 1).map { bar in
      bar.elements.flatMap { $0.pitches.filter { !$0.continuesTie }.map(\.midi) }
    }
  }
}

enum NotationHeader {
  static func field(_ letter: Character, in notation: String) -> String? {
    for line in notation.split(separator: "\n", omittingEmptySubsequences: false) {
      let trimmed = line.trimmingCharacters(in: .whitespaces)

      if trimmed.count >= 2, trimmed.first == letter, trimmed.dropFirst().first == ":" {
        let value = trimmed.dropFirst(2).trimmingCharacters(in: .whitespaces)
        return value.isEmpty ? nil : value
      }
    }

    return nil
  }
}

private struct ABCReader {
  private var tune = ABCTune()
  private var unitLength: Double?
  private var keyAccidentals: [Character: Int] = [:]
  private var barAccidentals: [Int: Int] = [:]
  private var bar = ABCTune.Bar()
  private var pendingEnding: Int?
  private var breaksBeam = false
  private var chordSymbol: String?
  private var tuplet: (number: Int, count: Int, left: Int, factor: Double)?
  private var broken: Double?
  private var tiedMidis = Set<Int>()
  private var inBody = false
  private var voices = 0

  private static let letters = Array("CDEFGAB")
  private static let semitones = [0, 2, 4, 5, 7, 9, 11]

  mutating func read(_ notation: String) -> ABCTune {
    tune.title = NotationHeader.field("T", in: notation)
    tune.composer = NotationHeader.field("C", in: notation)

    for rawLine in notation.split(whereSeparator: \.isNewline) {
      let line =
        rawLine.split(separator: "%", maxSplits: 1, omittingEmptySubsequences: false).first
        .map(String.init) ?? ""

      if let (field, value) = Self.fieldLine(line) {
        readField(field, value)
      } else if inBody, voices <= 1 {
        readBody(Array(line))
        breaksBeam = true
      }
    }

    if !bar.elements.isEmpty || bar.startsRepeat {
      tune.bars.append(bar)
    }

    return tune
  }

  private static func fieldLine(_ line: String) -> (Character, String)? {
    let characters = Array(line)

    guard characters.count >= 2, characters[0].isLetter, characters[1] == ":" else {
      return nil
    }

    return (characters[0], String(characters.dropFirst(2)).trimmingCharacters(in: .whitespaces))
  }

  /// Whether notes were read yet: later key and meter fields change only what follows.
  private var hasMusic: Bool {
    !tune.bars.isEmpty || !bar.elements.isEmpty
  }

  private mutating func readField(_ field: Character, _ value: String) {
    switch field {
    case "M" where !hasMusic:
      // The tune keeps its first meter: its beat sets the tempo of the whole melody.
      tune.meter = Self.meter(value)
    case "L":
      unitLength = Self.fraction(value)
    case "K":
      readKey(value)
      inBody = true
    case "V":
      voices += 1
    default:
      break
    }
  }

  private static func meter(_ value: String) -> ABCTune.Meter {
    switch value.trimmingCharacters(in: .whitespaces) {
    case "C": return .common
    case "C|": return .cut
    case "", "none": return .none
    default:
      let parts = value.split(separator: "/").compactMap {
        Int($0.trimmingCharacters(in: .whitespaces))
      }
      return parts.count == 2 && parts[1] > 0 ? .fraction(parts[0], parts[1]) : .none
    }
  }

  private static func fraction(_ value: String) -> Double? {
    let parts = value.split(separator: "/").compactMap {
      Double($0.trimmingCharacters(in: .whitespaces))
    }
    return parts.count == 2 && parts[1] > 0 ? parts[0] / parts[1] : nil
  }

  /// The unit note length: L: when given, else an eighth (a sixteenth in meters under 3/4).
  private var unit: Double {
    if let unitLength {
      return unitLength
    }

    if case .fraction(let num, let den) = tune.meter, Double(num) / Double(den) < 0.75 {
      return 1.0 / 16
    }

    return 1.0 / 8
  }

  private mutating func readKey(_ value: String) {
    let words = value.split(separator: " ").map(String.init)
    var fifths = 0
    var extras: [Character: Int] = [:]
    var rest = words[...]

    if let first = words.first, let tonic = first.first, Self.letters.contains(tonic) {
      rest = words.dropFirst()
      let base = ["C": 0, "G": 1, "D": 2, "A": 3, "E": 4, "B": 5, "F": -1][String(tonic)] ?? 0
      var mode = first.dropFirst()
      var shift = 0

      if mode.first == "#" {
        shift = 7
        mode = mode.dropFirst()
      } else if mode.first == "b" {
        shift = -7
        mode = mode.dropFirst()
      }

      var modeName = mode.lowercased()

      if modeName.isEmpty, let next = rest.first, next.first?.isLetter == true, !next.contains("=")
      {
        let word = next.lowercased()

        if ["maj", "min", "ion", "dor", "phr", "lyd", "mix", "aeo", "loc", "m"].contains(where: {
          word.hasPrefix($0)
        }) {
          modeName = word
          rest = rest.dropFirst()
        }
      }

      fifths = base + shift + Self.modeShift(modeName)
    }

    for word in rest {
      let lowered = word.lowercased()

      if lowered == "bass" || lowered.hasPrefix("clef=bass") {
        tune.clef = hasMusic ? tune.clef : .bass
      } else if lowered == "treble" || lowered.hasPrefix("clef=treble") {
        tune.clef = hasMusic ? tune.clef : .treble
      } else if let accidental = Self.explicitAccidental(word) {
        extras[accidental.letter] = accidental.semitones
      }
    }

    let signature = min(max(fifths, -7), 7)

    if hasMusic {
      bar.fifths = signature
    } else {
      tune.fifths = signature
    }

    keyAccidentals = [:]

    for letter in Array("FCGDAEB").prefix(max(signature, 0)) {
      keyAccidentals[letter] = 1
    }

    for letter in Array("BEADGCF").prefix(max(-signature, 0)) {
      keyAccidentals[letter] = -1
    }

    keyAccidentals.merge(extras) { _, extra in extra }
  }

  private static func modeShift(_ mode: String) -> Int {
    let prefixes: [(String, Int)] = [
      ("maj", 0), ("ion", 0), ("min", -3), ("aeo", -3), ("dor", -2), ("phr", -4), ("lyd", 1),
      ("mix", -1), ("loc", -5), ("m", -3),
    ]

    return prefixes.first { mode.hasPrefix($0.0) }?.1 ?? 0
  }

  private static func explicitAccidental(_ word: String) -> (letter: Character, semitones: Int)? {
    let characters = Array(word)

    guard characters.count == 2, let letter = characters[1].uppercased().first,
      Self.letters.contains(letter)
    else {
      return nil
    }

    switch characters[0] {
    case "^": return (letter, 1)
    case "_": return (letter, -1)
    case "=": return (letter, 0)
    default: return nil
    }
  }

  private mutating func readBody(_ characters: [Character]) {
    var index = 0

    while index < characters.count {
      let character = characters[index]

      switch character {
      case " ", "\t":
        breaksBeam = true
        index += 1
      case "|", ":":
        index = readBarLine(characters, from: index)
      case "[":
        index = readBracket(characters, from: index)
      case "\"":
        index = readQuoted(characters, from: index)
      case "!", "+":
        index = skip(characters, from: index + 1, until: character)
      case "{":
        index = skip(characters, from: index + 1, until: "}")
      case "(":
        index = readTuplet(characters, from: index)
      case "-":
        if let last = bar.elements.indices.last {
          for pitch in bar.elements[last].pitches.indices {
            bar.elements[last].pitches[pitch].isTied = true
          }

          tiedMidis = Set(bar.elements[last].pitches.map(\.midi))
        }

        index += 1
      case ">", "<":
        index = readBroken(characters, from: index)
      case "z", "x", "Z", "X":
        index = readRest(characters, from: index)
      case "^", "_", "=", "A"..."G", "a"..."g":
        index = readNoteElement(characters, from: index)
      default:
        // Slur ends, decorations (. ~ H L M O P S T u v), spacers and line continuations.
        index += 1
      }
    }
  }

  private func skip(_ characters: [Character], from start: Int, until end: Character) -> Int {
    var index = start

    while index < characters.count, characters[index] != end {
      index += 1
    }

    return index + 1
  }

  private mutating func readQuoted(_ characters: [Character], from start: Int) -> Int {
    let end = skip(characters, from: start + 1, until: "\"")
    let text = String(characters[(start + 1)..<min(end - 1, characters.count)])

    if let first = text.first, !"^_<>@".contains(first) {
      chordSymbol = text
    }

    return end
  }

  private mutating func readTuplet(_ characters: [Character], from start: Int) -> Int {
    var index = start + 1
    var numbers: [Int?] = []

    while numbers.count < 3 {
      var digits = ""

      while index < characters.count, characters[index].isNumber {
        digits.append(characters[index])
        index += 1
      }

      if digits.isEmpty, numbers.isEmpty {
        return start + 1  // A slur.
      }

      numbers.append(Int(digits))

      guard index < characters.count, characters[index] == ":" else {
        break
      }

      index += 1
    }

    guard let notes = numbers.first ?? nil, notes > 1,
      (numbers.dropFirst().compactMap { $0 }).allSatisfy({ $0 > 0 })
    else {
      return index
    }

    let compound: Bool = {
      if case .fraction(let num, _) = tune.meter { return num % 3 == 0 && num > 3 }
      return false
    }()
    let defaultTime = [2: 3, 3: 2, 4: 3, 6: 2, 8: 3][notes] ?? (compound ? 3 : 2)
    let time = (numbers.count > 1 ? numbers[1] : nil) ?? defaultTime
    let count = (numbers.count > 2 ? numbers[2] : nil) ?? notes

    tuplet = (notes, count, count, Double(time) / Double(notes))
    return index
  }

  private mutating func readBroken(_ characters: [Character], from start: Int) -> Int {
    var index = start
    let symbol = characters[start]

    while index < characters.count, characters[index] == symbol {
      index += 1
    }

    let dots = index - start
    let short = pow(0.5, Double(dots))
    let long = 2 - short

    if !bar.elements.isEmpty {
      let last = bar.elements.count - 1
      let factor = symbol == ">" ? long : short
      bar.elements[last].written *= factor
      bar.elements[last].sounding *= factor
    }

    broken = symbol == ">" ? short : long
    return index
  }

  /// A bar line (`|`, `||`, `|]`, `[|`, `|:`, `:|`, `::`), maybe with an ending number after it.
  private mutating func readBarLine(_ characters: [Character], from start: Int) -> Int {
    var index = start
    var symbol = ""

    while index < characters.count, "|:[]".contains(characters[index]) {
      if characters[index] == "[", index + 1 < characters.count,
        !"|".contains(characters[index + 1]), !characters[index + 1].isNumber
      {
        break
      }

      symbol.append(characters[index])
      index += 1
    }

    var ending: Int?

    if index < characters.count, let digit = characters[index].wholeNumberValue {
      ending = digit
      index += 1
    }

    guard symbol.contains("|") || symbol == "::" else {
      return max(index, start + 1)
    }

    let endsRepeat = symbol.hasPrefix(":") || symbol == "::"
    let startsRepeat = symbol.hasSuffix(":") || symbol == "::"
    var line = ABCTune.BarLine.single

    if symbol.contains("||") {
      line = .double
    } else if symbol.contains("|]") || symbol.contains("[|") {
      line = .final
    }

    finishBar(line: line, endsRepeat: endsRepeat)
    bar.startsRepeat = startsRepeat

    if let ending {
      pendingEnding = ending
      bar.ending = ending
    }

    return index
  }

  private mutating func finishBar(line: ABCTune.BarLine, endsRepeat: Bool) {
    if !bar.elements.isEmpty {
      bar.end = line
      bar.endsRepeat = endsRepeat
      tune.bars.append(bar)
    } else if let last = tune.bars.indices.last {
      // A bar line right after another only restyles it, like `| |]`.
      tune.bars[last].end = line
      tune.bars[last].endsRepeat = tune.bars[last].endsRepeat || endsRepeat
    }

    // A first ending runs on until its repeat; any other ending is one bar long.
    let continuesEnding = pendingEnding == 1 && !endsRepeat && line == .single ? pendingEnding : nil
    bar = ABCTune.Bar()
    bar.ending = continuesEnding
    pendingEnding = continuesEnding
    barAccidentals = [:]
    breaksBeam = true
  }

  /// `[` opens a chord, an inline field (`[K:G]`) or an ending (`[1`).
  private mutating func readBracket(_ characters: [Character], from start: Int) -> Int {
    let next = start + 1 < characters.count ? characters[start + 1] : " "

    if next.isNumber {
      pendingEnding = next.wholeNumberValue
      bar.ending = pendingEnding
      return start + 2
    }

    if next == "|" {
      return readBarLine(characters, from: start)
    }

    if next.isLetter, start + 2 < characters.count, characters[start + 2] == ":" {
      let end = skip(characters, from: start, until: "]")
      let value = String(characters[(start + 3)..<max(start + 3, end - 1)])
      readField(next, value.trimmingCharacters(in: .whitespaces))
      return end
    }

    var index = start + 1
    var pitches: [ABCTune.Pitch] = []
    var firstLength: Double?

    while index < characters.count, characters[index] != "]" {
      if let (parsed, length, end) = readPitch(characters, from: index) {
        var pitch = parsed
        index = end

        if index < characters.count, characters[index] == "-" {
          pitch.isTied = true
          index += 1
        }

        pitches.append(pitch)
        firstLength = firstLength ?? length
      } else {
        index += 1
      }
    }

    index += 1
    let (multiplier, end) = Self.length(characters, from: index)
    addElement(pitches: pitches, length: (firstLength ?? 1) * multiplier)
    return end
  }

  private mutating func readRest(_ characters: [Character], from start: Int) -> Int {
    let symbol = characters[start]
    let (multiplier, end) = Self.length(characters, from: start + 1)
    let barLength = Double(tune.meter.fraction.num) / Double(tune.meter.fraction.den)
    let length = symbol == "Z" || symbol == "X" ? barLength / unit * multiplier : multiplier

    addElement(pitches: [], length: length, isInvisible: symbol == "x" || symbol == "X")
    return end
  }

  private mutating func readNoteElement(_ characters: [Character], from start: Int) -> Int {
    guard let (pitch, length, end) = readPitch(characters, from: start) else {
      return start + 1
    }

    addElement(pitches: [pitch], length: length)
    return end
  }

  /// A note with its accidental, octave marks and length: `^f'3/2`.
  private mutating func readPitch(_ characters: [Character], from start: Int) -> (
    ABCTune.Pitch, Double, Int
  )? {
    var index = start
    var written: ABCTune.Accidental?

    let accidentals: [(String, ABCTune.Accidental)] = [
      ("^^", .doubleSharp), ("__", .doubleFlat), ("^", .sharp), ("_", .flat), ("=", .natural),
    ]

    for (symbol, accidental) in accidentals
    where characters[index...].starts(with: Array(symbol)) {
      written = accidental
      index += symbol.count
      break
    }

    guard index < characters.count, let upper = characters[index].uppercased().first,
      let letter = Self.letters.firstIndex(of: upper)
    else {
      return nil
    }

    var octave = characters[index].isLowercase ? 5 : 4
    index += 1

    while index < characters.count, characters[index] == "'" || characters[index] == "," {
      octave += characters[index] == "'" ? 1 : -1
      index += 1
    }

    let step = octave * 7 + letter

    if let written {
      barAccidentals[step] = written.semitones
    }

    let shift = barAccidentals[step] ?? keyAccidentals[upper] ?? 0
    let midi = (octave + 1) * 12 + Self.semitones[letter] + shift
    let (length, end) = Self.length(characters, from: index)

    return (ABCTune.Pitch(step: step, midi: midi, accidental: written), length, end)
  }

  /// A length after a note: `2`, `/2`, `/`, `3/2`, `//`, as a multiple of the unit.
  private static func length(_ characters: [Character], from start: Int) -> (Double, Int) {
    var index = start
    var digits = ""

    while index < characters.count, characters[index].isNumber {
      digits.append(characters[index])
      index += 1
    }

    var value = Double(digits) ?? 1

    while index < characters.count, characters[index] == "/" {
      index += 1
      var divisor = ""

      while index < characters.count, characters[index].isNumber {
        divisor.append(characters[index])
        index += 1
      }

      // A zero (`C/0`) isn't a length: it's read past.
      value /= divisor.isEmpty ? 2 : Double(divisor).flatMap { $0 > 0 ? $0 : nil } ?? 1
    }

    return (value, index)
  }

  private mutating func addElement(
    pitches: [ABCTune.Pitch], length: Double, isInvisible: Bool = false
  ) {
    var written = length * unit

    if let factor = broken {
      written *= factor
      broken = nil
    }

    var sounding = written
    var tupletMark: (number: Int, count: Int)?

    if let current = tuplet {
      sounding *= current.factor

      if current.left == current.count {
        tupletMark = (current.number, current.count)
      }

      tuplet =
        current.left > 1 ? (current.number, current.count, current.left - 1, current.factor) : nil
    }

    var tied = pitches

    for index in tied.indices where tiedMidis.contains(tied[index].midi) {
      tied[index].continuesTie = true
    }

    // A chord's own ties (`[C-EG]`) carry to the next note; a tie after it is read later.
    tiedMidis = Set(tied.filter(\.isTied).map(\.midi))

    bar.elements.append(
      ABCTune.Element(
        pitches: tied, written: written, sounding: sounding, isInvisible: isInvisible,
        breaksBeam: breaksBeam, chordSymbol: chordSymbol, tuplet: tupletMark))
    breaksBeam = false
    chordSymbol = nil
  }
}
