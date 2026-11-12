import SwiftUI

/// What an About you screen shows beyond its answer, from where it's opened.
struct ProfileScreenContext {
  /// Onboarding's "About you · 4 of 10".
  var eyebrow: String?
  /// What helps: rows were checked for the conditions just picked.
  var prechecked = false
  /// Work: the job came from the goal's current-role answer.
  var jobFromEarlierAnswer = false
  /// Onboarding's skip button reads "I'd rather not say" and declines, so the screen has no row
  /// for it.
  var skipDeclines = false
  var memoryEnabled = true
}

/// One question's title and answer, shared by onboarding and Settings › About you, which add their
/// own buttons.
struct ProfileQuestionSections: View {
  let view: ProfileQuestionView
  let context: ProfileScreenContext
  @Binding var draft: ProfileDraft

  /// A fourth chip was tapped.
  @State private var capped = false
  @State private var opensNote = false
  /// Something else was just picked, so its words, now required, take focus as its field appears.
  @State private var asksOther = false
  @FocusState private var otherFocused: Bool

  var body: some View {
    StepHeader(
      subject: context.eyebrow, title: ProfileCopy.title(view.id),
      description: ProfileCopy.description(view.id))

    Group {
      switch view.id {
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
      case .tools, .watch, .listen, .play, .read, .activities:
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
              text: limited($draft.text, to: 80))

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

      if !context.skipDeclines {
        declineRow(.ratherNotSay)
      }
    }
  }

  @ViewBuilder private var interests: some View {
    Section {
      chips
    } footer: {
      capLine
    }

    Section {
      LabeledField(
        label: ProfileCopy.favoritesLabel(view.id), prompt: ProfileCopy.favoritesPrompt(view.id),
        text: limited($draft.text, to: 120))
    }

    Section {
      declineChip(.noneOfThese)
    }
  }

  @ViewBuilder private var studies: some View {
    Section {
      chips
      declineChip(.noneOfThese)
    } footer: {
      capLine
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
            text: limited(subject(option.id), to: 80))
        }
      }
    }
  }

  @ViewBuilder private var conditions: some View {
    Section {
      ForEach(view.options, id: \.id) { option in
        ProfileRow(
          label: Text(option.label), detail: option.description.map { Text($0) },
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
            prompt: nil, text: limited($draft.text, to: 120)
          )
          .focused($otherFocused)
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
          label: Text(option.label), detail: option.description.map { Text($0) },
          isOn: draft.picks.contains(option.id)
        ) {
          draft.toggle(option.id)
        }
      }

      declineRow(.noneOfThese)
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
            text: limited($draft.text, to: 300))
        } else {
          Button {
            opensNote = true
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
            Text(
              "We'll remember this for your buddy. You can delete it in Memory.",
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
          capped = !draft.toggle(option.id)

          if capped {
            announcePolitely(capLimit)
          }
        }
      }
    }
    .listRowSeparator(.hidden)
  }

  @ViewBuilder private var capLine: some View {
    if capped {
      SectionFooter {
        Text(capLimit)
      }
    }
  }

  private var capLimit: String {
    String(
      localized: "Pick up to 3.", table: "AboutYou",
      comment: "Said when a fourth choice is tapped on a screen that takes three")
  }

  private func declineChip(_ decline: ProfileDraft.Decline) -> some View {
    ProfileChip(label: ProfileCopy.decline(view.id, decline), isOn: draft.decline == decline) {
      capped = false
      draft.toggle(decline)
    }
    .listRowSeparator(.hidden)
  }

  private func declineRow(_ decline: ProfileDraft.Decline) -> some View {
    ProfileRow(label: ProfileCopy.decline(view.id, decline), isOn: draft.decline == decline) {
      draft.toggle(decline)
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

/// Fields show their limits by taking no more.
private func limited(_ text: Binding<String>, to limit: Int) -> Binding<String> {
  Binding {
    text.wrappedValue
  } set: {
    text.wrappedValue = String($0.prefix(limit))
  }
}

/// A text chip, its check and ink ring on its tint once picked.
private struct ProfileChip: View {
  let label: Text
  let isOn: Bool
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      HStack(spacing: 4) {
        if isOn {
          Image(systemName: "checkmark")
            .fontWeight(.semibold)
            .accessibilityHidden(true)
        }

        label
          .multilineTextAlignment(.leading)
      }
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

/// A selection row: its label, an optional line under it, and a check once picked.
private struct ProfileRow: View {
  let label: Text
  var detail: Text?
  let isOn: Bool
  let action: () -> Void

  var body: some View {
    Button(action: action) {
      HStack {
        VStack(alignment: .leading, spacing: 2) {
          label
            .foregroundStyle(.primary)

          if let detail {
            detail
              .typeStyle(.note)
              .foregroundStyle(.mutedForeground)
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)

        if isOn {
          Image(systemName: "checkmark")
            .fontWeight(.semibold)
            .foregroundStyle(.tint)
            .accessibilityHidden(true)
        }
      }
      .contentShape(.rect)
    }
    .accessibilityAddTraits(isOn ? .isSelected : [])
  }
}

/// The screens' copy. Option labels come from core, in the learner's language.
enum ProfileCopy {
  static func title(_ question: ProfileQuestion) -> Text {
    switch question {
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

  static func description(_ question: ProfileQuestion) -> Text {
    switch question {
    case .addressForm:
      Text(
        "Your buddy and your feedback will talk to you this way. Lessons stay the same.",
        tableName: "AboutYou", comment: "Under How should we address you?")
    case .work:
      Text(
        "We'll use situations from your day in your examples.", tableName: "AboutYou",
        comment: "Under What do you do now?")
    case .tools:
      Text(
        "Pick up to 3. We'll use them in your examples.", tableName: "AboutYou",
        comment: "Under the apps and tools question")
    case .studies:
      Text(
        "Past or present, finished or not. It can be different from your work.",
        tableName: "AboutYou", comment: "Under What have you studied?")
    case .watch, .listen, .play, .read, .activities:
      Text(
        "Pick up to 3. We'll use them for examples in your lessons.", tableName: "AboutYou",
        comment: "Under the questions about what the learner likes")
    case .conditions:
      Text(
        "Optional. What you pick is saved to your profile so your buddy can adapt to you. You can remove it anytime in Settings.",
        tableName: "AboutYou", comment: "Under the conditions question")
    case .learningSupport:
      Text(
        "Pick anything that helps. No label or diagnosis needed.", tableName: "AboutYou",
        comment: "Under What helps you learn?")
    }
  }

  static func decline(_ question: ProfileQuestion, _ decline: ProfileDraft.Decline) -> Text {
    switch (question, decline) {
    case (_, .ratherNotSay):
      Text("I'd rather not say", tableName: "AboutYou", comment: "Declines an About you question")
    case (.studies, .noneOfThese):
      Text("Nothing to add", tableName: "AboutYou", comment: "Declines What have you studied?")
    case (.learningSupport, .noneOfThese):
      Text(
        "Nothing in particular", tableName: "AboutYou", comment: "Declines What helps you learn?")
    case (_, .noneOfThese):
      Text("None of these", tableName: "AboutYou", comment: "Declines an About you question")
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
      Text("E.g., Star Trek, Flamengo", tableName: "AboutYou", comment: "Example shows and teams")
    case .listen:
      Text(
        "E.g., Coldplay, Radiolab", tableName: "AboutYou", comment: "Example artists and podcasts")
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

/// An About you question during onboarding: Skip leaves it for the next goal, and lesson 1 can
/// start from it once it's ready.
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

    QuestionForm {
      ProfileQuestionSections(view: question, context: context, draft: $draft)
    } buttons: {
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
            (hasAnswer
              ? Text(
                "Save and start lesson 1", tableName: "AboutYou",
                comment: "Saves the About you answer, then opens the goal's first lesson")
              : Text(
                "Start lesson 1", tableName: "AboutYou",
                comment: "Opens the goal's first lesson from an About you question"))
              .underline()
          }
          .buttonStyle(.plain)
          .foregroundStyle(Color(.foreground))
          .disabled(isSaving)
        }
        .typeStyle(.note)
        .frame(maxWidth: .infinity, alignment: .leading)
      }

      StepButtons(
        canContinue: hasAnswer,
        skipLabel: context.skipDeclines ? ProfileCopy.decline(question.id, .ratherNotSay) : nil
      ) {
        keepConditions()
        onAnswer(draft.input)
      } onSkip: {
        if question.id == .conditions {
          onPickConditions([])
        }

        onAnswer(draft.skipInput)
      }
    }
    .sendsAnswer(isSaving: isSaving, failed: failed)
  }
}
