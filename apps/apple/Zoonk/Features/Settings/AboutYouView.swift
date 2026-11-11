import SwiftUI

/// Settings › About you: what the learner told Zoonk about themselves, each question opening its
/// onboarding screen with Save.
struct AboutYouView: View {
  let open: (ProfileQuestion) -> Void
  let openMemory: () -> Void

  @Environment(SettingsStore.self) private var settings

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
          Text("Your day", tableName: "AboutYou", comment: "About you group: work, tools, studies"),
          [.work, .tools, .studies], in: profile)
        group(
          Text(
            "For fun", tableName: "AboutYou", comment: "About you group: what the learner likes"),
          [.watch, .listen, .play, .read, .activities], in: profile)
        group(
          Text(
            "How you learn", tableName: "AboutYou",
            comment: "About you group: conditions and what helps the learner learn"),
          [.conditions, .learningSupport], in: profile)
      }
    }
    .navigationTitle(aboutYouTitle)
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

/// One About you question with Save and no Skip. Saving it empty records it as not shared.
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

        QuestionForm {
          ProfileQuestionSections(
            view: view, context: ProfileScreenContext(memoryEnabled: profile.memoryEnabled),
            draft: draft)
        } buttons: {
          StepButtons(
            canContinue: canEdit && draft.wrappedValue.isComplete,
            continueLabel: Text(
              "Save", tableName: "AboutYou", comment: "Saves an About you answer"),
            continueIcon: nil
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
    .navigationTitle(AboutYouCopy.rowName(question))
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

private enum AboutYouCopy {
  static func rowName(_ question: ProfileQuestion) -> Text {
    switch question {
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

  /// Conditions show only how many, never which, so the list is safe on a shared screen.
  static func summary(_ view: ProfileQuestionView) -> Text {
    if view.status == .declined {
      return Text(
        "Not shared", tableName: "AboutYou", comment: "About you row value for a declined question")
    }

    let label = { (id: String) in view.options.first { $0.id == id }?.label ?? id }
    let saved = view.saved
    let favorites = saved.text.split(separator: ",").map {
      $0.trimmingCharacters(in: .whitespaces)
    }

    let parts: [String] =
      switch view.id {
      case .work:
        saved.text.isEmpty ? saved.picks.map(label) : [saved.text]
      case .studies:
        [
          saved.studies.map { $0.subject ?? label($0.field) }.formatted(
            .list(type: .and, width: .narrow))
        ]
      case .conditions:
        []
      case .learningSupport:
        saved.picks.isEmpty
          ? [saved.text] : [saved.picks.map(label).formatted(.list(type: .and, width: .narrow))]
      case .tools, .watch, .listen, .play, .read, .activities:
        [saved.picks.map(label), favorites].filter { !$0.isEmpty }.map {
          $0.formatted(.list(type: .and, width: .narrow))
        }
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
