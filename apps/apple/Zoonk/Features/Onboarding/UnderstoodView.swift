import SwiftUI

struct ReadDraftView: View {
  let draft: OnboardingDraft
  /// Sent in this flow just now: a question opens its explanation by itself.
  let sentHere: Bool
  let onDraft: (OnboardingDraft) -> Void
  let onRewrite: (String) -> Void
  let onBack: () -> Void
  let onCreated: (String) -> Void
  var sourceIDs: [String] = []

  @Environment(AppRouter.self) private var router
  @Environment(OnboardingStore.self) private var onboarding
  @State private var isCreating = false
  @State private var error: GoalError?

  var body: some View {
    switch draft.understanding?.value1 {
    case .case1(let understood):
      UnderstoodCard(
        draft: draft, understood: understood, isCreating: isCreating, error: error,
        onDraft: onDraft, onRewrite: onRewrite
      ) {
        create {
          try await onboarding.createGoals(
            understood.goals.map(\.draft.value1), schedule: understood.schedule,
            sourceIDs: sourceIDs)
        } then: {
          onCreated($0)
        }
      }
    case .case2(let explain):
      ExplainOutcome(
        goal: draft.prompt, question: explain.question, isStarting: isCreating, error: error
      ) {
        startExplanation(question: explain.question)
      }
      .task {
        // Right after sending, a question opens its explanation by itself; coming back, it waits for a tap.
        if sentHere, error == nil, !isCreating {
          startExplanation(question: explain.question)
        }
      }
    case .case3(let instrument):
      InstrumentOutcome(
        goal: draft.prompt, instrument: instrument.instrument, isStarting: isCreating, error: error
      ) {
        create {
          try await onboarding.createMusicianship(draft: draft, instrument: instrument.instrument)
        } then: {
          onCreated($0)
        }
      }
    case .case4(let declined) where declined.status == .unsafe:
      DeclinedOutcome(goal: draft.prompt, onRetry: onBack)
    case .case4, nil:
      UnclearOutcome(goal: draft.prompt, onRetry: onBack)
    }
  }

  private func startExplanation(question: String) {
    create {
      try await onboarding.createExplanation(draft: draft, question: question)
    } then: { goalID in
      // Only while the start flow that asked is still on screen.
      guard case .startGoal = router.tasks.last else {
        return
      }

      router.dismissTask()
      router.open(.explain(goalId: goalID))
    }
  }

  private func create(_ run: @escaping () async throws -> String, then: @escaping (String) -> Void)
  {
    guard !isCreating else {
      return
    }

    isCreating = true
    error = nil

    Task {
      defer { isCreating = false }

      do {
        then(try await run())
      } catch is CancellationError {
      } catch {
        self.error = GoalError.creating(error)
      }
    }
  }
}

private struct UnderstoodCard: View {
  let draft: OnboardingDraft
  let understood: Components.Schemas.GoalUnderstanding.Case1Payload
  let isCreating: Bool
  let error: GoalError?
  let onDraft: (OnboardingDraft) -> Void
  let onRewrite: (String) -> Void
  let onConfirm: () -> Void

  @Environment(OnboardingStore.self) private var onboarding
  @State private var rewriting = false
  @State private var editing: FieldEdit?

  private struct FieldEdit: Equatable {
    let goal: Int
    let field: UnderstoodField
  }

  var body: some View {
    List {
      StepHeader(
        title: Text(
          "Here's what I understood", tableName: "Onboarding",
          comment: "Title of the card that confirms what was read from the learner's words"),
        description: understood.goals.count > 1
          ? Text(
            "These goals share your daily time. You can change all of this later.",
            tableName: "Onboarding", comment: "Under several understood goals")
          : Text(
            "You can change all of this later.", tableName: "Onboarding",
            comment: "Under an understood goal"))

      RewritableWords(
        words: draft.prompt, rewriting: $rewriting, isDisabled: isCreating, onRewrite: onRewrite)

      ForEach(understood.goals.indices, id: \.self) { index in
        Section {
          ForEach(rows(goal: index)) { row in
            UnderstoodRowView(
              row: row,
              isEditing: editing == row.field.map { FieldEdit(goal: index, field: $0) },
              onEdit: { isEditing in
                editing = isEditing ? row.field.map { FieldEdit(goal: index, field: $0) } : nil
              },
              onSave: { value in await save(row: row, goal: index, value: value) })
          }
        }
      }

      if let limit = error?.limit, limit.isPlusLimit {
        GoalLimitNoticeSection(reason: limit)
      } else {
        if let error {
          GoalErrorSection(error: error)
        }

        if error?.needsAccount != true {
          StepButtons(
            canContinue: !isCreating && !rewriting,
            canSkip: !isCreating && !rewriting,
            continueLabel: isCreating
              ? Text(
                "Saving your goal…", tableName: "Onboarding",
                comment: "While the confirmed goals are created")
              : Text(
                "Looks right", tableName: "Onboarding",
                comment: "Confirms what was understood and creates the goals"),
            skipLabel: Text(
              "Fix something", tableName: "Onboarding",
              comment: "Opens the typed words to change and read again"),
            onContinue: onConfirm
          ) {
            rewriting = true
          }
        }
      }
    }
  }

  private func rows(goal index: Int) -> [UnderstoodRow] {
    let rows = UnderstoodRows.rows(for: understood.goals[index])

    guard index == 0,
      let schedule = UnderstoodRows.scheduleRow(understood)
    else {
      return rows
    }

    return rows + [schedule]
  }

  /// False when it couldn't be saved, so the editor stays open to try again.
  private func save(row: UnderstoodRow, goal: Int, value: String) async -> Bool {
    guard let field = row.field else {
      return false
    }

    do {
      let updated = try await onboarding.revise(
        draftID: draft.id, field: field, goal: goal, value: value)
      editing = nil
      onDraft(updated)
      return true
    } catch is CancellationError {
      return true
    } catch {
      return false
    }
  }
}

private struct RewritableWords: View {
  let words: String
  @Binding var rewriting: Bool
  let isDisabled: Bool
  let onRewrite: (String) -> Void

  @State private var value = ""
  @FocusState private var isFocused: Bool

  var body: some View {
    if rewriting {
      Section {
        TextField(text: $value, axis: .vertical) {
          Text(
            "What you wrote", tableName: "Onboarding",
            comment: "Header over the learner's typed goal")
        }
        .lineLimit(1...8)
        .focused($isFocused)
        .onAppear {
          value = words
          isFocused = true
        }

        HStack {
          Button {
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)

            if !trimmed.isEmpty {
              onRewrite(trimmed)
            }
          } label: {
            Text("Read it again", tableName: "Onboarding", comment: "Reads the changed words again")
          }
          .buttonStyle(.borderedProminent)
          .disabled(isDisabled || value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

          Button(role: .cancel) {
            rewriting = false
          } label: {
            Text("Cancel", tableName: "Onboarding", comment: "Stops changing the typed words")
          }
          .buttonStyle(.borderless)
        }
      } header: {
        Text(
          "What you wrote", tableName: "Onboarding", comment: "Header over the learner's typed goal"
        )
      } footer: {
        Text(
          "We'll read it again. To fix one detail, use its pencil below.", tableName: "Onboarding",
          comment: "Under the typed words while they're being changed")
      }
    } else {
      TypedGoalSection(goal: words)
    }
  }
}

private struct UnderstoodRowView: View {
  let row: UnderstoodRow
  let isEditing: Bool
  let onEdit: (Bool) -> Void
  let onSave: (String) async -> Bool

  @State private var isSaving = false
  @State private var failed = false

  var body: some View {
    if isEditing, let field = row.field {
      RowEditor(row: row, field: field, onCancel: { onEdit(false) }, onSave: onSave)
    } else {
      VStack(alignment: .leading, spacing: 10) {
        fact

        if row.suggestedDate != nil || !row.choiceDates.isEmpty {
          dateChoices
        }
      }
    }
  }

  private var dateChoices: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack {
        if let suggested = row.suggestedDate {
          Button {
            use(suggested)
          } label: {
            Text("Use this date", tableName: "Onboarding", comment: "Takes the exam notice's day")
          }
        }

        ForEach(row.choiceDates, id: \.self) { date in
          Button {
            use(date)
          } label: {
            Text(UnderstoodRows.day(date)?.formatted(.dateTime.day().month(.abbreviated)) ?? date)
          }
        }
      }
      .buttonStyle(.bordered)
      .controlSize(.small)
      .disabled(isSaving)

      if failed {
        Text(
          "That didn't save. Try again.", tableName: "Onboarding",
          comment: "A change couldn't be saved"
        )
        .font(.footnote)
        .foregroundStyle(.destructive)
      }
    }
  }

  private func use(_ date: String) {
    isSaving = true
    failed = false

    Task {
      failed = !(await onSave(date))
      isSaving = false
    }
  }

  private var fact: some View {
    Group {
      HStack(alignment: .firstTextBaseline) {
        VStack(alignment: .leading, spacing: 4) {
          Text(row.label)
            .font(.subheadline)
            .foregroundStyle(.secondary)

          HStack(alignment: .firstTextBaseline) {
            Text(row.value)
            if let badge = row.badge {
              Text(badge)
                .font(.caption)
                .foregroundStyle(.secondary)
            }
          }

          if let note = row.note {
            Text(note)
              .font(.footnote)
              .foregroundStyle(.secondary)
          }

          if let source = row.source {
            Link(destination: source.url) {
              Label {
                Text(
                  "Source: \(source.name)", tableName: "Onboarding",
                  comment: "Where an official fact comes from, a link to it")
              } icon: {
                Image(systemName: "arrow.up.right")
              }
              .labelStyle(TrailingIconLabelStyle())
              .font(.footnote)
            }
            .foregroundStyle(.secondary)
          }
        }
        .frame(maxWidth: .infinity, alignment: .leading)

        if row.field != nil {
          Button {
            onEdit(true)
          } label: {
            Label {
              Text(
                "Edit \(String(localized: row.label))", tableName: "Onboarding",
                comment: "Fixes one understood fact; names the fact")
            } icon: {
              Image(systemName: "pencil")
            }
            .labelStyle(.iconOnly)
          }
          .buttonStyle(.borderless)
          .foregroundStyle(.secondary)
        }
      }
      .accessibilityElement(children: .combine)
      .accessibilityActions {
        if row.field != nil {
          Button {
            onEdit(true)
          } label: {
            Text(
              "Edit \(String(localized: row.label))", tableName: "Onboarding",
              comment: "Fixes one understood fact; names the fact")
          }
        }
      }
    }
  }
}

private struct TrailingIconLabelStyle: LabelStyle {
  func makeBody(configuration: Configuration) -> some View {
    HStack(spacing: 2) {
      configuration.title
      configuration.icon.imageScale(.small)
    }
  }
}

private struct RowEditor: View {
  let row: UnderstoodRow
  let field: UnderstoodField
  let onCancel: () -> Void
  let onSave: (String) async -> Bool

  @State private var text = ""
  @State private var date = Date.now
  @State private var isSaving = false
  @State private var failed = false
  @FocusState private var isFocused: Bool

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(row.label)
        .font(.subheadline)
        .foregroundStyle(.secondary)

      switch field.editor {
      case .text:
        TextField(text: $text) {
          Text(row.label)
        }
        .focused($isFocused)
        .submitLabel(.done)
        .onSubmit(save)
      case .date:
        DatePicker(
          selection: $date, in: Calendar.current.startOfDay(for: .now)...,
          displayedComponents: .date
        ) {
          Text(row.label)
        }
      case .time:
        DatePicker(selection: $date, displayedComponents: .hourAndMinute) {
          Text(row.label)
        }
      }

      if failed {
        Text(
          "That didn't save. Try again.", tableName: "Onboarding",
          comment: "A change couldn't be saved"
        )
        .font(.footnote)
        .foregroundStyle(.destructive)
      }

      HStack {
        Button(action: save) {
          if isSaving {
            Text("Saving…", tableName: "Onboarding", comment: "While a fix is saved")
          } else {
            Text("Save", tableName: "Onboarding", comment: "Saves a fix to an understood fact")
          }
        }
        .buttonStyle(.borderedProminent)
        .disabled(isSaving || (field.editor == .text && trimmed.isEmpty))

        Button(role: .cancel, action: onCancel) {
          Text("Cancel", tableName: "Onboarding", comment: "Stops fixing an understood fact")
        }
        .buttonStyle(.borderless)
        .disabled(isSaving)
      }
    }
    .onAppear(perform: start)
  }

  private var trimmed: String { text.trimmingCharacters(in: .whitespacesAndNewlines) }

  private func start() {
    let value = row.editValue ?? row.value

    switch field.editor {
    case .text:
      text = value
      isFocused = true
    case .date:
      date = UnderstoodRows.day(value) ?? .now
    case .time:
      let parts = value.split(separator: ":").compactMap { Int($0) }
      date =
        parts.count >= 2
        ? Calendar.current.date(bySettingHour: parts[0], minute: parts[1], second: 0, of: .now)
          ?? .now
        : .now
    }
  }

  private func save() {
    let value: String =
      switch field.editor {
      case .text:
        trimmed
      case .date:
        date.formatted(.iso8601.year().month().day().timeZone(separator: .omitted))
      case .time:
        date.formatted(
          .verbatim(
            "\(hour: .twoDigits(clock: .twentyFourHour, hourCycle: .zeroBased)):\(minute: .twoDigits)",
            timeZone: .current, calendar: .current))
      }

    guard !value.isEmpty, !isSaving else {
      return
    }

    isSaving = true
    failed = false

    Task {
      failed = !(await onSave(value))
      isSaving = false
    }
  }
}

private struct OutcomeHeader: View {
  let systemImage: String
  let title: Text
  let description: Text

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 8) {
        Image(systemName: systemImage)
          .font(.title2)
          .foregroundStyle(.secondary)
          .accessibilityHidden(true)
        title
          .font(.title2.bold())
          .accessibilityAddTraits(.isHeader)
        description
          .foregroundStyle(.secondary)
      }
      .listRowBackground(Color.clear)
    }
  }
}

private struct ExplainOutcome: View {
  let goal: String
  let question: String
  let isStarting: Bool
  let error: GoalError?
  let onStart: () -> Void

  var body: some View {
    List {
      OutcomeHeader(
        systemImage: "lightbulb",
        title: Text(question),
        description: Text(
          "A short explanation written for you, about 5 minutes.", tableName: "Onboarding",
          comment: "What a quick explanation is"))

      TypedGoalSection(goal: goal)

      if let error {
        GoalErrorSection(error: error)
      }

      if error?.needsAccount != true {
        StepButtons(
          canContinue: !isStarting,
          continueLabel: isStarting
            ? Text(
              "Opening your explanation…", tableName: "Onboarding",
              comment: "While a quick explanation is created")
            : Text(
              "Explain it", tableName: "Onboarding",
              comment: "Starts a quick explanation of the learner's question"),
          onContinue: onStart)
      }
    }
  }
}

/// Playing an instrument needs someone to hear you play, so it's a waitlist for now.
private struct InstrumentOutcome: View {
  let goal: String
  let instrument: String
  let isStarting: Bool
  let error: GoalError?
  let onStartMusicianship: () -> Void

  @Environment(OnboardingStore.self) private var onboarding
  @State private var waitlist: WaitlistOutcome?
  @State private var isJoining = false
  @State private var joinFailed = false

  var body: some View {
    List {
      OutcomeHeader(
        systemImage: "guitars",
        title: Text(
          "Lessons for playing \(instrument) are coming", tableName: "Onboarding",
          comment: "Title when the learner wants to play an instrument"),
        description: Text(
          "To teach you to play, we need to hear you play, and we're still building that. Join the waitlist, and start with musicianship today: reading music, ear training and rhythm.",
          tableName: "Onboarding", comment: "Why playing an instrument is a waitlist for now"))

      TypedGoalSection(goal: goal)

      Section {
        Label {
          Text(
            "Musicianship for \(instrument): hear chords, read short melodies and keep the beat. No microphone needed.",
            tableName: "Onboarding", comment: "What a musicianship goal teaches")
        } icon: {
          Image(systemName: "music.note")
        }

        switch waitlist {
        case .joined:
          Text(
            "You're on the list. We'll let you know when lessons for playing are ready.",
            tableName: "Onboarding", comment: "After joining the instrument waitlist"
          )
          .foregroundStyle(.success)
        case .signInRequired:
          Text(
            "Create an account so we can let you know.", tableName: "Onboarding",
            comment: "A guest or visitor tried to join the waitlist")
          CreateAccountButton()
        case nil:
          if joinFailed {
            Text(
              "That didn't save. Try again.", tableName: "Onboarding",
              comment: "A change couldn't be saved"
            )
            .foregroundStyle(.destructive)
          }
        }
      }

      if let error {
        GoalErrorSection(error: error)
      }

      if error?.needsAccount != true {
        StepButtons(
          canContinue: !isStarting,
          canSkip: !isJoining && waitlist != .joined,
          continueLabel: isStarting
            ? Text(
              "Saving your goal…", tableName: "Onboarding",
              comment: "While the confirmed goals are created")
            : Text(
              "Start musicianship", tableName: "Onboarding", comment: "Starts a musicianship goal"),
          skipLabel: Text(
            "Join the waitlist", tableName: "Onboarding",
            comment: "Joins the waitlist for lessons that teach playing an instrument"),
          onContinue: onStartMusicianship
        ) {
          Task { await join() }
        }
      }
    }
  }

  private func join() async {
    isJoining = true
    joinFailed = false
    defer { isJoining = false }

    do {
      waitlist = try await onboarding.joinInstrumentWaitlist(instrument: instrument)
    } catch is CancellationError {
    } catch {
      joinFailed = true
    }
  }
}

private struct DeclinedOutcome: View {
  let goal: String
  let onRetry: () -> Void

  var body: some View {
    List {
      OutcomeHeader(
        systemImage: "hand.raised",
        title: Text(
          "We can't help with this goal", tableName: "Onboarding",
          comment: "A goal the app declines"),
        description: Text(
          "Zoonk doesn't teach anything that could hurt you or others, gambling or ways to cheat. Is there something else you'd like to learn?",
          tableName: "Onboarding", comment: "Why a goal is declined"))

      TypedGoalSection(goal: goal)

      StepButtons(
        continueLabel: Text(
          "Try another goal", tableName: "Onboarding",
          comment: "Goes back to write a different goal"),
        onContinue: onRetry)
    }
  }
}

private struct UnclearOutcome: View {
  let goal: String
  let onRetry: () -> Void

  var body: some View {
    List {
      OutcomeHeader(
        systemImage: "questionmark.bubble",
        title: Text(
          "Tell us a bit more", tableName: "Onboarding", comment: "A goal too vague to plan"),
        description: Text(
          "What do you want to learn or be able to do? For example: “pass the driving test”, “understand statistics for work” or “speak French on my trip”.",
          tableName: "Onboarding", comment: "Asks for a clearer goal, with examples"))

      TypedGoalSection(goal: goal)

      StepButtons(
        continueLabel: Text(
          "Write my goal again", tableName: "Onboarding",
          comment: "Goes back to write the goal with more detail"),
        onContinue: onRetry)
    }
  }
}
