import AVFoundation
import XCTest

@testable import Zoonk

/// The music templates' rules, on the cases main's tests check (`music-notes.test.ts`,
/// `guitar-voicing.test.ts`, `keyboard-fretboard-notes.test.ts`, `rhythm-results.test.ts`,
/// `notation-text.test.ts`, core's `music.test.ts`) and the fixtures its browser tests play
/// (`@zoonk/testing/fixtures/activity-contents`): each grade must agree with core's
/// `checkActivityAnswer`.
final class MusicActivitiesTests: XCTestCase {
  // MARK: - Notes and chords

  func testConvertsBetweenNamesAndMidiAroundMiddleC() {
    XCTAssertEqual(MusicNotes.noteToMidi("C4"), 60)
    XCTAssertEqual(MusicNotes.noteToMidi("Eb"), 63)
    XCTAssertEqual(MusicNotes.noteToMidi("F#3"), 54)
    XCTAssertEqual(MusicNotes.noteToMidi("Cb4"), 59)
    XCTAssertNil(MusicNotes.noteToMidi("H"))
    XCTAssertEqual(MusicNotes.midiToNote(61), "C#4")
    XCTAssertEqual(MusicNotes.midiToNote(48), "C3")
  }

  func testReadsPitchClassesAsCoreDoes() {
    XCTAssertEqual(MusicNotes.pitchClass("Cb"), 11)
    XCTAssertEqual(MusicNotes.pitchClass("B#"), 0)
    XCTAssertNil(MusicNotes.pitchClass("E#9"))
    XCTAssertNil(MusicNotes.pitchClass("c"))
    XCTAssertEqual(MusicNotes.pitchClasses(of: ["G3", "C4", "G"]), [0, 7])
    XCTAssertNil(MusicNotes.pitchClasses(of: ["C", "X"]))
  }

  func testVoicesChordsUpwardFromTheRoot() {
    XCTAssertEqual(MusicNotes.chordMidis(root: "C", quality: .minor), [60, 63, 67])
    XCTAssertEqual(MusicNotes.chordMidis(root: "G3", quality: .dominant7), [55, 59, 62, 65])
  }

  func testSpellsChordTonesFromTheRootsLetter() {
    XCTAssertEqual(MusicNotes.spellChord(root: "C", quality: .minor), ["C", "Eb", "G"])
    XCTAssertEqual(MusicNotes.spellChord(root: "F#", quality: .major), ["F#", "A#", "C#"])
    XCTAssertEqual(MusicNotes.spellChord(root: "Bb", quality: .dominant7), ["Bb", "D", "F", "Ab"])
    XCTAssertEqual(MusicNotes.spellChord(root: "C", quality: .augmented), ["C", "E", "G#"])
    XCTAssertEqual(MusicNotes.spellChord(root: "B", quality: .diminished), ["B", "D", "F"])
  }

  func testNamesTheChordASetOfPitchClassesForms() {
    XCTAssertEqual(MusicNotes.nameChord([0, 3, 7])?.root, "C")
    XCTAssertEqual(MusicNotes.nameChord([0, 3, 7])?.quality, .minor)
    XCTAssertEqual(MusicNotes.nameChord([7, 11, 2, 5])?.root, "G")
    XCTAssertEqual(MusicNotes.nameChord([7, 11, 2, 5])?.quality, .dominant7)
    XCTAssertNil(MusicNotes.nameChord([0, 2, 4]))
  }

  func testShowsNotesWithRealAccidentalsAndGermanBAndH() {
    XCTAssertEqual(MusicNotes.displayName("Eb", languageCode: "en"), "E♭")
    XCTAssertEqual(MusicNotes.displayName("F#4", languageCode: "pt"), "F♯4")
    XCTAssertEqual(MusicNotes.displayName("B", languageCode: "de"), "H")
    XCTAssertEqual(MusicNotes.displayName("Bb", languageCode: "de"), "B")
    XCTAssertEqual(MusicNotes.displayName("Bb", languageCode: "en"), "B♭")
  }

  // MARK: - Guitar

  private func voicing(_ pitches: [Int], bass: Int? = nil) -> GuitarVoicing? {
    Guitar.voicing(bass: bass ?? pitches.first ?? 0, pitchClasses: pitches)
  }

  func testFindsTheOpenShapesGuitaristsLearnFirst() {
    XCTAssertEqual(voicing([0, 4, 7]), [nil, 3, 2, 0, 1, 0])
    XCTAssertEqual(voicing([7, 11, 2]), [3, 2, 0, 0, 0, 3])
    XCTAssertEqual(voicing([2, 6, 9]), [nil, nil, 0, 2, 3, 2])
    XCTAssertEqual(voicing([9, 0, 4]), [nil, 0, 2, 2, 1, 0])
    XCTAssertEqual(voicing([4, 7, 11]), [0, 2, 2, 0, 0, 0])
  }

  func testUsesABarreAndKeepsTheBassAndGivesUp() {
    XCTAssertEqual(voicing([5, 9, 0]), [1, 3, 3, 2, 1, 1])
    XCTAssertEqual(voicing([0, 3, 7]), [nil, 3, 1, 0, 1, 3])
    XCTAssertEqual(voicing([0, 4, 7], bass: 7), [3, 3, 2, 0, 1, 0])
    XCTAssertNil(voicing([0, 1, 2, 3, 4, 5, 6]))
    XCTAssertNil(voicing([]))
  }

  // MARK: - Keyboard and fretboard

  private let cMinor = NoteTarget.chord(root: "C", quality: .minor)
  private let cMajor = NoteTarget.chord(root: "C", quality: .major)

  func testReadsTargetsAndSpellsKeysTheWayTheTargetWritesThem() {
    XCTAssertEqual(cMinor.pitches, [0, 3, 7])
    XCTAssertEqual(NoteTarget.notes(["G", "B", "D4"]).pitches, [2, 7, 11])

    let spell = KeyboardFretboard.spelling([cMinor, cMajor])
    XCTAssertEqual(spell(3), "Eb")
    XCTAssertEqual(spell(4), "E")
    XCTAssertEqual(spell(6), "F#")
    XCTAssertEqual(spell(10), "Bb")
  }

  func testTogglesKeysAndNamesTheAnswerForGrading() {
    XCTAssertEqual(KeyboardFretboard.toggle([0, 4, 7], 4), [0, 7])
    XCTAssertEqual(KeyboardFretboard.toggle([0, 7], 3), [0, 3, 7])
    XCTAssertEqual(KeyboardFretboard.notes(of: [0, 3, 7]), ["C4", "D#4", "G4"])
  }

  func testMarksKeptNewAndRemovedThenRightWrongAndMissing() {
    XCTAssertEqual(
      KeyboardFretboard.answeringMarks(pressed: [0, 3, 7], start: [0, 4, 7]),
      [64: .removed, 60: .kept, 63: .new, 67: .kept])
    XCTAssertEqual(
      KeyboardFretboard.checkedMarks(expected: [0, 3, 7], pressed: [0, 2, 7]),
      [63: .missed, 60: .correct, 62: .wrong, 67: .correct])
  }

  func testVoicesTheKeysOnGuitarAndPlacesTheWindow() {
    let shape = KeyboardFretboard.voicing(for: [0, 3, 7])
    XCTAssertEqual(shape, [nil, 3, 1, 0, 1, 3])
    XCTAssertEqual(KeyboardFretboard.pitches(of: shape ?? []), [0, 3, 7])
    XCTAssertNil(KeyboardFretboard.voicing(for: []))
    XCTAssertEqual(KeyboardFretboard.fretWindowStart([nil, 3, 1, 0, 1, 3]), 1)
    XCTAssertEqual(KeyboardFretboard.fretWindowStart([nil, 7, 9, 9, 8, 7]), 7)
    XCTAssertEqual(KeyboardFretboard.fretWindowStart(nil), 1)
  }

  private let changeOneNote = #"""
    {"template":"keyboardFretboard","prompt":"Change one note to turn C major into C minor.",
     "check":{"kind":"interaction","explanation":"Moving the middle note down a half step makes it minor."},
     "fields":{"instruments":["piano","guitar"],"start":{"kind":"chord","quality":"major","root":"C"},
               "target":{"kind":"chord","quality":"minor","root":"C"}}}
    """#

  func testChangingOneNoteTurnsCMajorIntoCMinor() throws {
    let content = try content(changeOneNote)
    let fields = try content.fields(as: KeyboardFretboardFields.self)
    let start = KeyboardFretboard.initialPitches(
      answer: nil, fields: fields, isInteraction: true, phase: .answering)
    XCTAssertEqual(start, [0, 4, 7])

    let minor = KeyboardFretboard.toggle(KeyboardFretboard.toggle(start, 4), 3)
    XCTAssertTrue(KeyboardFretboard.grade(content, .notes(KeyboardFretboard.notes(of: minor))))

    // Adding E flat without taking E away isn't minor.
    let both = KeyboardFretboard.toggle(start, 3)
    XCTAssertEqual(
      both.map { KeyboardFretboard.spelling([fields.target, fields.start])($0) },
      ["C", "Eb", "E", "G"])
    XCTAssertFalse(KeyboardFretboard.grade(content, .notes(KeyboardFretboard.notes(of: both))))
  }

  private let byEar = #"""
    {"template":"keyboardFretboard","prompt":"Play the sound, then find its two notes on the keys.",
     "check":{"kind":"interaction","explanation":"A perfect fifth."},
     "fields":{"byEar":true,"instruments":["piano"],"target":{"kind":"notes","notes":["C","G"]}}}
    """#

  func testASoundFoundByEarIsHiddenThenGradedByItsNotesAnywhere() throws {
    let content = try content(byEar)
    let fields = try content.fields(as: KeyboardFretboardFields.self)

    XCTAssertEqual(
      KeyboardFretboard.initialPitches(
        answer: nil, fields: fields, isInteraction: true, phase: .answering), [])
    XCTAssertEqual(
      KeyboardFretboard.initialPitches(
        answer: nil, fields: fields, isInteraction: false, phase: .explore),
      [0, 7])
    XCTAssertTrue(KeyboardFretboard.grade(content, .notes(["G3", "C4"])))
    XCTAssertFalse(KeyboardFretboard.grade(content, .notes(["C4", "F4"])))

    // An interval plays one note after the other, each above the one before.
    XCTAssertEqual(
      KeyboardFretboard.targetSound(.notes(["G", "C"])).map(\.midi), [67, 72])
    XCTAssertEqual(
      KeyboardFretboard.targetSound(.chord(root: "A", quality: .minor)).map(\.midi), [69, 72, 76])
  }

  func testPlayingGMajorOnTheGuitarIsRight() throws {
    let content = try content(
      #"""
      {"template":"keyboardFretboard","prompt":"Play a G major chord.",
       "check":{"kind":"interaction","explanation":"G major is G, B and D."},
       "fields":{"instruments":["guitar"],"target":{"kind":"chord","quality":"major","root":"G"}}}
      """#)
    let shape: GuitarVoicing = [3, 2, 0, 0, 0, 3]
    let notes = KeyboardFretboard.midis(of: shape).map(MusicNotes.midiToNote)

    XCTAssertEqual(notes, ["G2", "B2", "D3", "G3", "B3", "G4"])
    XCTAssertTrue(KeyboardFretboard.grade(content, .notes(notes)))
    XCTAssertFalse(KeyboardFretboard.grade(content, .notes(["G2", "C3", "D3"])))
  }

  // MARK: - Rhythm

  private let clave = #"""
    {"template":"rhythmTapper","prompt":"Tap the son clave over the beat.",
     "check":{"kind":"interaction","explanation":"Three hits, then two."},
     "fields":{"pattern":"x..x..x...x.x...","rounds":2,"stepsPerBeat":4,"tempo":90,"toleranceMs":100}}
    """#

  func testPlacesEveryTapOfEveryRoundOnTheGrid() throws {
    let fields = try content(clave).fields(as: RhythmTapperFields.self)
    let times = fields.tapTimesMs

    XCTAssertEqual(times.count, 10)
    XCTAssertEqual(times[0], 0)
    XCTAssertEqual(times[5], 16 * 60_000 / 90 / 4, accuracy: 1e-9)
    XCTAssertEqual(fields.hitSteps, [0, 3, 6, 10, 12])
  }

  func testTakesOutASteadyDelayButNotARhythmOnOtherBeats() {
    XCTAssertEqual(
      Rhythm.tapOffsets(deviceDelayMs: nil, expectedMs: [0, 500, 1000], tapsMs: [210, 700, 1220]),
      [0, -10, 10])
    XCTAssertTrue(
      Rhythm.tapOffsets(deviceDelayMs: nil, expectedMs: [0, 500], tapsMs: [700, 1200])!
        .allSatisfy { $0 > 100 })
    XCTAssertNil(Rhythm.tapOffsets(deviceDelayMs: nil, expectedMs: [0, 500], tapsMs: [0]))
  }

  func testTakesOutAMeasuredDelayThenExcusesOnlyASmallDrift() {
    XCTAssertEqual(
      Rhythm.tapOffsets(deviceDelayMs: 350, expectedMs: [0, 500, 1000], tapsMs: [360, 840, 1370]),
      [0, -20, 10])
    XCTAssertEqual(
      Rhythm.tapOffsets(deviceDelayMs: 0, expectedMs: [0, 500, 1000], tapsMs: [150, 650, 1150]),
      [90, 90, 90])
  }

  func testGradesARhythmForgivingOneSteadyDelay() throws {
    let tapper = try content(clave)
    let expected = try tapper.fields(as: RhythmTapperFields.self).tapTimesMs

    func grade(_ taps: [Double], delay: Double? = nil) -> Bool {
      Rhythm.grade(tapper, .rhythm(tapTimesMs: taps, deviceDelayMs: delay))
    }

    XCTAssertTrue(grade(expected.map { $0 + 180 }))
    XCTAssertFalse(grade(expected.map { $0 + 670 }))
    XCTAssertFalse(
      grade(expected.enumerated().map { $0.offset == 2 ? $0.element - 150 : $0.element }))
    XCTAssertFalse(grade(expected.map { $0 + 450 }))
    XCTAssertTrue(grade(expected.map { $0 + 450 }, delay: 440))
  }

  func testReadsTheDeviceDelayFromTapsAlongWithClicks() {
    let clicks: [Double] = [0, 1000, 2000, 3000, 4000, 5000]

    func after(_ offsets: [Double]) -> [Double] {
      zip(clicks, offsets).map { $0 + $1 }
    }

    XCTAssertEqual(
      Rhythm.estimateDeviceDelay(
        clicksMs: clicks, intervalMs: 1000, tapsMs: after([240, 260, 250, 230, 270, 250])),
      250)
    XCTAssertEqual(
      Rhythm.estimateDeviceDelay(
        clicksMs: clicks, intervalMs: 1000, tapsMs: after([-20, 10, 0, -10, 20, 0]) + [2400]), 0)
    XCTAssertEqual(
      Rhythm.estimateDeviceDelay(
        clicksMs: clicks, intervalMs: 1000, tapsMs: after([470, 480, 460, 490, 475, 480])),
      478)
    XCTAssertNil(
      Rhythm.estimateDeviceDelay(
        clicksMs: clicks, intervalMs: 1000, tapsMs: after([100, 120, 110])))
  }

  func testJudgesEachTapAfterTakingTheDelayOut() {
    let expected: [Double] = [0, 500, 1000, 1500]
    let steady = Rhythm.results(
      beatMs: 500, deviceDelayMs: nil, expectedMs: expected, tapsMs: [150, 640, 1170, 1650],
      toleranceMs: 60)

    XCTAssertEqual(steady.extraTaps, 0)
    XCTAssertEqual(steady.hits.map(\.status), [.onTime, .onTime, .onTime, .onTime])

    let mixed = Rhythm.results(
      beatMs: 500, deviceDelayMs: nil, expectedMs: expected, tapsMs: [0, 420, 1100, 1500, 1520],
      toleranceMs: 50)

    XCTAssertEqual(mixed.hits.map(\.status), [.onTime, .early, .late, .onTime])
    XCTAssertEqual(mixed.hits[1].offsetMs, -80)
    XCTAssertEqual(mixed.extraTaps, 1)

    let missing = Rhythm.results(
      beatMs: 500, deviceDelayMs: nil, expectedMs: expected, tapsMs: [0, 500], toleranceMs: 50)
    XCTAssertEqual(missing.hits.map(\.status), [.onTime, .onTime, .missed, .missed])
  }

  func testPointsAtAMissedHitFirstThenTheFurthestOff() {
    XCTAssertEqual(
      Rhythm.worstHit([.init(offsetMs: -80, status: .early), .init(offsetMs: 120, status: .late)])?
        .index, 1)
    XCTAssertEqual(
      Rhythm.worstHit([.init(offsetMs: 120, status: .late), .init(offsetMs: nil, status: .missed)])?
        .index, 1)
    XCTAssertNil(Rhythm.worstHit([.init(offsetMs: 5, status: .onTime)]))
  }

  func testRoundsHalvesUpAsJavaScriptDoes() {
    XCTAssertEqual(Rhythm.jsRound(2.5), 3)
    XCTAssertEqual(Rhythm.jsRound(-2.5), -2)
    XCTAssertEqual(Rhythm.median([3, 1, 2, 4]), 2.5)
  }

  // MARK: - Notation

  private let ode =
    "X:1\nT:Ode to Joy\nC:Beethoven, 1824\nM:4/4\nL:1/4\nK:C\nE E F G | G F E D | C C D E | E3/2 D/2 D2 |]"

  func testReadsTheTitleComposerAndPracticeTempos() {
    let tune = ABCTune(notation: ode)

    XCTAssertEqual(tune.title, "Ode to Joy")
    XCTAssertEqual(tune.composer, "Beethoven, 1824")
    XCTAssertNil(ABCTune(notation: "K:C\nC D E").title)
    XCTAssertEqual(ABCTune.practiceTempos(80), [50, 65, 80])
    XCTAssertEqual(ABCTune.practiceTempos(40), [25, 30, 40])
  }

  func testReadsOdeToJoyBarByBar() {
    let tune = ABCTune(notation: ode)

    XCTAssertEqual(tune.bars.count, 4)
    XCTAssertEqual(tune.outline[0], [64, 64, 65, 67])
    XCTAssertEqual(tune.outline[3], [64, 62, 62])
    XCTAssertEqual(tune.bars[3].elements.map(\.written), [0.375, 0.125, 0.5])
    XCTAssertEqual(tune.bars[3].end, .final)
    XCTAssertEqual(tune.meter.beatLength, 0.25)

    // 80 beats a minute: a quarter lasts 0.75 s, and the 16 beats 12 s.
    let schedule = NotationPlayback.schedule(tune, bpm: 80)
    XCTAssertEqual(schedule.length, 12, accuracy: 1e-9)
    XCTAssertEqual(schedule.sounds.count, 15)
    XCTAssertEqual(schedule.sounds[1].at, 0.75, accuracy: 1e-9)
    XCTAssertEqual(schedule.sounds.last?.duration ?? 0, 1.5, accuracy: 1e-9)
  }

  func testAppliesTheKeyBarAccidentalsAndOctaves() {
    let tune = ABCTune(notation: "M:3/4\nL:1/8\nK:G\nF f ^c c =F F | c' C, B,, |")

    XCTAssertEqual(tune.fifths, 1)
    XCTAssertEqual(tune.outline[0], [66, 78, 73, 73, 65, 65])
    XCTAssertEqual(tune.outline[1], [84, 48, 47])
    XCTAssertEqual(tune.bars[0].elements[2].pitches[0].accidental, .sharp)
    XCTAssertNil(tune.bars[0].elements[3].pitches[0].accidental)
    XCTAssertEqual(ABCTune(notation: "K:Bb\nB e").outline[0], [70, 75])
    XCTAssertEqual(ABCTune(notation: "K:Am\nG").fifths, 0)
    XCTAssertEqual(ABCTune(notation: "K:D dorian\nF").outline[0], [65])
    XCTAssertEqual(ABCTune(notation: "K:F#m\nc").fifths, 3)
    XCTAssertEqual(ABCTune(notation: "K:C clef=bass\nC,").clef, .bass)
  }

  func testReadsLengthsChordsTupletsBrokenRhythmsAndTies() {
    let tune = ABCTune(
      notation: "M:4/4\nL:1/8\nK:C\n\"C\"[CEG]2 (3cde A>B c/d/ | e4- e2 z2 |")
    let first = tune.bars[0].elements

    XCTAssertEqual(first[0].pitches.map(\.midi), [60, 64, 67])
    XCTAssertEqual(first[0].chordSymbol, "C")
    XCTAssertEqual(first[1].sounding, 1.0 / 12, accuracy: 1e-9)
    XCTAssertEqual(first[1].written, 0.125)
    XCTAssertEqual(first[1].tuplet?.number, 3)
    XCTAssertEqual(first[4].written, 0.1875)
    XCTAssertEqual(first[5].written, 0.0625)
    XCTAssertEqual(first[6].written, 0.0625)
    XCTAssertTrue(first[4].breaksBeam)
    XCTAssertFalse(first[2].breaksBeam)

    let second = tune.bars[1].elements
    XCTAssertTrue(second[0].isTied)
    XCTAssertTrue(second[1].continuesTie)
    XCTAssertTrue(second[2].isRest)

    // The tie rings on: e sounds once for six eighths.
    let schedule = NotationPlayback.schedule(tune, bpm: 60)
    let e = schedule.sounds.last { $0.midi == 76 }
    XCTAssertEqual(e?.duration ?? 0, 3, accuracy: 1e-9)
    XCTAssertEqual(tune.outline[1], [76])
  }

  func testFollowsRepeatsAndEndings() {
    XCTAssertEqual(ABCTune(notation: "K:C\n|: C | D :| E |").playOrder, [0, 1, 0, 1, 2])
    XCTAssertEqual(
      ABCTune(notation: "K:C\nC |: D |1 E :|2 F | G |]").playOrder, [0, 1, 2, 1, 3, 4])
    XCTAssertEqual(ABCTune(notation: "K:C\nC | D :| E |").playOrder, [0, 1, 0, 1, 2])
  }

  func testTimesCompoundMetersByTheDottedQuarter() {
    XCTAssertEqual(ABCTune.Meter.fraction(6, 8).beatLength, 0.375)
    XCTAssertEqual(ABCTune.Meter.cut.beatLength, 0.5)
    XCTAssertEqual(ABCTune.Meter.none.beatLength, 0.25)
    XCTAssertEqual(ABCTune(notation: "M:2/4\nK:C\nC").bars[0].elements[0].written, 0.0625)
  }

  func testLaysOdeToJoyOutTwoBarsALineOnAPhone() {
    let tune = ABCTune(notation: ode)
    let staff = NotationDrawing(tune: tune, width: 330, space: 8, tabSpace: nil, textHeight: 16)
    let tab = NotationDrawing(tune: tune, width: 330, space: 8, tabSpace: 13, textHeight: 16)
    let wide = NotationDrawing(tune: tune, width: 700, space: 8, tabSpace: nil, textHeight: 16)
    let frets = tab.items.compactMap { item -> String? in
      if case .text(let text, _, .tabFret) = item.mark { text } else { nil }
    }

    XCTAssertGreaterThan(staff.height, 0)
    XCTAssertLessThan(wide.height, staff.height, "four bars fit one wide line")
    XCTAssertGreaterThan(tab.height, staff.height)
    // E4 sounds as the D string's second fret on a guitar, which reads an octave up.
    XCTAssertEqual(Array(frets.prefix(4)), ["2", "2", "3", "0"])
  }

  // MARK: - Sound

  func testSynthesizesPianoAndGuitarAtTheirPitch() throws {
    XCTAssertEqual(try loudestPeriodFrequency(.piano, midi: 69), 440, accuracy: 4)
    XCTAssertEqual(try loudestPeriodFrequency(.guitar, midi: 57), 220, accuracy: 3)
  }

  func testStopsEverySoundAndRestsSilent() throws {
    let renderer = MusicRenderer(sampleRate: 48_000)
    renderer.schedule([.init(heardAt: 0, voice: .piano, midi: 60, duration: 1.2, click: .beat)])
    XCTAssertGreaterThan(try render(renderer, seconds: 0.1).map(abs).max() ?? 0, 0.05)

    renderer.stopAll()
    _ = try render(renderer, seconds: 0.05)
    XCTAssertEqual(try render(renderer, seconds: 0.05).map(abs).max() ?? 1, 0)
    XCTAssertTrue(renderer.isSilent)
  }

  // MARK: - Helpers

  private func content(_ json: String) throws -> ActivityStepContent {
    try JSONDecoder().decode(ActivityStepContent.self, from: Data(json.utf8))
  }

  private func render(_ renderer: MusicRenderer, seconds: Double) throws -> [Float] {
    let format = try XCTUnwrap(AVAudioFormat(standardFormatWithSampleRate: 48_000, channels: 1))
    let frames = 512
    var samples: [Float] = []

    for _ in 0..<Int(seconds * 48_000) / frames {
      let buffer = try XCTUnwrap(
        AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(frames)))
      buffer.frameLength = AVAudioFrameCount(frames)
      var timestamp = AudioTimeStamp()
      timestamp.mHostTime = mach_absolute_time()
      timestamp.mFlags = .hostTimeValid
      _ = renderer.render(
        timestamp: &timestamp, frameCount: frames, buffers: buffer.mutableAudioBufferList)
      samples += UnsafeBufferPointer(start: buffer.floatChannelData?[0], count: frames)
    }

    return samples
  }

  /// The frequency of the strongest period in a note's sound, by autocorrelation.
  private func loudestPeriodFrequency(_ voice: MusicRenderer.VoiceKind, midi: Int) throws -> Double
  {
    let renderer = MusicRenderer(sampleRate: 48_000)
    renderer.schedule([.init(heardAt: 0, voice: voice, midi: midi, duration: 1, click: .beat)])
    let window = Array(try render(renderer, seconds: 0.4).dropFirst(4_800).prefix(8_192))

    XCTAssertLessThanOrEqual(window.map(abs).max() ?? 2, 1)

    let lags = (48_000 / 1_000)...(48_000 / 60)
    let best = lags.max { first, second in
      correlation(window, lag: first) < correlation(window, lag: second)
    }

    return 48_000 / Double(best ?? 1)
  }

  private func correlation(_ samples: [Float], lag: Int) -> Float {
    var sum: Float = 0

    for index in 0..<(samples.count - lag) {
      sum += samples[index] * samples[index + lag]
    }

    return sum
  }
}
