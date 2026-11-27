import SwiftUI

/// Settings › About you: what the learner told Zoonk about themselves, each question opening its
/// onboarding screen with Save.
struct AboutYouView: View {
  let open: (ProfileQuestion) -> Void
  let openMemory: () -> Void

  @Environment(SettingsStore.self) private var settings
  @Environment(\.stacksContent) private var isStacked
  /// Main's `max-w-[55%]`: a long answer cuts off at about half the row. A row's value keeps its
  /// whole width otherwise, and a long one would push the row wider than the screen. Stacked, it
  /// has the words' column under them.
  @ScaledMetric(relativeTo: .body) private var summaryWidth = 160

  var body: some View {
    ZoonkList {
      Section {
        PageHeader(
          aboutYouTitle,
          supporting: Text(
            "What you tell us here shapes your examples and your buddy. Everything is optional.",
            tableName: "AboutYou", comment: "What the About you page is for"))
      }

      if let profile = settings.profileQuestions.value {
        if !profile.memoryEnabled {
          Section {
            Button(action: openMemory) {
              Text(
                "Memory is off, so Zoonk isn't using your day or what you do for fun. Turn it on in Memory to change them.",
                tableName: "AboutYou", comment: "About you while memory is off; opens Memory"
              )
              .typeStyle(.note)
              .frame(maxWidth: .infinity, alignment: .leading)
              .disclosureChevron()
            }
            .foregroundStyle(Color(.foreground))
          }
        }

        group(
          Text("Your day", tableName: "AboutYou", comment: "About you group: work, studies, tools"),
          [.work, .studies, .tools], in: profile)
        group(
          Text(
            "For fun", tableName: "AboutYou", comment: "About you group: what the learner likes"),
          [.watch, .listen, .play, .read, .activities], in: profile)
        group(
          Text(
            "How you learn", tableName: "AboutYou",
            comment: "About you group: conditions and what helps the learner learn"),
          [.addressForm, .conditions, .learningSupport], in: profile)
      }
    }
    .barTitleAfterHero(
      String(localized: "About you", table: "AboutYou", comment: "Title of the About you page")
    )
    .overlay {
      SettingsLoadingState(state: settings.profileQuestions.state) {
        Task {
          await settings.profileQuestions.refresh()
        }
      }
    }
    .loads(settings.profileQuestions)
  }

  private func group(
    _ title: Text, _ questions: [ProfileQuestion], in profile: ProfileQuestions
  ) -> some View {
    Section {
      ForEach(questions, id: \.self) { question in
        if let view = profile.questions.first(where: { $0.id == question }) {
          Button {
            open(question)
          } label: {
            ListRow(AboutYouCopy.rowName(question)) {
              EmptyView()
            } trailing: {
              AboutYouCopy.summary(view)
                .typeStyle(.meta)
                .lineLimit(1)
                .frame(
                  maxWidth: isStacked ? .infinity : summaryWidth,
                  alignment: isStacked ? .leading : .trailing)
            }
            .disclosureChevron()
          }
          .foregroundStyle(.primary)
          // Without memory, Zoonk keeps nothing new about the learner's life, so only how they
          // learn can change.
          .disabled(question.isBiography && !profile.memoryEnabled)
        }
      }
    } header: {
      SectionTitle(title)
    }
  }
}

private var aboutYouTitle: Text {
  Text("About you", tableName: "AboutYou", comment: "Title of the About you page")
}

struct AboutYouQuestionView: View {
  let question: ProfileQuestion

  @Environment(SettingsStore.self) private var settings
  @Environment(\.dismiss) private var dismiss
  @State private var draft: ProfileDraft?
  @State private var isSaving = false
  @State private var failed = false

  var body: some View {
    let state = settings.profileQuestions.freshState

    Group {
      if case .loaded(let profile) = state,
        let view = profile.questions.first(where: { $0.id == question })
      {
        let draft = Binding {
          self.draft ?? ProfileDraft(view, memoryEnabled: profile.memoryEnabled)
        } set: {
          self.draft = $0
        }
        let canEdit = profile.memoryEnabled || !question.isBiography
        let canSave =
          canEdit
          && draft.wrappedValue.savesAChange(view, memoryEnabled: profile.memoryEnabled)

        QuestionForm {
          ProfileQuestionSections(
            view: view,
            context: ProfileScreenContext(memoryEnabled: profile.memoryEnabled, inSettings: true),
            draft: draft
          )
          .onSubmit {
            if canSave, !isSaving {
              save(draft.wrappedValue)
            }
          }
        } buttons: {
          StepButtons(
            canContinue: canSave,
            continueLabel: Text(
              "Save", tableName: "AboutYou", comment: "Saves an About you answer")
          ) {
            save(draft.wrappedValue)
          }
        }
        .sendsAnswer(isSaving: isSaving, failed: failed)
      } else {
        SettingsLoadingState(state: state) {
          Task {
            await settings.profileQuestions.refresh()
          }
        }
      }
    }
    // The question heads the screen, so the bar doesn't repeat its row's name over it.
    .barName(AboutYouCopy.rowName(question))
    .loads(settings.profileQuestions)
  }

  private func save(_ draft: ProfileDraft) {
    isSaving = true
    failed = false

    Task {
      defer { isSaving = false }

      if await settings.answerProfileQuestion(draft) {
        dismiss()
      } else {
        failed = true
      }
    }
  }
}

extension ProfileDraft {
  /// About you's Save: an answer that can be saved and saves something other than what's saved,
  /// so one opened and put back as it was never saves again. It compares what saving sends (hidden
  /// fields dropped, text trimmed), with picks in any order except studies, whose order is their
  /// fields' order. Nothing saved (never answered, or its facts deleted in Memory) isn't a
  /// decline, so anything picked, typed or declined changes it.
  func savesAChange(_ view: ProfileQuestionView, memoryEnabled: Bool = true) -> Bool {
    let saved = ProfileDraft(view, memoryEnabled: memoryEnabled)
    let keepsOrder = question == .studies

    guard canSave(view) else {
      return false
    }

    if saved.isEmpty && view.status != .declined {
      return !isEmpty
    }

    return Self.canonical(answer, keepsOrder: keepsOrder)
      != Self.canonical(saved.answer, keepsOrder: keepsOrder)
  }

  /// An answer as sorted-key JSON, its lists sorted unless their order is part of the answer.
  private static func canonical(_ answer: [String: Any], keepsOrder: Bool) -> Data? {
    func sorted(_ value: Any) -> Any {
      switch value {
      case let list as [Any]:
        let items = list.map(sorted)
        return keepsOrder ? items : items.sorted { json($0) < json($1) }
      case let object as [String: Any]:
        return object.mapValues(sorted)
      default:
        return value
      }
    }

    func json(_ value: Any) -> String {
      (try? JSONSerialization.data(
        withJSONObject: value, options: [.sortedKeys, .fragmentsAllowed]))
        .flatMap { String(data: $0, encoding: .utf8) } ?? ""
    }

    return try? JSONSerialization.data(withJSONObject: sorted(answer), options: .sortedKeys)
  }
}

private enum AboutYouCopy {
  static func rowName(_ question: ProfileQuestion) -> Text {
    switch question {
    case .unrecognized: Text(verbatim: "")
    case .addressForm:
      Text(
        "How we address you", tableName: "AboutYou",
        comment:
          "About you row: which grammatical forms (feminine, masculine or neutral wording) the app uses for words about the learner"
      )
    case .work:
      Text("What you do now", tableName: "AboutYou", comment: "About you row: work or study")
    case .tools:
      Text("Apps and tools", tableName: "AboutYou", comment: "About you row")
    case .studies:
      Text("What you've studied", tableName: "AboutYou", comment: "About you row")
    case .watch:
      Text(
        "Watch", tableName: "AboutYou", comment: "About you row: what the learner likes to watch")
    case .listen:
      Text(
        "Listen", tableName: "AboutYou",
        comment: "About you row: what the learner likes to listen to")
    case .play:
      Text(
        "Play", tableName: "AboutYou",
        comment: "About you row: sports and games the learner likes to play")
    case .read:
      Text("Read", tableName: "AboutYou", comment: "About you row: what the learner likes to read")
    case .activities:
      Text("Do", tableName: "AboutYou", comment: "About you row: what the learner likes to do")
    case .conditions:
      Text("Conditions", tableName: "AboutYou", comment: "About you row: health conditions")
    case .learningSupport:
      Text("What helps you learn", tableName: "AboutYou", comment: "About you row")
    }
  }

  /// Conditions show only how many and the address form only that it's saved, never which, so the
  /// list is safe on a shared screen.
  static func summary(_ view: ProfileQuestionView) -> Text {
    if view.status == .declined {
      return Text(
        "Not shared", tableName: "AboutYou", comment: "About you row value for a declined question")
    }

    let label = { (id: String) in view.options.first { $0.id == id }?.label ?? id }
    let saved = view.saved
    let favorites = ProfileDraft.favorites(in: saved.text)

    let parts: [String] =
      switch view.id {
      case .unrecognized: []
      case .work:
        saved.text.isEmpty ? saved.picks.map(label) : [saved.text]
      case .studies:
        [
          saved.studies.map { $0.subject ?? label($0.field) }.formatted(
            .list(type: .and, width: .narrow))
        ]
      case .addressForm, .conditions:
        []
      case .learningSupport:
        saved.picks.isEmpty
          ? [saved.text] : [saved.picks.map(label).formatted(.list(type: .and, width: .narrow))]
      case .tools:
        [(saved.picks.map(label) + favorites).formatted(.list(type: .and, width: .narrow))]
      case .watch, .listen, .play, .read, .activities:
        [saved.picks.map(label), favorites].filter { !$0.isEmpty }.map {
          $0.formatted(.list(type: .and, width: .narrow))
        }
      }

    if view.id == .addressForm, !saved.picks.isEmpty {
      return Text(
        "Saved", tableName: "AboutYou",
        comment: "About you row value: how to address the learner is saved, without showing it")
    }

    if view.id == .conditions, !saved.picks.isEmpty {
      return Text(
        "\(saved.picks.count) saved", tableName: "AboutYou",
        comment: "About you row value: how many conditions are saved")
    }

    let summary = parts.filter { !$0.isEmpty }

    guard !summary.isEmpty else {
      return view.status == .answered
        ? Text(
          "Add", tableName: "AboutYou",
          comment: "About you row value for an answer whose facts were deleted in Memory")
        : Text("Not answered", tableName: "AboutYou", comment: "About you row value")
    }

    return Text(verbatim: summary.joined(separator: "\u{00A0}· "))
  }
}
