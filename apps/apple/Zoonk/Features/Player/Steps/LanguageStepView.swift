import SwiftUI

/// Language practice: a word or a letter to learn, and exercises that build or pick an answer. The
/// screen is what to answer; the turn is the options, blanks, word bank or columns.
struct LanguageStepView: View {
  let exercise: LanguageExercise
  let wordHints: WordHints?
  let context: LessonStepContext
  let part: LessonStepPart

  var body: some View {
    switch (exercise.kind, part) {
    case (.vocabulary, .screen):
      VocabularyView(exercise: exercise, wordHints: wordHints)
    case (.alphabet, .screen):
      AlphabetView(content: exercise.content)
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

/// Plays a recording when there is one.
struct LessonAudioButton: View {
  @Environment(\.lessonAudio) private var audio

  let url: String?

  var body: some View {
    if let url = url.flatMap(URL.init(string:)) {
      Button {
        Task { await audio.play(url) }
      } label: {
        Label {
          Text("Play", tableName: "Player", comment: "Plays a word's or sentence's sound")
        } icon: {
          Image(systemName: "speaker.wave.2.fill")
        }
        .labelStyle(.iconOnly)
      }
      .buttonStyle(.bordered)
      .buttonBorderShape(.circle)
      .controlSize(.large)
    }
  }
}

private struct VocabularyView: View {
  let exercise: LanguageExercise
  let wordHints: WordHints?

  var body: some View {
    if let word = exercise.word {
      ScreenChip(
        text: Text("Vocabulary", tableName: "Player", comment: "Label above a word to learn"))

      HStack(alignment: .center, spacing: 16) {
        VStack(alignment: .leading, spacing: 4) {
          Text(word.word)
            .font(.largeTitle.weight(.semibold))
          if let romanization = word.romanization {
            Text(romanization).foregroundStyle(.secondary)
          }
          if let pronunciation = word.pronunciation {
            Text(pronunciation).font(.callout).foregroundStyle(.secondary)
          }
        }
        Spacer(minLength: 0)
        LessonAudioButton(url: word.audioUrl)
      }

      Text(word.translation)
        .font(.title3)

      if let note = wordHints?.note {
        VStack(alignment: .leading, spacing: 2) {
          Text("Usage:", tableName: "Player", comment: "Before a word's usage note")
            .font(.caption.weight(.medium)).foregroundStyle(.secondary)
          Text(note)
        }
      }

      if let tip = wordHints?.pronunciationTip {
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
}

private struct AlphabetView: View {
  let content: LanguageExercise.Content

  var body: some View {
    ScreenChip(
      text: Text("Alphabet", tableName: "Player", comment: "Label above a letter to learn"))

    HStack(alignment: .center, spacing: 16) {
      Text(content.symbol ?? "")
        .font(.system(.largeTitle, design: .default).weight(.semibold))
        .dynamicTypeSize(...DynamicTypeSize.accessibility5)
        .scaleEffect(1.6, anchor: .leading)
        .padding(.trailing, 24)
      VStack(alignment: .leading, spacing: 4) {
        if let readingAid = content.readingAid {
          Text(readingAid).font(.title3.weight(.medium))
        }
        if let pronunciation = content.pronunciation {
          Text(pronunciation).foregroundStyle(.secondary)
        }
      }
      Spacer(minLength: 0)
      LessonAudioButton(url: content.audioUrl)
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

      if let url = exercise.translationOptions.first(where: { $0.id == id })?.audioUrl.flatMap(
        URL.init(string:))
      {
        Task { await audio.play(url) }
      }
    }
  }
}

/// A sentence with blanks, filled from a word bank: a tile fills the first empty blank, and a
/// filled blank empties on a tap.
private struct FillBlankView: View {
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
    FlowLayout(spacing: 8) {
      ForEach(Array(segments.enumerated()), id: \.offset) { index, segment in
        if !segment.isEmpty {
          Text(segment.trimmingCharacters(in: .whitespaces))
            .font(.title3)
        }

        if index < blanks.count {
          blank(index)
        }
      }
    }

    FlowLayout(spacing: 8) {
      ForEach(Array(exercise.fillBlankOptions.enumerated()), id: \.offset) { _, option in
        LessonWordTile(
          word: option.word, romanization: option.romanization,
          isUsed: blanks.filter { $0 == option.word }.count
            >= exercise.fillBlankOptions.filter { $0.word == option.word }.count
            || context.isLocked
        ) {
          fill(option.word)
        }
      }
    }
    .accessibilityElement(children: .contain)
    .accessibilityLabel(
      Text("Word bank", tableName: "Player", comment: "The words to build an answer from"))
  }

  private func blank(_ index: Int) -> some View {
    let word = blanks[index]
    let isRight = context.result.map { _ in
      (exercise.content.answers ?? []).indices.contains(index)
        && exercise.content.answers?[index].lowercased() == word.lowercased()
    }

    return Button {
      var answers = blanks
      answers[index] = ""
      context.select(answers.allSatisfy(\.isEmpty) ? nil : .fillBlank(userAnswers: answers))
    } label: {
      Text(word.isEmpty ? "      " : word)
        .font(.title3.weight(.medium))
        .padding(.horizontal, 6)
        .overlay(alignment: .bottom) {
          Rectangle().frame(height: 2).foregroundStyle(
            isRight.map { $0 ? Color.success : .destructive } ?? .secondary)
        }
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

  private func fill(_ word: String) {
    var answers = blanks

    guard let empty = answers.firstIndex(of: "") else {
      return
    }

    answers[empty] = word
    context.select(.fillBlank(userAnswers: answers))
  }
}

/// Reading (translate the sentence by arranging its words) and listening (arrange what you hear).
private struct ArrangeWordsView: View {
  let exercise: LanguageExercise
  let context: LessonStepContext
  let part: LessonStepPart

  private var isListening: Bool { exercise.kind == .listening }

  private var arranged: [Int] {
    guard let words = arrangedWords else {
      return []
    }

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
        LessonAudioButton(url: sentence.audioUrl)
        if sentence.audioUrl == nil {
          LessonQuestionText(text: sentence.sentence)
        }
      }
    } else {
      ScreenChip(
        text: Text(
          "Translate", tableName: "Player", comment: "Label above a word or sentence to translate"
        ))
      LessonQuestionText(text: sentence.translation)
    }
  }

  @ViewBuilder
  private var turn: some View {
    FlowLayout(spacing: 8) {
      ForEach(arranged, id: \.self) { index in
        Button {
          set(arranged.filter { $0 != index })
        } label: {
          Text(exercise.wordBankOptions[index].word)
        }
        .buttonStyle(.bordered)
        .tint(context.result.map { $0.isCorrect ? .success : .destructive } ?? .primary)
        .disabled(context.isLocked)
      }
    }
    .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
    .padding(8)
    .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 16))

    FlowLayout(spacing: 8) {
      ForEach(exercise.wordBankOptions.indices, id: \.self) { index in
        LessonWordTile(
          word: exercise.wordBankOptions[index].word,
          romanization: exercise.wordBankOptions[index].romanization,
          isUsed: arranged.contains(index) || context.isLocked
        ) {
          set(arranged + [index])
        }
      }
    }
    .accessibilityElement(children: .contain)
    .accessibilityLabel(
      Text("Word bank", tableName: "Player", comment: "The words to build an answer from"))
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

/// Two columns to pair: a tap on each side makes a pair; a right pair locks, a wrong one counts as
/// a mistake. Check once every pair is matched.
private struct MatchColumnsView: View {
  @State private var pickedLeft: Int?
  @State private var mistakes = 0
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

  var body: some View {
    HStack(alignment: .top, spacing: 12) {
      VStack(spacing: 10) {
        ForEach(pairs.indices, id: \.self) { index in
          let isMatched = matched.contains { $0.left == pairs[index].left }
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
          let isMatched = matched.contains { $0.right == item }
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

    if pairs.contains(where: { $0.left == pair.left && $0.right == pair.right }) {
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

/// Lays tiles out in rows, wrapping to the width it gets.
struct FlowLayout: Layout {
  var spacing: CGFloat = 8

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let rows = arrange(subviews, width: proposal.width ?? .infinity)
    let width = rows.map { $0.width }.max() ?? 0
    let height = rows.reduce(0) { $0 + $1.height } + spacing * CGFloat(max(rows.count - 1, 0))
    return CGSize(width: min(width, proposal.width ?? width), height: height)
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
  ) {
    var y = bounds.minY

    for row in arrange(subviews, width: bounds.width) {
      var x = bounds.minX

      for index in row.indices {
        let size = subviews[index].sizeThatFits(.unspecified)
        subviews[index].place(
          at: CGPoint(x: x, y: y + (row.height - size.height) / 2), proposal: ProposedViewSize(size)
        )
        x += size.width + spacing
      }

      y += row.height + spacing
    }
  }

  private struct Row {
    var indices: [Int] = []
    var width: CGFloat = 0
    var height: CGFloat = 0
  }

  private func arrange(_ subviews: Subviews, width: CGFloat) -> [Row] {
    var rows: [Row] = []
    var row = Row()

    for index in subviews.indices {
      let size = subviews[index].sizeThatFits(.unspecified)
      let needed = row.indices.isEmpty ? size.width : row.width + spacing + size.width

      if needed > width, !row.indices.isEmpty {
        rows.append(row)
        row = Row()
      }

      row.width = row.indices.isEmpty ? size.width : row.width + spacing + size.width
      row.height = max(row.height, size.height)
      row.indices.append(index)
    }

    if !row.indices.isEmpty {
      rows.append(row)
    }

    return rows
  }
}
