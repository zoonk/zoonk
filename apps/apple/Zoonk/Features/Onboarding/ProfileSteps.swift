import SwiftUI

/// What an About you screen shows beyond its answer, from where it's opened.
struct ProfileScreenContext {
  /// Onboarding's "About you".
  var eyebrow: String?
  /// What helps: rows were checked for the conditions just picked.
  var prechecked = false
  /// Work: the job came from the goal's current-role answer.
  var jobFromEarlierAnswer = false
  /// Onboarding's Skip declines the question, so the screen has no row that declines it.
  var skipDeclines = false
  var memoryEnabled = true
  /// Settings › About you, whose notes don't send the learner to Settings.
  var inSettings = false
}

/// One question's title and answer, shared by onboarding and Settings › About you, which add their
/// own buttons.
struct ProfileQuestionSections: View {
  let view: ProfileQuestionView
  let context: ProfileScreenContext
  @Binding var draft: ProfileDraft

  @State private var opensNote = false
  /// The note was just opened by its button, so its box takes focus as it appears, as main's does.
  @State private var asksNote = false
  @FocusState private var noteFocused: Bool
  /// Something else was just picked, so its words, now required, take focus as its field appears.
  @State private var asksOther = false
  @FocusState private var otherFocused: Bool
  @Environment(\.listScroll) private var scroll
  @State private var revealsFirstTool = false

  var body: some View {
    StepHeader(
      subject: context.eyebrow, title: ProfileCopy.title(view.id),
      description: ProfileCopy.description(view.id, inSettings: context.inSettings))

    Group {
      switch view.id {
      case .unrecognized: EmptyView()
      case .addressForm:
        addressForm
      case .work:
        work
      case .studies:
        studies
      case .conditions:
        conditions
      case .learningSupport:
        learningSupport
      case .tools:
        tools
      case .watch, .listen, .play, .read, .activities:
        interests
      }
    }
    .locksWhileSaving()
  }

  // MARK: Questions

  @ViewBuilder private var work: some View {
    Section {
      ForEach(view.options, id: \.id) { option in
        ProfileRow(label: Text(option.label), isOn: draft.picks == [option.id]) {
          draft.toggle(option.id)
        }

        if draft.picks == [option.id], draft.asksJob {
          VStack(alignment: .leading, spacing: 4) {
            LabeledField(
              label: Text(
                "Your job (optional)", tableName: "AboutYou",
                comment: "Box for the learner's job, under I work"),
              prompt: Text(
                "E.g., software engineer, nurse", tableName: "AboutYou",
                comment: "Example jobs"),
              text: $draft.text, limit: 80, multiline: false)

            if context.jobFromEarlierAnswer {
              Text(
                "From your earlier answer", tableName: "AboutYou",
                comment: "Under a job filled in from the goal's questions"
              )
              .typeStyle(.note)
              .foregroundStyle(.mutedForeground)
            }
          }
        }
      }

      declineRow(.ratherNotSay)
    }
  }

  private var addressForm: some View {
    Section {
      ForEach(view.options, id: \.id) { option in
        ProfileRow(
          label: Text(option.label), detail: option.description.map { Text($0) },
          isOn: draft.picks == [option.id]
        ) {
          draft.toggle(option.id)
        }
      }

      declineRow(.ratherNotSay)
    }
  }

  @ViewBuilder private var interests: some View {
    Section {
      chips
    }

    Section {
      LabeledField(
        label: ProfileCopy.favoritesLabel(view.id), prompt: ProfileCopy.favoritesPrompt(view.id),
        text: $draft.text, limit: ProfileDraft.favoritesLimit, multiline: false)
    }
  }

  /// Typed tools become chips under the field, so adding one moves nothing above it. Each one added
  /// scrolls into view over the keyboard and the bar.
  @ViewBuilder private var tools: some View {
    Section {
      chips
    }

    Section {
      ToolField(
        label: ProfileCopy.favoritesLabel(view.id), prompt: ProfileCopy.favoritesPrompt(view.id),
        draft: $draft
      )
      // Main's 12pt between the field and its chips, with the field's own 6pt under it.
      .listRowInsets(.bottom, 6)

      if !draft.typedTools.isEmpty {
        FlowLayout(spacing: 8) {
          ForEach(draft.typedTools, id: \.self) { name in
            TypedToolChip(name: name) {
              draft.removeTypedTool(name)
            }
          }
        }
        .listRowInsets(.top, 0)
        .listRowSeparator(.hidden)
        .id(Self.typedToolsRow)
        .onAppear {
          if revealsFirstTool {
            revealsFirstTool = false
            revealTypedTools()
          }
        }
      }
    }
    .onChange(of: draft.typedTools.count) { added, count in
      if added == 0, count > 0 {
        // The chips' row appears with the first one, and can be scrolled to only then.
        revealsFirstTool = true
      } else if count > added {
        revealTypedTools()
      }
    }
  }

  private static let typedToolsRow = "typedTools"

  /// Once the new chip is laid out, and again once Return's new line, which grows the field until
  /// the add empties it, has left: the list's layout of that can undo the first scroll.
  private func revealTypedTools() {
    Task {
      scroll?.scrollTo(Self.typedToolsRow)
      try? await Task.sleep(for: .milliseconds(400))
      scroll?.scrollTo(Self.typedToolsRow)
    }
  }

  @ViewBuilder private var studies: some View {
    Section {
      chips
    }

    let picked = draft.picks.compactMap { id in view.options.first { $0.id == id } }

    if !picked.isEmpty {
      Section {
        ForEach(picked, id: \.id) { option in
          LabeledField(
            label: option.id == ProfileDraft.otherOption
              ? Text(
                "Which field?", tableName: "AboutYou", comment: "Box naming another field studied")
              : Text(
                "\(option.label): course or subject (optional)", tableName: "AboutYou",
                comment:
                  "Box for the course or subject studied in a field, like journalism in Media"),
            prompt: option.id == ProfileDraft.otherOption
              ? nil
              : Text(
                "E.g., journalism", tableName: "AboutYou", comment: "Example subject studied"),
            text: subject(option.id), limit: 80, multiline: false)
        }
      }
    }
  }

  @ViewBuilder private var conditions: some View {
    Section {
      ForEach(view.options, id: \.id) { option in
        ProfileRow(
          label: Text(option.label), detail: option.description.map { Text($0) }, picks: .several,
          isOn: draft.picks.contains(option.id)
        ) {
          draft.toggle(option.id)
          asksOther =
            option.id == ProfileDraft.otherOption && draft.picks.contains(option.id)
            && draft.text.isEmpty
        }

        if option.id == ProfileDraft.otherOption, draft.picks.contains(option.id) {
          LabeledField(
            label: Text(
              "What should we know?", tableName: "AboutYou",
              comment: "Box for a condition the list doesn't name, in the learner's words"),
            prompt: nil, text: $draft.text, limit: 120, multiline: false, focus: $otherFocused
          )
          .onAppear {
            if asksOther {
              otherFocused = true
              asksOther = false
            }
          }
        }
      }
    }
  }

  @ViewBuilder private var learningSupport: some View {
    Section {
      if context.prechecked {
        Text(
          "We checked what often helps with what you picked. Change anything you like.",
          tableName: "AboutYou",
          comment: "Over the rows checked for the conditions picked on the screen before"
        )
        .typeStyle(.note)
        .foregroundStyle(.mutedForeground)
      }

      ForEach(view.options, id: \.id) { option in
        ProfileRow(
          label: Text(option.label), detail: option.description.map { Text($0) }, picks: .several,
          isOn: draft.picks.contains(option.id)
        ) {
          draft.toggle(option.id)
        }
      }
    }

    if context.memoryEnabled {
      Section {
        if opensNote || !draft.text.isEmpty {
          LabeledField(
            label: Text(
              "What helps you, in your words (optional)", tableName: "AboutYou",
              comment: "Box for what helps the learner learn"),
            prompt: Text(
              "E.g., I understand diagrams better than text", tableName: "AboutYou",
              comment: "Example of what helps someone learn"),
            text: $draft.text, limit: MemoryFact.statementLimit, focus: $noteFocused
          )
          .onAppear {
            if asksNote {
              noteFocused = true
              asksNote = false
            }
          }
        } else {
          Button {
            opensNote = true
            asksNote = true
          } label: {
            Label {
              Text(
                "Something else that helps", tableName: "AboutYou",
                comment: "Opens a box to say what helps in the learner's words")
            } icon: {
              Image(systemName: "plus")
            }
          }
        }
      } footer: {
        if opensNote || !draft.text.isEmpty {
          SectionFooter {
            context.inSettings
              ? Text("We'll remember this. You can delete it anytime.", tableName: "AboutYou")
              : Text(
                "We'll remember this. You can delete it anytime in Settings.",
                tableName: "AboutYou", comment: "Under the box for what helps the learner learn")
          }
        }
      }
    }
  }

  // MARK: Parts

  private var chips: some View {
    FlowLayout(spacing: 8) {
      ForEach(view.options, id: \.id) { option in
        ProfileChip(label: Text(option.label), isOn: draft.picks.contains(option.id)) {
          draft.toggle(option.id)
        }
      }
    }
    .listRowSeparator(.hidden)
  }

  /// Onboarding declines through its Skip, so only Settings shows the row: on a pick-one question
  /// it's the only way to take a pick back. A question with several picks declines by saving none.
  @ViewBuilder
  private func declineRow(_ decline: ProfileDraft.Decline) -> some View {
    if !context.skipDeclines {
      ProfileRow(label: ProfileCopy.decline(view.id, decline), isOn: draft.decline == decline) {
        draft.toggle(decline)
      }
    }
  }

  private func subject(_ field: String) -> Binding<String> {
    Binding {
      draft.subjects[field] ?? ""
    } set: {
      draft.subjects[field] = $0
    }
  }
}

/// Main's profile chip: picked, its tint and ink line, so picking it never changes its width.
private struct ProfileChip<Label: View>: View {
  let label: Label
  let isOn: Bool
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      label
        .multilineTextAlignment(.leading)
        .typeStyle(.body)
        .foregroundStyle(Color(.foreground))
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .frame(minHeight: 44)
        .answerSurface(isOn ? .picked : .idle, cornerRadius: Radius.md)
    }
    .buttonStyle(.plain)
    .accessibilityAddTraits(isOn ? .isSelected : [])
  }
}

/// A typed tool: a picked chip that removes it when tapped.
private struct TypedToolChip: View {
  let name: String
  let remove: () -> Void

  var body: some View {
    ProfileChip(
      label: HStack(spacing: 6) {
        Text(verbatim: name)
        Image(systemName: "xmark")
          .imageScale(.small)
          .fontWeight(.semibold)
      },
      isOn: true, action: remove
    )
    .accessibilityLabel(
      Text("Remove \(name)", tableName: "AboutYou", comment: "Removes a tool the learner typed")
    )
    .accessibilityRemoveTraits(.isSelected)
  }
}

/// The tools field with its Add button. Add, Return, a comma or a semicolon turn what's typed into
/// chips, and the field keeps focus for the next one. Return with nothing typed puts the keyboard
/// away.
private struct ToolField: View {
  let label: Text
  let prompt: Text
  @Binding var draft: ProfileDraft

  @FocusState private var isFocused: Bool

  var body: some View {
    FormField(title: label, isFocused: isFocused) {
      HStack(spacing: 8) {
        MultilineTextField(
          text: $draft.text, prompt: prompt, label: label,
          onSubmit: {
            if ProfileDraft.favorites(in: draft.text).isEmpty {
              isFocused = false
            } else {
              draft.addTypedTools()
            }
          }
        )
        .focused($isFocused)
        .onChange(of: draft.text) { old, _ in
          draft.settleToolText(from: old)
        }

        Button {
          draft.addTypedTools()
        } label: {
          Text("Add", tableName: "AboutYou", comment: "Adds the tool typed in the box as a chip")
        }
        .buttonStyle(.ghost)
        .controlSize(.small)
        .disabled(!draft.canAddTypedTools)
      }
    }
  }
}

/// A selection row: its label, an optional line under it, and a check once picked.
private struct ProfileRow: View {
  let label: Text
  var detail: Text?
  var picks: ChoiceMark.Kind = .one
  let isOn: Bool
  let action: () -> Void

  var body: some View {
    ChoiceRow(label, detail: detail, picks: picks, isPicked: isOn, action: action)
  }
}

/// The screens' copy. Option labels come from core, in the learner's language.
enum ProfileCopy {
  static func title(_ question: ProfileQuestion) -> Text {
    switch question {
    case .unrecognized: Text(verbatim: "")
    case .addressForm:
      Text(
        "How should we address you?", tableName: "AboutYou",
        comment:
          "About you question: which grammatical forms (feminine, masculine or neutral wording) the app uses for words about the learner, such as 'you're right'. Not a question about pronouns or identity. Translate as a natural, friendly question."
      )
    case .work:
      Text("What do you do now?", tableName: "AboutYou", comment: "About you question")
    case .tools:
      Text(
        "Which apps and tools do you use most?", tableName: "AboutYou",
        comment: "About you question")
    case .studies:
      Text("What have you studied?", tableName: "AboutYou", comment: "About you question")
    case .watch:
      Text("What do you like to watch?", tableName: "AboutYou", comment: "About you question")
    case .listen:
      Text("What do you like to listen to?", tableName: "AboutYou", comment: "About you question")
    case .play:
      Text(
        "What do you like to play?", tableName: "AboutYou",
        comment: "About you question: sports and games, not instruments")
    case .read:
      Text("What do you like to read?", tableName: "AboutYou", comment: "About you question")
    case .activities:
      Text("What do you like to do?", tableName: "AboutYou", comment: "About you question")
    case .conditions:
      Text(
        "Do any of these apply to you?", tableName: "AboutYou",
        comment: "About you question about health conditions")
    case .learningSupport:
      Text("What helps you learn?", tableName: "AboutYou", comment: "About you question")
    }
  }

  /// Shown before the learner has met their buddy, so it says "we".
  static func description(_ question: ProfileQuestion, inSettings: Bool) -> Text? {
    switch question {
    case .unrecognized: nil
    case .addressForm, .tools, .watch, .listen, .play, .read, .activities:
      nil
    case .work:
      Text(
        "We use this to pick examples you'll care about.", tableName: "AboutYou",
        comment: "Under What do you do now?")
    case .studies:
      Text(
        "Past or present, finished or not.", tableName: "AboutYou",
        comment: "Under What have you studied?")
    case .conditions:
      inSettings
        ? Text(
          "Optional. We use what you pick to adapt the content to your needs. You can remove it anytime.",
          tableName: "AboutYou")
        : Text(
          "Optional. We use what you pick to adapt the content to your needs. You can remove it anytime in Settings.",
          tableName: "AboutYou", comment: "Under the conditions question")
    case .learningSupport:
      Text(
        "Pick anything that helps.", tableName: "AboutYou", comment: "Under What helps you learn?")
    }
  }

  static func decline(_ question: ProfileQuestion, _ decline: ProfileDraft.Decline) -> Text {
    switch decline {
    case .ratherNotSay:
      Text("I'd rather not say", tableName: "AboutYou", comment: "Declines an About you question")
    }
  }

  static func favoritesLabel(_ question: ProfileQuestion) -> Text {
    switch question {
    case .tools:
      Text("Others (optional)", tableName: "AboutYou", comment: "Box for other apps and tools")
    case .watch:
      Text(
        "Favorite shows, films, teams or channels (optional)", tableName: "AboutYou",
        comment: "Box for favorites to watch")
    case .listen:
      Text(
        "Favorite artists or podcasts (optional)", tableName: "AboutYou",
        comment: "Box for favorites to listen to")
    case .play:
      Text("Favorite games (optional)", tableName: "AboutYou", comment: "Box for favorite games")
    case .read:
      Text(
        "Favorite books, writers or sites (optional)", tableName: "AboutYou",
        comment: "Box for favorites to read")
    default:
      Text(
        "Anything else you're into? (optional)", tableName: "AboutYou",
        comment: "Box for other things the learner likes to do")
    }
  }

  static func favoritesPrompt(_ question: ProfileQuestion) -> Text {
    switch question {
    case .tools:
      Text("E.g., Photoshop, Python, SAP", tableName: "AboutYou", comment: "Example tools")
    case .watch:
      Text(
        "E.g., Star Trek, Formula 1", tableName: "AboutYou",
        comment: "Example shows and sports, known in every country")
    case .listen:
      Text(
        "E.g., Coldplay, TED Talks Daily", tableName: "AboutYou",
        comment: "Example artists and podcasts, known in every country")
    case .play:
      Text("E.g., Catan, Valorant", tableName: "AboutYou", comment: "Example games")
    case .read:
      Text("E.g., Dune, The Economist", tableName: "AboutYou", comment: "Example books and sites")
    default:
      Text(
        "E.g., baking bread, cars, astronomy", tableName: "AboutYou",
        comment: "Example things someone likes to do")
    }
  }
}

/// An About you question during onboarding: Skip declines it, so the next goal doesn't ask it again,
/// and lesson 1 can start from it once it's ready.
struct ProfileStep: View {
  let view: GoalOnboarding
  let question: ProfileQuestionView
  let context: ProfileScreenContext
  let isSaving: Bool
  let failed: Bool
  let onAnswer: ([String: Any]) -> Void
  /// Saves the answer, then opens lesson 1; nil starts it without saving.
  let onStartLesson: ([String: Any]?) -> Void
  /// The conditions Continue leaves for the screen after to check what helps.
  let onPickConditions: ([String]) -> Void

  @State private var draft: ProfileDraft

  init(
    view: GoalOnboarding, question: ProfileQuestionView, context: ProfileScreenContext,
    draft: ProfileDraft, isSaving: Bool, failed: Bool,
    onAnswer: @escaping ([String: Any]) -> Void,
    onStartLesson: @escaping ([String: Any]?) -> Void,
    onPickConditions: @escaping ([String]) -> Void
  ) {
    self.view = view
    self.question = question
    self.context = context
    self.isSaving = isSaving
    self.failed = failed
    self.onAnswer = onAnswer
    self.onStartLesson = onStartLesson
    self.onPickConditions = onPickConditions
    _draft = State(initialValue: draft)
  }

  private func keepConditions() {
    if question.id == .conditions {
      onPickConditions(draft.picks)
    }
  }

  var body: some View {
    let hasAnswer = !draft.isEmpty && draft.isComplete
    let continueWithAnswer = {
      keepConditions()
      onAnswer(draft.input)
    }

    QuestionForm {
      ProfileQuestionSections(view: question, context: context, draft: $draft)
        .onSubmit {
          if hasAnswer, !isSaving {
            continueWithAnswer()
          }
        }

      if view.firstLesson?.status == .ready {
        FlowLayout(spacing: 8, alignment: .firstTextBaseline) {
          Text("Lesson 1 is ready.", tableName: "AboutYou", comment: "Over an About you question")
            .foregroundStyle(.mutedForeground)

          Button {
            if hasAnswer {
              keepConditions()
            }

            onStartLesson(hasAnswer ? draft.input : nil)
          } label: {
            Label {
              Text(
                "Start", tableName: "AboutYou",
                comment:
                  "Opens the goal's first lesson from an About you question, saving its answer first"
              )
              .underline()
            } icon: {
              Image(systemName: "chevron.forward")
            }
            .labelStyle(.trailingIcon)
          }
          .buttonStyle(.plain)
          .controlSize(.small)
          .foregroundStyle(Color(.foreground))
          .disabled(isSaving)
        }
        .typeStyle(.note)
        .frame(maxWidth: .infinity, alignment: .leading)
        .listRowSeparator(.hidden)
      }
    } buttons: {
      StepButtons(
        canContinue: hasAnswer,
        skipLabel: question.id == .addressForm
          ? ProfileCopy.decline(question.id, .ratherNotSay) : nil,
        onContinue: continueWithAnswer
      ) {
        if question.id == .conditions {
          onPickConditions([])
        }

        onAnswer(draft.skipInput)
      }
    }
    .sendsAnswer(isSaving: isSaving, failed: failed)
  }
}
