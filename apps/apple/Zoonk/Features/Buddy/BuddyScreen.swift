import SwiftUI

struct BuddyScreen: View {
  @Environment(BuddyStore.self) private var store
  @Environment(LearnerSummaryStore.self) private var summary

  var body: some View {
    Group {
      switch store.status.state {
      case .idle, .loading:
        loading
      case .failed:
        failure { await store.status.refresh() }
      case .loaded where summary.summary.value == nil:
        // Which goal the buddy tutors comes with the summary: wait for it rather than flash the
        // goal start.
        if case .failed = summary.summary.state {
          failure { await summary.summary.refresh() }
        } else {
          loading
        }
      case .loaded(let status):
        BuddyContent(
          status: status, goalId: tutoredGoalId,
          hasMistake: (summary.summary.value?.places.readyMistakes ?? 0) > 0)
      case .empty:
        EmptyView()
      }
    }
    .loads(store.status, store.earlierQuestions, refreshable: false)
  }

  private var loading: some View {
    ProgressView()
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .navigationTitle(Text(summary.buddyDisplayName))
  }

  private func failure(retry: @escaping () async -> Void) -> some View {
    ContentUnavailableView {
      Label {
        Text("Your buddy", tableName: "Buddy", comment: "Title of the Buddy tab")
      } icon: {
        Image(systemName: "face.smiling")
      }
    } description: {
      Text(
        "Something went wrong. Try again.", tableName: "Buddy",
        comment: "The buddy's day couldn't be read")
    } actions: {
      Button {
        Task { await retry() }
      } label: {
        Text("Try again", tableName: "Buddy", comment: "Reads the buddy's day again")
      }
      .buttonStyle(.bordered)
    }
    .navigationTitle(Text(summary.buddyDisplayName))
  }

  private var tutoredGoalId: String? {
    guard let learner = summary.summary.value, let id = learner.activeGoalID,
      let goal = learner.goals.first(where: { $0.id == id }),
      goal.status != .archived, goal.kind != .explain
    else {
      return nil
    }

    return goal.id
  }
}

private struct BuddyContent: View {
  @Environment(BuddyStore.self) private var store
  @Environment(TutorStore.self) private var tutor
  @Environment(\.dynamicTypeSize) private var typeSize
  @Environment(\.tutorPlaces) private var places

  let status: BuddyStatus
  let goalId: String?
  let hasMistake: Bool

  @State private var isDayShown = false
  @State private var isEditing = false
  @State private var isWearing = false
  @State private var goalDraft = ""
  @State private var faceCue: ActCue<BuddyAct>?
  @State private var placeAfterDay: TutorPlace?

  private var name: String {
    buddyName(kind: status.buddy.kind, name: status.buddy.name)
  }

  private var look: BuddyLook {
    BuddyLook(
      kind: status.buddy.kind, glasses: status.buddy.glasses,
      belt: ProgressBelt(rawValue: status.belt.color) ?? .white, energy: status.energy.current,
      studiedToday: status.energy.studiedToday)
  }

  /// Only while it's awake: asleep it naps on, and glowing it's already beaming with its eyes shut,
  /// so a smile would swap its face away.
  private func react(_ act: BuddyAct) {
    guard look.energyState == .awake else { return }
    faceCue = ActCue(id: (faceCue?.id ?? 0) + 1, act: act)
  }

  var body: some View {
    // A pane rather than an inspector: a hidden tab's inspector turns into a sheet over the shown
    // tab when the width turns compact.
    PaneSplit(primaryShare: 0.55) {
      thread(opensDay: false)
    } secondary: {
      dayView(showsTitle: true)
        // A day opened in a sheet before iPhone Duo unfolded gives way to the pane.
        .onAppear { isDayShown = false }
    } single: {
      thread(opensDay: true)
    }
    .navigationTitle(Text(name))
    .navigationSubtitle(
      Text(
        "Your study buddy · \(status.stage.name)", tableName: "Buddy",
        comment: "What the buddy is, and its stage")
    )
    .taskOptions(
      label: Text(
        "More about \(name)", tableName: "Buddy",
        comment: "The buddy's menu; the argument is its name")
    ) {
      menuItems
    }
    .sheet(isPresented: $isDayShown, onDismiss: openPlaceAfterDay) {
      let day = dayView(showsTitle: false)

      NavigationStack {
        day
          .navigationTitle(day.title)
          .navigationSubtitle(day.subtitle)
          .navigationBarTitleDisplayMode(.inline)
          .toolbar {
            ToolbarItem(placement: .cancellationAction) {
              Button(role: .close) {
                isDayShown = false
              }
            }
          }
      }
      .presentationDetents([.medium, .large])
      // A phone's day is a sheet: it gives way to the place it opens (a mission, what the
      // buddy remembers, the week), which would otherwise open under it.
      .environment(
        \.tutorPlaces,
        TutorPlaces { place in
          placeAfterDay = place
          isDayShown = false
        })
    }
    .sheet(isPresented: $isEditing) {
      BuddyEditor(
        choice: status.choice,
        availableGlasses: status.glasses.filter(\.earned).compactMap {
          BuddyGlasses(rawValue: $0.glasses.rawValue)
        },
        save: { choice in Task { await store.save(choice) } })
    }
    .sheet(isPresented: $isWearing) {
      BuddyGlassesPicker(status: status)
    }
    .onChange(of: goalId.map { tutor.conversation(.plan(goalId: $0)).isAsking } ?? false) {
      _, isAsking in
      if isAsking {
        react(.glance)
      }
    }
    .onChange(of: goalId.map { tutor.conversation(.plan(goalId: $0)).answeringID } ?? nil) {
      answered, answering in
      let turn = goalId.flatMap { tutor.conversation(.plan(goalId: $0)).turns.last }
      if let answered, answering == nil, turn?.id == answered, turn?.status == .completed {
        react(.smile)
      }
    }
    .onChange(of: store.broughtQuestion, initial: true) { _, question in
      guard let question else {
        return
      }

      if let goalId {
        tutor.conversation(.plan(goalId: goalId)).draft = question
      } else {
        goalDraft = question
      }

      store.broughtQuestion = nil
    }
  }

  private func dayView(showsTitle: Bool) -> BuddyDayView {
    BuddyDayView(
      status: status, name: name,
      onGlasses: {
        // A phone's day is a sheet: it gives way to the glasses' own sheet.
        if !showsTitle {
          isDayShown = false
        }

        isWearing = true
      }, showsTitle: showsTitle)
  }

  private func openPlaceAfterDay() {
    if let place = placeAfterDay {
      placeAfterDay = nil
      places.open(place)
    }
  }

  private func thread(opensDay: Bool) -> some View {
    conversation
      .safeAreaBar(edge: .top) {
        dayLine(opensDay: opensDay)
          .scenePadding(.horizontal)
          .padding(.vertical, 8)
      }
  }

  @ViewBuilder
  private var conversation: some View {
    if let goalId {
      TutorThreadView(
        scope: .plan(goalId: goalId),
        suggestions: suggestions,
        placeholder: Text(
          "Ask a question or request a change", tableName: "Buddy",
          comment: "Placeholder of the buddy's composer: it answers and changes the plan"),
        isPage: true
      ) {
        greeting
      }
    } else {
      BuddyGoalStart(name: name, goal: $goalDraft)
    }
  }

  /// The hello says the buddy is an AI (EU AI Act art. 50; Decreto 12.880/2026 art. 11 for minors).
  private var greeting: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text(
        "Hi! I'm \(name), your AI study buddy. Ask me anything about what you're studying, or tell me what you'd like to change in your plan.",
        tableName: "Buddy",
        comment: "The buddy's hello at the top of its conversation; the argument is its name")

      if store.saveFailed {
        Text(
          "We couldn't save your buddy. Try again.", tableName: "Buddy",
          comment: "Saving the buddy failed"
        )
        .font(.footnote)
        .foregroundStyle(.destructive)
      }

      if !status.buddy.picked {
        Button {
          isEditing = true
        } label: {
          Label {
            Text(
              "Choose your buddy", tableName: "Buddy",
              comment: "Opens choosing a buddy and its name")
          } icon: {
            Image(systemName: "face.smiling")
          }
        }
        .buttonStyle(.bordered)
      }
    }
    .accessibilityElement(children: .contain)
  }

  private var suggestions: [TutorSuggestion] {
    [
      status.today != nil
        ? TutorSuggestion(
          id: "today",
          label: String(
            localized: "Why am I studying this today?", table: "Buddy",
            comment: "A question to the buddy, sent with one tap"))
        : TutorSuggestion(
          id: "today",
          label: String(
            localized: "What's in my plan for today?", table: "Buddy",
            comment: "A question to the buddy, sent with one tap")
        ),
      TutorSuggestion(
        id: "lighter",
        label: String(
          localized: "I want to study less this week", table: "Buddy",
          comment: "A question to the buddy, sent with one tap")
      ),
      hasMistake
        ? TutorSuggestion(
          id: "mistake",
          label: String(
            localized: "Explain my last mistake", table: "Buddy",
            comment: "A question to the buddy, sent with one tap"))
        : TutorSuggestion(
          id: "focus",
          label: String(
            localized: "What should I focus on first?", table: "Buddy",
            comment: "A question to the buddy, sent with one tap")),
    ]
  }

  @ViewBuilder
  private func dayLine(opensDay: Bool) -> some View {
    if opensDay {
      Button {
        isDayShown = true
      } label: {
        dayLineLabel(opensDay: true)
      }
      .buttonStyle(.plain)
      .accessibilityLabel(dayLabel)
      .accessibilityHint(
        Text(
          "Shows \(name)'s day", tableName: "Buddy",
          comment: "VoiceOver hint of the buddy's day line; the argument is the buddy's name")
      )
    } else {
      dayLineLabel(opensDay: false)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(dayLabel)
    }
  }

  private func dayLineLabel(opensDay: Bool) -> some View {
    HStack(spacing: 16) {
      BuddyCharacter(look: look, crop: .face, cue: faceCue)
        .frame(width: 32, height: 32)

      let values =
        typeSize.isAccessibilitySize
        ? AnyLayout(VStackLayout(alignment: .leading, spacing: 4))
        : AnyLayout(HStackLayout(spacing: 16))

      values {
        Label {
          Text(
            status.energy.current.map {
              ($0 / 100).formatted(.percent.precision(.fractionLength(0)))
            } ?? "–")
        } icon: {
          Image(systemName: "bolt.fill")
            .foregroundStyle(.energy)
        }

        if let today = status.today, !today.missions.isEmpty {
          Label {
            Text(
              verbatim:
                "\(today.missions.filter { $0.status == .done }.count)/\(today.missions.count)")
          } icon: {
            Image(systemName: "target")
          }
        }
      }
      .fixedSize()

      Spacer(minLength: 0)

      if opensDay {
        Image(systemName: "chevron.right")
          .font(.footnote.weight(.semibold))
          .foregroundStyle(.tertiary)
      }
    }
    .labelStyle(.titleAndIcon)
    .font(.subheadline.monospacedDigit())
    .foregroundStyle(.secondary)
    .contentShape(.rect)
  }

  private var dayLabel: Text {
    let energy =
      status.energy.current.map { ($0 / 100).formatted(.percent.precision(.fractionLength(0))) }
      ?? String(
        localized: "Not yet", table: "Buddy", comment: "VoiceOver: Energy before the first lesson")

    guard let today = status.today, !today.missions.isEmpty else {
      return Text(
        "Energy \(energy)", tableName: "Buddy", comment: "VoiceOver: the buddy's day button")
    }

    let done = today.missions.filter { $0.status == .done }.count

    return Text(
      "Energy \(energy), \(done) of \(today.missions.count) missions", tableName: "Buddy",
      comment: "VoiceOver: the buddy's day button, with Energy and today's missions")
  }

  @ViewBuilder
  private var menuItems: some View {
    Button {
      isEditing = true
    } label: {
      Label {
        status.buddy.picked
          ? Text(
            "Change \(name)", tableName: "Buddy",
            comment: "Opens changing the buddy; the argument is its name")
          : Text(
            "Choose your buddy", tableName: "Buddy",
            comment: "Opens choosing a buddy and its name")
      } icon: {
        Image(systemName: status.buddy.picked ? "pencil" : "face.smiling")
      }
    }

    Button {
      isWearing = true
    } label: {
      Label {
        Text("Glasses", tableName: "Buddy", comment: "Opens the buddy's glasses")
      } icon: {
        Image(systemName: "eyeglasses")
      }
      Text(
        "\(status.earnedGlasses) of \(status.glasses.count)", tableName: "Buddy",
        comment: "Glasses earned of all of them")
    }

    Divider()

    Button {
      places.open(.logbook)
    } label: {
      Label {
        Text("Weekly summary", tableName: "Buddy", comment: "Opens the week's logbook")
      } icon: {
        Image(systemName: "calendar")
      }
    }

    if case .loaded = store.earlierQuestions.state {
      Button {
        places.open(.earlierQuestions)
      } label: {
        Label {
          Text(
            "Earlier questions", tableName: "Buddy",
            comment: "Opens questions asked before the courses were rewritten")
        } icon: {
          Image(systemName: "clock.arrow.circlepath")
        }
      }
    }
  }
}
