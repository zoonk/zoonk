import SwiftUI

struct LanguageStepView: View {
  let exercise: LanguageExercise
  let wordHints: WordHints?
  let context: LessonStepContext
  let part: LessonStepPart

  var body: some View {
    switch (exercise.kind, part) {
    case (.vocabulary, _):
      VocabularyView(exercise: exercise, wordHints: wordHints, part: part)
    case (.alphabet, .screen):
      AlphabetView(exercise: exercise)
    case (.multipleChoice, _):
      MultipleChoiceView(exercise: exercise, context: context, part: part)
    case (.translation, _):
      TranslationView(exercise: exercise, context: context, part: part)
    case (.fillBlank, .screen):
      if let question = exercise.content.question {
        LessonQuestionText(text: question)
      }
    case (.fillBlank, .turn):
      FillBlankView(exercise: exercise, context: context)
    case (.reading, _), (.listening, _):
      ArrangeWordsView(exercise: exercise, context: context, part: part)
    case (.matchColumns, .screen):
      LessonQuestionText(
        text: exercise.content.question
          ?? String(
            localized: "Match the pairs.", table: "Player",
            comment: "Instruction of a match-the-pairs exercise"))
    case (.matchColumns, .turn):
      MatchColumnsView(exercise: exercise, context: context)
    default:
      EmptyView()
    }
  }
}

private struct ScreenChip: View {
  let text: Text

  var body: some View {
    text.chip()
  }
}

/// Main's prompt audio: a recording the screen is about (a word, a letter, a sentence to hear).
struct LessonAudioButton: View {
  enum Style {
    /// Listening's, where hearing the sentence is the task.
    case prominent
    case bar
    /// Right after the word or letter; the bar's button on the same screen takes P.
    case inline
  }

  @Environment(\.lessonAudio) private var audio
  @Environment(LessonPromptAudio.self) private var prompt: LessonPromptAudio?

  let url: URL?
  var style = Style.prominent

  var body: some View {
    if let url {
      let isPlaying = prompt?.playing == url
      let button = Button {
        if let prompt {
          prompt.toggle(url, audio: audio)
        } else {
          Task { await audio.play(url) }
        }
      } label: {
        Label {
          if isPlaying {
            Text(
              "Pause pronunciation", tableName: "Player",
              comment: "Pauses a word's or sentence's sound")
          } else {
            Text(
              "Play pronunciation", tableName: "Player",
              comment: "Plays a word's or sentence's sound"
            )
          }
        } icon: {
          // Pause is narrower than the speaker, so keeping the speaker's room leaves the word and
          // the bar where they are while it plays.
          ZStack {
            Image(systemName: icon).hidden()
            Image(systemName: isPlaying ? "pause.fill" : icon)
          }
        }
        .labelStyle(.iconOnly)
        .modifier(Fit(style: style, isPlaying: isPlaying))
      }

      switch style {
      case .prominent, .bar:
        button
          .buttonStyle(.bordered)
          .buttonBorderShape(.circle)
          .controlSize(.large)
          .keyboardShortcut("p", modifiers: [])
      case .inline:
        button
          .buttonStyle(.borderless)
      }
    }
  }

  private var icon: String {
    style == .prominent ? "speaker.wave.2.fill" : "speaker.wave.2"
  }

  /// A button's hit region is its label's shape, so the sizes go on the label.
  private struct Fit: ViewModifier {
    let style: Style
    let isPlaying: Bool

    func body(content: Content) -> some View {
      switch style {
      case .prominent:
        content
      case .bar:
        content.frame(minHeight: 32)
      case .inline:
        content
          .imageScale(.large)
          .foregroundStyle(isPlaying ? .primary : .secondary)
          .frame(minWidth: 44, minHeight: 44)
          .contentShape(.rect)
      }
    }
  }
}

extension LanguageExercise {
  /// Main's `getPlayerStepAudioUrl`.
  var promptAudio: URL? {
    let url: String? =
      switch kind {
      case .vocabulary: word?.audioUrl
      case .alphabet: content.audioUrl
      case .listening: sentence?.audioUrl
      default: nil
      }

    return url.flatMap(URL.init(string:))
  }
}

extension LessonStep {
  /// Main's `getPromptAudioUrl`: the listening a spoken screen offers instead never plays on its own.
  var promptAudio: URL? {
    guard case .language(let exercise, _) = content else {
      return nil
    }

    return exercise.promptAudio
  }
}

/// Per lesson, above the layout, so folding or unfolding the screen neither stops nor replays its
/// prompt.
@MainActor
@Observable
final class LessonPromptAudio {
  private(set) var playing: URL?
  @ObservationIgnored private var task: Task<Void, Never>?

  /// Another screen in view, whose sounds the lesson already stopped: its prompt plays once, on its
  /// own.
  func enter(prompt: URL?, audio: LessonAudio) {
    task?.cancel()
    task = nil
    playing = nil

    if let prompt {
      play(prompt, audio: audio, autoplay: true)
    }
  }

  func toggle(_ url: URL, audio: LessonAudio) {
    if playing == url {
      stop(audio: audio)
    } else {
      play(url, audio: audio, autoplay: false)
    }
  }

  private func stop(audio: LessonAudio) {
    guard playing != nil else { return }
    task?.cancel()
    task = nil
    playing = nil
    audio.stop()
  }

  private func play(_ url: URL, audio: LessonAudio, autoplay: Bool) {
    task?.cancel()
    playing = url
    task = Task {
      guard !Task.isCancelled else { return }
      await audio.play(url, autoplay: autoplay)

      if !Task.isCancelled {
        playing = nil
      }
    }
  }
}

/// On a spread, the word faces what it means, as in a bilingual reader.
private struct VocabularyView: View {
  @Environment(\.isPaneSplit) private var isPaneSplit

  let exercise: LanguageExercise
  let wordHints: WordHints?
  let part: LessonStepPart

  var body: some View {
    if let word = exercise.word {
      switch part {
      case .screen:
        ScreenChip(
          text: Text("Vocabulary", tableName: "Player", comment: "Label above a word to learn"))

        VStack(alignment: .leading, spacing: 4) {
          AccessibilityStack(spacing: 8) {
            Text(word.word)
              .font(.largeTitle.weight(.semibold))
            LessonAudioButton(url: exercise.promptAudio, style: .inline)
          }
          if let romanization = word.romanization {
            Text(romanization).foregroundStyle(.secondary)
          }
          if let pronunciation = word.pronunciation {
            Text(pronunciation).font(.callout).foregroundStyle(.secondary)
          }
        }

        if !isPaneSplit {
          meaning(word)
        }
      case .turn:
        if isPaneSplit {
          meaning(word)
        }
      }
    }
  }

  @ViewBuilder
  private func meaning(_ word: LanguageExercise.Word) -> some View {
    Text(word.translation)
      .font(.title3)

    if let wordHints {
      LessonWordHints(hints: wordHints)
    }
  }
}

/// A word's usage note and pronunciation tip: on its vocabulary screen, and after a translation is
/// checked.
struct LessonWordHints: View {
  let hints: WordHints

  var body: some View {
    if let note = hints.note {
      VStack(alignment: .leading, spacing: 2) {
        Text("Usage:", tableName: "Player", comment: "Before a word's usage note")
          .font(.caption.weight(.medium)).foregroundStyle(.secondary)
        Text(note)
      }
    }

    if let tip = hints.pronunciationTip {
      VStack(alignment: .leading, spacing: 2) {
        Text(
          "Pronunciation tip:", tableName: "Player", comment: "Before a word's pronunciation tip"
        )
        .font(.caption.weight(.medium)).foregroundStyle(.secondary)
        Text(tip)
      }
    }
  }
}

private struct AlphabetView: View {
  let exercise: LanguageExercise

  private var content: LanguageExercise.Content { exercise.content }

  var body: some View {
    ScreenChip(
      text: Text("Alphabet", tableName: "Player", comment: "Label above a letter to learn"))

    HStack(alignment: .center, spacing: 16) {
      Text(content.symbol ?? "")
        .font(.system(.largeTitle, design: .default).weight(.semibold))
        .dynamicTypeSize(...DynamicTypeSize.accessibility5)
        .scaleEffect(1.6, anchor: .leading)
        .padding(.trailing, 24)
      AccessibilityStack(spacing: 8) {
        VStack(alignment: .leading, spacing: 4) {
          if let readingAid = content.readingAid {
            Text(readingAid).font(.title3.weight(.medium))
          }
          if let pronunciation = content.pronunciation {
            Text(pronunciation).foregroundStyle(.secondary)
          }
        }
        LessonAudioButton(url: exercise.promptAudio, style: .inline)
      }
    }

    if let forms = content.forms, !forms.isEmpty {
      HStack(spacing: 16) {
        ForEach(forms, id: \.self) { form in
          VStack {
            Text(form.symbol).font(.title)
            Text(form.label).font(.caption).foregroundStyle(.secondary)
          }
          .accessibilityElement(children: .combine)
        }
      }
    }
  }
}

private struct MultipleChoiceView: View {
  let exercise: LanguageExercise
  let context: LessonStepContext
  let part: LessonStepPart

  var body: some View {
    switch part {
    case .screen:
      if let text = exercise.content.context {
        LessonRichText(text).foregroundStyle(.secondary)
      }

      if let question = exercise.content.question {
        LessonQuestionText(text: question)
      }
    case .turn:
      options
    }
  }

  private var options: some View {
    LessonOptionList(
      options: (exercise.content.options ?? []).map {
        LessonOption(id: $0.id, text: $0.text, isCorrect: $0.isCorrect)
      },
      selectedId: context.answer.flatMap {
        if case .multipleChoice(let id) = $0 { id } else { nil }
      },
      isChecked: context.result != nil,
      isLocked: context.isLocked
    ) { context.select(.multipleChoice(selectedOptionId: $0)) }
  }
}

private struct TranslationView: View {
  @Environment(\.lessonAudio) private var audio

  let exercise: LanguageExercise
  let context: LessonStepContext
  let part: LessonStepPart

  var body: some View {
    if let word = exercise.word {
      switch part {
      case .screen:
        ScreenChip(
          text: Text(
            "Translate", tableName: "Player",
            comment: "Label above a word or sentence to translate"))
        LessonQuestionText(text: word.translation)
      case .turn:
        options(word)
      }
    }
  }

  private func options(_ word: LanguageExercise.Word) -> some View {
    LessonOptionList(
      options: exercise.translationOptions.map {
        LessonOption(
          id: $0.id, text: $0.word, detail: $0.romanization, isCorrect: $0.id == word.id)
      },
      selectedId: context.answer.flatMap {
        if case .translation(let id) = $0 { id } else { nil }
      },
      isChecked: context.result != nil,
      isLocked: context.isLocked
    ) { id in
      context.select(.translation(selectedOptionId: id))
      audio.playWord(exercise.translationOptions.first { $0.id == id }?.audioUrl)
    }
  }
}

extension LessonAudio {
  @MainActor
  fileprivate func playWord(_ audioUrl: String?) {
    if let url = audioUrl.flatMap(URL.init(string:)) {
      Task { await play(url) }
    }
  }
}

/// Where the stage gives the turn spare height (one column), the bank sits at its bottom, so it
/// stays put while the answer grows.
private struct LessonWordBank<Tiles: View>: View {
  @ViewBuilder let tiles: Tiles

  var body: some View {
    FlowLayout(spacing: 8) {
      tiles
    }
    .accessibilityElement(children: .contain)
    .accessibilityLabel(
      Text("Word bank", tableName: "Player", comment: "The words to build an answer from")
    )
    .frame(maxHeight: .infinity, alignment: .bottom)
  }
}

/// A tile fills the first empty blank, and a filled blank empties on a tap.
private struct FillBlankView: View {
  @Environment(\.lessonAudio) private var audio

  let exercise: LanguageExercise
  let context: LessonStepContext

  private var segments: [String] {
    (exercise.content.template ?? "").components(separatedBy: "[BLANK]")
  }

  private var blanks: [String] {
    if case .fillBlank(let answers) = context.answer {
      return answers
    }

    return Array(repeating: "", count: max(segments.count - 1, 0))
  }

  var body: some View {
    FlowLayout(spacing: 8, alignment: .firstTextBaseline) {
      ForEach(Array(segments.enumerated()), id: \.offset) { index, segment in
        if !segment.isEmpty {
          Text(segment.trimmingCharacters(in: .whitespaces))
            .font(.title3)
            .dimsOnceChecked()
        }

        if index < blanks.count {
          blank(index)
        }
      }
    }

    LessonWordBank {
      ForEach(Array(exercise.fillBlankOptions.enumerated()), id: \.offset) { _, option in
        LessonWordTile(
          word: option.word, romanization: option.romanization,
          isUsed: blanks.filter { $0 == option.word }.count
            >= exercise.fillBlankOptions.filter { $0.word == option.word }.count
            || context.isLocked
        ) {
          fill(option)
        }
      }
    }
  }

  @ViewBuilder
  private func blank(_ index: Int) -> some View {
    let word = blanks[index]

    if context.result != nil {
      let isRight =
        (exercise.content.answers ?? []).indices.contains(index)
        && exercise.content.answers?[index].lowercased() == word.lowercased()

      blankWord(word, line: isRight ? .success : .destructive)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
          Text(
            "Blank \(index + 1): \(word)", tableName: "Player",
            comment: "A checked blank in a sentence")
        )
        .accessibilityValue(CheckedWord.verdict(isRight: isRight))
    } else {
      Button {
        var answers = blanks
        answers[index] = ""
        context.select(answers.allSatisfy(\.isEmpty) ? nil : .fillBlank(userAnswers: answers))
      } label: {
        blankWord(word, line: .secondary)
      }
      .buttonStyle(.plain)
      .disabled(context.isLocked || word.isEmpty)
      .accessibilityLabel(
        word.isEmpty
          ? Text("Blank \(index + 1)", tableName: "Player", comment: "An empty blank in a sentence")
          : Text(
            "Blank \(index + 1): \(word). Tap to remove.", tableName: "Player",
            comment: "A filled blank in a sentence"))
    }
  }

  private func blankWord(_ word: String, line: Color) -> some View {
    Text(word.isEmpty ? "      " : word)
      .font(.title3.weight(.medium))
      .padding(.horizontal, 6)
      .overlay(alignment: .bottom) {
        Rectangle().frame(height: 2).foregroundStyle(line)
      }
  }

  private func fill(_ option: LanguageExercise.WordOption) {
    var answers = blanks

    guard let empty = answers.firstIndex(of: "") else {
      return
    }

    answers[empty] = option.word
    context.select(.fillBlank(userAnswers: answers))
    audio.playWord(option.audioUrl)
  }
}

private struct ArrangeWordsView: View {
  private enum WordFocus: Hashable {
    case placed(Int)
    case tile(Int)
  }

  @Environment(\.lessonAudio) private var audio
  @AccessibilityFocusState private var focus: WordFocus?

  let exercise: LanguageExercise
  let context: LessonStepContext
  let part: LessonStepPart

  private var isListening: Bool { exercise.kind == .listening }

  private var arranged: [Int] {
    bankIndices(of: arrangedWords ?? [])
  }

  private func bankIndices(of words: [String]) -> [Int] {
    var used = Set<Int>()
    return words.compactMap { word in
      let index = exercise.wordBankOptions.indices.first {
        !used.contains($0) && exercise.wordBankOptions[$0].word == word
      }
      if let index { used.insert(index) }
      return index
    }
  }

  private var arrangedWords: [String]? {
    switch context.answer {
    case .reading(let words), .listening(let words): words
    default: nil
    }
  }

  var body: some View {
    if let sentence = exercise.sentence {
      switch part {
      case .screen: screen(sentence)
      case .turn: turn
      }
    }
  }

  @ViewBuilder
  private func screen(_ sentence: LanguageExercise.Sentence) -> some View {
    if isListening {
      ScreenChip(
        text: Text(
          "What do you hear?", tableName: "Player",
          comment: "Above a sentence to listen to and arrange"))
      HStack(spacing: 12) {
        LessonAudioButton(url: exercise.promptAudio)
        if exercise.promptAudio == nil {
          LessonQuestionText(text: sentence.sentence)
        }
      }
    } else {
      ScreenChip(
        text: Text(
          "Translate", tableName: "Player", comment: "Label above a word or sentence to translate"
        ))
      ReadingPromptText(
        sentence: sentence.translation, words: exercise.readingPromptWords)
    }
  }

  private var marks: [Bool]? {
    guard let result = context.result, let expected = LessonGrading.arrangedWords(exercise) else {
      return nil
    }

    return LessonGrading.arrangedWordMarks(
      arranged.map { exercise.wordBankOptions[$0].word }, expected: expected,
      isCorrect: result.isCorrect)
  }

  @ViewBuilder
  private var turn: some View {
    FlowLayout(spacing: 8) {
      ForEach(Array(arranged.enumerated()), id: \.element) { position, index in
        let word = exercise.wordBankOptions[index].word

        if let marks {
          CheckedWord(word: word, isRight: marks[position])
        } else {
          Button {
            remove(at: position)
          } label: {
            Text(word)
          }
          .buttonStyle(.bordered)
          .tint(.primary)
          .disabled(context.isLocked)
          .accessibilityFocused($focus, equals: .placed(index))
        }
      }
    }
    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
    .padding(8)
    .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 16))

    LessonWordBank {
      ForEach(exercise.wordBankOptions.indices, id: \.self) { index in
        let option = exercise.wordBankOptions[index]

        LessonWordTile(
          word: option.word, romanization: option.romanization,
          isUsed: arranged.contains(index) || context.isLocked
        ) {
          set(arranged + [index])
          audio.playWord(option.audioUrl)
        }
        .accessibilityFocused($focus, equals: .tile(index))
      }
    }
  }

  /// The removed word's button goes away, so VoiceOver moves to the next placed word, else the
  /// previous one, else the tile that came back, as on main.
  private func remove(at position: Int) {
    let placed = arranged
    var words = placed.map { exercise.wordBankOptions[$0].word }
    words.remove(at: position)
    let rest = bankIndices(of: words)
    set(rest)
    focus =
      rest.indices.contains(position)
      ? .placed(rest[position]) : rest.last.map(WordFocus.placed) ?? .tile(placed[position])
  }

  private func set(_ indices: [Int]) {
    let words = indices.map { exercise.wordBankOptions[$0].word }

    if words.isEmpty {
      context.select(nil)
    } else {
      context.select(
        isListening ? .listening(arrangedWords: words) : .reading(arrangedWords: words))
    }
  }
}

private struct ReadingPromptText: View {
  @ScaledMetric(relativeTo: .title2) private var wordSpacing = 6
  @State private var shownHint: Int?

  let sentence: String
  let words: [LanguageExercise.ReadingPromptWord]

  var body: some View {
    let prompt = PromptText.stripWrappingQuotes(sentence)
    let hinted = words.indices.filter { words[$0].translation != nil }

    FlowLayout(spacing: prompt.contains(" ") ? wordSpacing : 0, alignment: .firstTextBaseline) {
      ForEach(words.indices, id: \.self) { index in
        if let translation = words[index].translation {
          HintedWord(word: words[index].word, translation: translation, isShown: shows(index))
        } else {
          Text(words[index].word)
        }
      }
    }
    .font(.title2.weight(.semibold))
    .dimsOnceChecked()
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(prompt)
    .accessibilityAddTraits(.isHeader)
    .accessibilityActions {
      ForEach(hinted, id: \.self) { index in
        Button(words[index].word) { shownHint = index }
      }
    }
  }

  private func shows(_ index: Int) -> Binding<Bool> {
    Binding {
      shownHint == index
    } set: { isShown in
      if isShown {
        shownHint = index
      } else if shownHint == index {
        shownHint = nil
      }
    }
  }
}

/// Main's dotted underline: the word has more to show, without reading as a link.
private struct HintedWord: View {
  let word: String
  let translation: String
  @Binding var isShown: Bool

  var body: some View {
    Button {
      isShown = true
    } label: {
      Text(word)
        .textRenderer(DottedUnderline(word: word))
        .contentShape(.rect.inset(by: -8))
    }
    .buttonStyle(.plain)
    .popover(isPresented: $isShown, arrowEdge: .top) {
      Text(translation)
        .font(.headline)
        .foregroundStyle(.primary)
        .padding(.horizontal)
        .padding(.vertical, 10)
        .presentationCompactAdaptation(.popover)
        .accessibilitySizeStyles()
    }
  }
}

/// Main's dotted underline, under the letters on every line. The system's dot pattern leaves gaps
/// as wide as the space between two prompt words, so two hinted phrases side by side would read as
/// one, and the punctuation around a phrase ("por mês?") isn't part of what it translates.
private struct DottedUnderline: TextRenderer {
  let word: String

  func draw(layout: Text.Layout, in context: inout GraphicsContext) {
    let characters = Array(word.utf16)
    let glyphsByLine = layout.map { line in line.flatMap { $0 } }
    let start = glyphsByLine.joined().flatMap(\.characterIndices).min()

    for (line, glyphs) in zip(layout, glyphsByLine) {
      let letters = glyphs.filter { glyph in
        glyph.characterIndices.contains { index in
          start.map { Self.isLetter(characters, at: $0.distance(to: index)) } ?? false
        }
      }

      if let minX = letters.map(\.typographicBounds.rect.minX).min(),
        let maxX = letters.map(\.typographicBounds.rect.maxX).max()
      {
        context.fill(
          Self.dots(from: minX, to: maxX, below: line.typographicBounds),
          with: .style(.foreground.opacity(0.5)))
      }

      context.draw(line)
    }
  }

  private static func isLetter(_ characters: [UInt16], at offset: Int) -> Bool {
    guard characters.indices.contains(offset), let scalar = Unicode.Scalar(characters[offset])
    else {
      return true
    }

    return CharacterSet.alphanumerics.contains(scalar)
  }

  private static func dots(
    from minX: CGFloat, to maxX: CGFloat, below line: Text.Layout.TypographicBounds
  ) -> Path {
    let size = line.descent * 0.35
    let top = line.origin.y + line.descent
    let width = maxX - minX
    let count = max(Int((width + size) / (size * 2)), 1)
    let step = count > 1 ? (width - size) / CGFloat(count - 1) : 0
    var dots = Path()

    for index in 0..<count {
      dots.addEllipse(
        in: CGRect(x: minX + CGFloat(index) * step, y: top, width: size, height: size))
    }

    return dots
  }
}

/// Not a disabled button, which would gray out the learner's checked answer.
private struct CheckedWord: View {
  let word: String
  let isRight: Bool

  var body: some View {
    let tone: Color = isRight ? .success : .destructive

    Text(word)
      .padding(.horizontal, 12)
      .padding(.vertical, 6)
      .background(tone.opacity(0.15), in: .capsule)
      .overlay {
        Capsule().strokeBorder(tone, lineWidth: 1.5)
      }
      .accessibilityValue(Self.verdict(isRight: isRight))
  }

  static func verdict(isRight: Bool) -> Text {
    isRight
      ? Text(
        "Correct", tableName: "Player", comment: "VoiceOver: a checked word in its right place")
      : Text(
        "Incorrect", tableName: "Player", comment: "VoiceOver: a checked word in a wrong place")
  }
}

/// A right pair locks, a wrong one counts as a mistake.
private struct MatchColumnsView: View {
  @ActivityState("pickedLeft") private var pickedLeft: Int? = nil
  @ActivityState("mistakes") private var mistakes = 0
  @State private var lastMiss: Int?

  let exercise: LanguageExercise
  let context: LessonStepContext

  private var pairs: [LanguageExercise.Content.Pair] { exercise.content.pairs ?? [] }

  private var matched: [LessonAnswer.Pair] {
    if case .matchColumns(let pairs, _) = context.answer {
      return pairs
    }

    return []
  }

  private var board: MatchColumnsBoard {
    MatchColumnsBoard(
      pairs: pairs.map { LessonAnswer.Pair(left: $0.left, right: $0.right) },
      rightItems: exercise.matchColumnsRightItems, matched: matched)
  }

  var body: some View {
    let board = board

    HStack(alignment: .top, spacing: 12) {
      VStack(spacing: 10) {
        ForEach(pairs.indices, id: \.self) { index in
          let isMatched = board.matchedLeft.contains(index)
          Button {
            pickedLeft = index
          } label: {
            Text(pairs[index].left)
          }
          .buttonStyle(
            LessonOptionStyle(mark: isMatched ? .right : pickedLeft == index ? .selected : .plain)
          )
          .disabled(isMatched || context.isLocked)
        }
      }

      VStack(spacing: 10) {
        ForEach(exercise.matchColumnsRightItems.indices, id: \.self) { index in
          let item = exercise.matchColumnsRightItems[index]
          let isMatched = board.matchedRight.contains(index)
          Button {
            pick(right: index)
          } label: {
            Text(item)
          }
          .buttonStyle(
            LessonOptionStyle(mark: isMatched ? .right : lastMiss == index ? .wrong : .plain)
          )
          .disabled(isMatched || context.isLocked || pickedLeft == nil)
        }
      }
    }

    if matched.count == pairs.count, !pairs.isEmpty, context.result == nil {
      Text(
        "All pairs matched. Press Check to continue.", tableName: "Player",
        comment: "Every pair of a match exercise is matched"
      )
      .font(.subheadline)
      .foregroundStyle(.secondary)
    }
  }

  private func pick(right index: Int) {
    guard let left = pickedLeft else {
      return
    }

    let pair = LessonAnswer.Pair(
      left: pairs[left].left, right: exercise.matchColumnsRightItems[index])
    pickedLeft = nil

    if board.isRight(pair) {
      lastMiss = nil
      context.select(.matchColumns(userPairs: matched + [pair], mistakes: mistakes))
    } else {
      mistakes += 1
      lastMiss = index
      if !matched.isEmpty {
        context.select(.matchColumns(userPairs: matched, mistakes: mistakes))
      }
    }
  }
}
