import SwiftUI

struct LessonOption: Identifiable, Hashable {
  let id: String
  let text: String
  var detail: String?
  var isCorrect: Bool?
  /// A picture option's description, shown with its text until its picture is drawn.
  var pictureAlt: String?
  var picture: LessonStepImage?
}

/// Main's `PlayerChoiceSceneOptions`: number keys pick them on a hardware keyboard, and once
/// checked only the right option and a wrong pick stay, unless it was a guess.
struct LessonOptionList: View {
  @Environment(\.lessonScreenHeight) private var screenHeight

  let options: [LessonOption]
  let selectedId: String?
  let isChecked: Bool
  let isLocked: Bool
  /// A guess is never wrong: a missed pick says "Your guess".
  var isGuess = false
  /// Picture options are still being drawn: a missing picture shows its placeholder.
  var picturesPending = false
  let select: (String) -> Void

  private var isPictureGrid: Bool {
    options.contains { $0.pictureAlt != nil }
  }

  private var shown: [(marker: Int, option: LessonOption)] {
    options.enumerated().compactMap { index, option in
      isChecked && result(option) == nil && !isGuess ? nil : (index + 1, option)
    }
  }

  var body: some View {
    if isPictureGrid {
      LazyVGrid(columns: [GridItem(.adaptive(minimum: 140), spacing: 10)], spacing: 10) {
        pictureButtons
      }
    } else {
      VStack(spacing: 10) {
        ForEach(shown, id: \.option.id) { marker, option in
          AnswerOption(
            marker: marker, isPicked: option.id == selectedId, result: result(option),
            isGuessed: isGuess, isLocked: isLocked || isChecked,
            text: LessonRichText.typeset(option.text), detail: option.detail
          ) {
            select(option.id)
          }
        }
      }
    }
  }

  private var pictureButtons: some View {
    ForEach(shown, id: \.option.id) { marker, option in
      Button {
        select(option.id)
      } label: {
        pictureLabel(option)
      }
      .buttonStyle(LessonOptionStyle(mark: mark(option)))
      .disabled(isLocked || isChecked)
      .modifier(NumberShortcut(index: marker - 1))
      .accessibilityAddTraits(option.id == selectedId ? .isSelected : [])
      .modifier(PictureOptionLabel(option: option, isPicture: true, isChecked: isChecked))
      .accessibilityValue(verdictValue(option))
    }
  }

  private func pictureLabel(_ option: LessonOption) -> some View {
    VStack(spacing: 8) {
      if let picture = option.picture {
        LessonPictureView(
          image: picture, alt: option.pictureAlt, isPending: false, asks: true,
          drawnAspectRatio: LessonPicturePlaceholder.optionAspectRatio)
      } else {
        LessonPicturePlaceholder(alt: option.pictureAlt, isDrawing: picturesPending)
          .pictureFrame(
            aspectRatio: LessonPicturePlaceholder.optionAspectRatio,
            maxHeight: LessonPictureFrame.question.maxHeight(screen: screenHeight))
      }

      // Its name would give the answer away, so it shows once the answer is checked, as on main.
      if isChecked {
        HStack(alignment: .firstTextBaseline) {
          LessonRichText(option.text)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
          verdictSymbol(option)
        }
      }
    }
  }

  /// Decorative: the option's value says the verdict. A checkmark inside a button would also make
  /// VoiceOver call the right option "selected".
  @ViewBuilder
  private func verdictSymbol(_ option: LessonOption) -> some View {
    if let symbol = mark(option).symbol {
      Image(systemName: symbol)
        .accessibilityHidden(true)
    }
  }

  private func verdictValue(_ option: LessonOption) -> Text {
    switch mark(option) {
    case .right:
      Text("Correct answer", tableName: "Player", comment: "Before the right answer after a miss")
    case .wrong:
      Text(
        "Your answer", tableName: "Player",
        comment: "VoiceOver value of the option the learner picked, which was wrong")
    default:
      Text(verbatim: "")
    }
  }

  /// Main's `getOptionResult`.
  private func result(_ option: LessonOption) -> AnswerOptionResult? {
    guard isChecked else {
      return nil
    }

    if option.isCorrect == true {
      return .right
    }

    guard option.id == selectedId else {
      return nil
    }

    return isGuess ? .guess : .wrong
  }

  private func mark(_ option: LessonOption) -> LessonOptionStyle.Mark {
    switch result(option) {
    case .right: .right
    case .wrong: .wrong
    case .guess: .guess
    case nil: option.id == selectedId ? .selected : .plain
    }
  }
}

/// Before the check VoiceOver hears what a picture option shows, not its name.
private struct PictureOptionLabel: ViewModifier {
  let option: LessonOption
  let isPicture: Bool
  let isChecked: Bool

  func body(content: Content) -> some View {
    if isPicture {
      let spoken = LessonRichText.spoken(option.text)
      content.accessibilityLabel(
        Text(verbatim: isChecked ? spoken : option.pictureAlt ?? spoken))
    } else {
      content
    }
  }
}

struct NumberShortcut: ViewModifier {
  let index: Int

  func body(content: Content) -> some View {
    if index < 9, let key = "\(index + 1)".first {
      content.keyboardShortcut(KeyEquivalent(key), modifiers: [])
    } else {
      content
    }
  }
}

struct LessonOptionStyle: ButtonStyle {
  enum Mark {
    case plain, selected, guess, right, wrong

    var symbol: String? {
      switch self {
      case .right: "checkmark"
      case .wrong: "xmark"
      default: nil
      }
    }
  }

  let mark: Mark

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .typeStyle(.button)
      .foregroundStyle(foreground)
      .multilineTextAlignment(.leading)
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding(.horizontal, 14)
      .padding(.vertical, 12)
      .answerSurface(tone, isPressed: configuration.isPressed)
  }

  private var foreground: Color {
    switch mark {
    case .right: .successText
    case .wrong: .destructiveText
    default: Color(.foreground)
    }
  }

  private var tone: AnswerTone {
    switch mark {
    case .selected: .picked
    case .guess: .guess
    case .right: .right
    case .wrong: .wrong
    case .plain: .idle
    }
  }
}

struct LessonWordTile: View {
  let word: String
  var romanization: String?
  let isUsed: Bool
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      VStack(spacing: 0) {
        Text(word)
        if let romanization {
          Text(romanization)
            .typeStyle(.meta)
            .foregroundStyle(.mutedForeground)
        }
      }
    }
    .buttonStyle(.outline)
    .opacity(isUsed ? 0.3 : 1)
    .disabled(isUsed)
  }
}
