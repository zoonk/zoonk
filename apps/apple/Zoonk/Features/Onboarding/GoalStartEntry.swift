import SwiftUI

/// "Start a goal" on Today, for a visitor or a learner without a goal: one box for the goal in the learner's own words, the paperclip for their own material, and examples that start it in one tap. Today embeds it inside its `List`; sending opens the start flow as a task, which reads the words right away (the tap is what starts it). A visitor becomes a guest when they send, as on main.
struct GoalStartEntry: View {
  /// The catalog's box under its title (main's `GoalForm` there): only the words and "Build my
  /// plan", since the courses below are its examples.
  var isBoxOnly = false

  @Environment(AppRouter.self) private var router
  @Environment(OnboardingStore.self) private var onboarding
  @State private var words = ""
  @State private var material: [AttachedSource] = []
  @State private var intent: MaterialIntent?

  var body: some View {
    GoalEntrySections(
      words: $words, isSection: !isBoxOnly, showsExamples: !isBoxOnly,
      canSubmitEmpty: !material.isEmpty && intent != nil,
      onSubmit: { goal in
        onboarding.send(SentGoal(words: goal, material: material, intent: intent))
        router.open(.startGoal())
      },
      attachment: {
        if !isBoxOnly {
          GoalMaterialSections(material: $material, intent: $intent)
        }
      })
  }
}

/// What Today's box sends to the start flow: the words, and the material attached with what to do with it.
struct SentGoal {
  let words: String
  var material: [AttachedSource] = []
  var intent: MaterialIntent?

  /// With material attached, what the learner chose to do with it decides: questions open answers from its pages, and a plan without words is read from its titles.
  var start: GoalStart {
    let withMaterial = material.isEmpty ? nil : intent

    if withMaterial == .questions {
      return .questions
    }

    return .goal(words.isEmpty ? materialGoal(exam: withMaterial == .exam) : words)
  }

  /// A goal in words for material attached without any: what to do with it, and its titles.
  private func materialGoal(exam: Bool) -> String {
    let titles = material.map { source in
      source.title.flatMap { $0.isEmpty ? nil : $0 }
        ?? String(
          localized: "my notes", table: "Onboarding",
          comment: "Pasted material without a title, inside a goal")
    }
    .joined(separator: ", ")

    return exam
      ? String(
        localized: "Prepare for an exam on my material: \(titles)", table: "Onboarding",
        comment: "A goal for an exam on the learner's material: its titles")
      : String(
        localized: "Understand my material: \(titles)", table: "Onboarding",
        comment: "A goal to understand the learner's material: its titles")
  }
}

/// Where sending the box goes: answers from the material, or a goal to read.
enum GoalStart: Equatable {
  case questions
  case goal(String)
}

/// The entry's sections, shared by Today's embed and the start flow's first screen: the box (with the start flow's material under it) and "Build my plan", what stops a goal (an error, or a limit said up front), then the examples.
struct GoalEntrySections<Attachment: View>: View {
  @Binding var words: String
  /// On Today, the box is the page's "Start a goal" section; the start flow has its own title.
  var isSection = false
  var showsExamples = true
  var error: GoalError?
  /// A goal limit Plus lifts, said before the learner types.
  var limit: GoalLimitReason?
  /// With material and what to do with it, the box may stay empty.
  var canSubmitEmpty = false
  let onSubmit: (String) -> Void
  /// Under the box: the start flow's material.
  @ViewBuilder var attachment: () -> Attachment

  @Environment(\.dynamicTypeSize) private var dynamicTypeSize
  @FocusState private var isFocused: Bool

  /// The same limit core applies to a typed goal.
  private var maxLength: Int { 2000 }

  var body: some View {
    if let limit {
      GoalLimitNoticeSection(reason: limit, upFront: true)
    }

    Section {
      let layout =
        dynamicTypeSize.isAccessibilitySize
        ? AnyLayout(VStackLayout(alignment: .leading))
        : AnyLayout(HStackLayout(alignment: .top))

      layout {
        Text(
          "I want to", tableName: "Onboarding",
          comment: "The goal box's label, before the learner's words"
        )
        .foregroundStyle(.secondary)
        .accessibilityHidden(true)

        TextField(text: $words, prompt: Text(placeholder), axis: .vertical) {
          Text(
            "I want to", tableName: "Onboarding",
            comment: "The goal box's label, before the learner's words")
        }
        .lineLimit(1...6)
        .focused($isFocused)
        .submitLabel(.send)
        .onSubmit(submit)
        .onChange(of: words) { _, value in
          if value.count > maxLength {
            words = String(value.prefix(maxLength))
          }

          // Return sends: a vertical field takes it as a new line otherwise.
          if value.hasSuffix("\n") {
            words = String(value.dropLast())
            submit()
          }
        }
      }
    } header: {
      if isSection {
        Text(
          "Start a goal", tableName: "Onboarding",
          comment: "Title of the section where a learner types a new goal")
      }
    }

    attachment()

    Section {
      Button(action: submit) {
        Text(
          "Build my plan", tableName: "Onboarding",
          comment: "Sends the typed goal to start building a plan"
        )
        .frame(maxWidth: .infinity)
      }
      .buttonStyle(.mainAction)
      .controlSize(.large)
      .keepsOffFold()
      .listRowInsets(EdgeInsets())
      .listRowBackground(Color.clear)
    }

    if let error {
      GoalErrorSection(error: error)
    }

    if showsExamples {
      examplesSection
    }
  }

  private var examplesSection: some View {
    Section {
      ForEach(examples, id: \.label.key) { example in
        Button {
          words = String(localized: example.label)
          onSubmit(words)
        } label: {
          VStack(alignment: .leading) {
            Text(example.label)
              .foregroundStyle(.primary)
            Text(example.kind)
              .font(.subheadline)
              .foregroundStyle(.secondary)
          }
        }
      }
    } header: {
      Text(
        "Examples", tableName: "Onboarding",
        comment: "Title of example goals that start onboarding in one tap")
    }
  }

  /// Never greyed out: with nothing to send, it puts the cursor in the box instead.
  private func submit() {
    let goal = words.trimmingCharacters(in: .whitespacesAndNewlines)

    guard !goal.isEmpty || canSubmitEmpty else {
      isFocused = true
      return
    }

    isFocused = false
    onSubmit(goal)
  }

  private var placeholder: LocalizedStringResource {
    let language = LocalExample.language

    return switch LocalExample.exam {
    case .abitur:
      LocalizedStringResource(
        "pass the Abitur, speak \(language)…", table: "Onboarding",
        comment: "Example goal in the empty goal box; the language is one the learner could speak")
    case .bac:
      LocalizedStringResource(
        "pass the bac, speak \(language)…", table: "Onboarding",
        comment: "Example goal in the empty goal box; the language is one the learner could speak")
    case .enem:
      LocalizedStringResource(
        "pass the ENEM, speak \(language)…", table: "Onboarding",
        comment: "Example goal in the empty goal box; the language is one the learner could speak")
    case .pau:
      LocalizedStringResource(
        "pass the PAU, speak \(language)…", table: "Onboarding",
        comment: "Example goal in the empty goal box; the language is one the learner could speak")
    case .sat:
      LocalizedStringResource(
        "pass the SAT, speak \(language)…", table: "Onboarding",
        comment: "Example goal in the empty goal box; the language is one the learner could speak")
    }
  }

  private var examples: [(label: LocalizedStringResource, kind: LocalizedStringResource)] {
    let exam: LocalizedStringResource =
      switch LocalExample.exam {
      case .abitur:
        LocalizedStringResource("Pass the Abitur", table: "Onboarding", comment: "An example goal")
      case .bac:
        LocalizedStringResource("Pass the bac", table: "Onboarding", comment: "An example goal")
      case .enem:
        LocalizedStringResource("Pass the ENEM", table: "Onboarding", comment: "An example goal")
      case .pau:
        LocalizedStringResource("Pass the PAU", table: "Onboarding", comment: "An example goal")
      case .sat:
        LocalizedStringResource("Pass the SAT", table: "Onboarding", comment: "An example goal")
      }

    return [
      (
        exam,
        LocalizedStringResource("Exam", table: "Onboarding", comment: "The kind of an example goal")
      ),
      (
        LocalizedStringResource(
          "Speak \(LocalExample.language) for a job interview", table: "Onboarding",
          comment: "An example goal; the language is one the learner could speak"),
        LocalizedStringResource(
          "Language", table: "Onboarding", comment: "The kind of an example goal")
      ),
      (
        LocalizedStringResource(
          "Understand quantum physics", table: "Onboarding", comment: "An example goal"),
        LocalizedStringResource(
          "Learn a topic", table: "Onboarding", comment: "The kind of an example goal")
      ),
      (
        LocalizedStringResource(
          "Learn music from scratch", table: "Onboarding", comment: "An example goal"),
        LocalizedStringResource(
          "Music", table: "Onboarding", comment: "The kind of an example goal")
      ),
      (
        LocalizedStringResource(
          "How does inflation work?", table: "Onboarding",
          comment: "An example question for a quick explanation"),
        LocalizedStringResource(
          "Quick explanation · \(Duration.seconds(300), format: .units(allowed: [.minutes], width: .abbreviated))",
          table: "Onboarding",
          comment:
            "The kind of an example goal: a short explanation of one question, and its length")
      ),
    ]
  }
}

/// The examples' local exam and a language to speak, so they feel local (main's `useLocalGoalExample`).
private enum LocalExample {
  enum Exam {
    case abitur, bac, enem, pau, sat
  }

  static var exam: Exam {
    switch Locale.current.language.languageCode?.identifier {
    case "de": .abitur
    case "es": .pau
    case "fr": .bac
    case "pt": .enem
    default: .sat
    }
  }

  /// A language that isn't the interface's own, named mid-sentence in its casing ("inglês", "Spanish").
  static var language: String {
    let spoken = Locale.current.language.languageCode?.identifier == "en" ? "es" : "en"
    return Locale.current.localizedString(forLanguageCode: spoken) ?? spoken
  }
}

extension GoalEntrySections where Attachment == EmptyView {
  init(
    words: Binding<String>,
    isSection: Bool = false,
    error: GoalError? = nil,
    limit: GoalLimitReason? = nil,
    onSubmit: @escaping (String) -> Void
  ) {
    self.init(
      words: words, isSection: isSection, error: error, limit: limit, onSubmit: onSubmit,
      attachment: { EmptyView() })
  }
}
