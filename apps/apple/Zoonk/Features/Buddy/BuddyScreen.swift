import SwiftUI

/// The Buddy tab: the learner's conversation with their buddy, their tutor for the goal (doubts,
/// the plan, and changes to it by talking), with the buddy's day (Energy and missions) a tap away
/// in a sheet on a phone and beside the conversation on a wide screen. Before there's a goal, the
/// buddy takes one. The shell shows visitors its sign-in gate; a guest sees the buddy but is asked
/// to create an account to talk.
struct BuddyScreen: View {
  @Environment(BuddyStore.self) private var store
  @Environment(LearnerSummaryStore.self) private var summary

  var body: some View {
    Group {
      switch store.status.state {
      case .idle, .loading:
        ProgressView()
          .frame(maxWidth: .infinity, maxHeight: .infinity)
      case .failed:
        failure { await store.status.refresh() }
      case .loaded where summary.summary.value == nil:
        // Which goal the buddy tutors comes with the summary: wait for it rather than show the
        // goal start for a moment, and offer to read it again if it couldn't be read.
        if case .failed = summary.summary.state {
          failure { await summary.summary.refresh() }
        } else {
          ProgressView()
            .frame(maxWidth: .infinity, maxHeight: .infinity)
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
  }

  /// The selected goal the buddy tutors, unless it's archived or a quick explanation.
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
  @Environment(\.horizontalSizeClass) private var sizeClass
  @Environment(\.dynamicTypeSize) private var typeSize
  @Environment(\.tutorPlaces) private var places

  let status: BuddyStatus
  let goalId: String?
  /// The learner has mistakes to fix, so the buddy offers to explain the last one.
  let hasMistake: Bool

  @State private var isDayShown = false
  @State private var didPlaceDay = false
  @State private var isEditing = false
  @State private var isWearing = false
  @State private var goalDraft = ""

  private var name: String {
    buddyName(kind: status.buddy.kind, name: status.buddy.name)
  }

  var body: some View {
    conversation
      .navigationTitle(Text(name))
      .navigationSubtitle(
        Text(
          "Your study buddy · \(status.stage.name)", tableName: "Buddy",
          comment: "What the buddy is, and its stage")
      )
      .toolbar {
        ToolbarItem(placement: .topBarTrailing) {
          menu
        }
      }
      // Energy and today's missions stay in sight under the title, as main's line beside the
      // buddy's name does, while the conversation scrolls under them.
      .safeAreaBar(edge: .top) {
        dayLine
      }
      // A wide screen keeps the day in a column beside the conversation; a phone opens it in a
      // sheet, with its title in the sheet's bar.
      .inspector(isPresented: isDayShown(when: .regular)) {
        dayView(showsTitle: true)
      }
      .sheet(isPresented: isDayShown(when: .compact)) {
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
      .onAppear {
        // A wide screen has room to keep the day in sight beside the conversation, once: after
        // that the learner's choice stays.
        if !didPlaceDay, sizeClass == .regular {
          isDayShown = true
        }

        didPlaceDay = true
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

  /// The day shown in the presentation that fits the width: a column or a sheet.
  private func isDayShown(when sizeClass: UserInterfaceSizeClass) -> Binding<Bool> {
    Binding(
      get: { isDayShown && (self.sizeClass ?? .compact) == sizeClass },
      set: { isDayShown = $0 })
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

  /// The hello says the buddy is an AI, since it opens every conversation (EU AI Act art. 50;
  /// Decreto 12.880/2026 art. 11 for minors).
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

  /// Three ways to start, from the learner's day: why today's lessons, a lighter week, a doubt.
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

  /// The buddy's day as one quiet line: Energy and today's missions. It shows the whole day, in a
  /// sheet on a phone and beside the conversation on a wide screen.
  private var dayLine: some View {
    Button {
      isDayShown.toggle()
    } label: {
      HStack(spacing: 16) {
        // At accessibility sizes the two values stack, so neither breaks across lines.
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

        Image(systemName: "chevron.right")
          .font(.footnote.weight(.semibold))
          .foregroundStyle(.tertiary)
      }
      .labelStyle(.titleAndIcon)
      .font(.subheadline.monospacedDigit())
      .foregroundStyle(.secondary)
      .contentShape(.rect)
    }
    .buttonStyle(.plain)
    .accessibilityLabel(dayLabel)
    .accessibilityHint(
      Text(
        "Shows \(name)'s day", tableName: "Buddy",
        comment: "VoiceOver hint of the buddy's day line; the argument is the buddy's name")
    )
    .scenePadding(.horizontal)
    .padding(.vertical, 8)
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

  private var menu: some View {
    Menu {
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
    } label: {
      Label {
        Text(
          "More about \(name)", tableName: "Buddy",
          comment: "The buddy's menu; the argument is its name")
      } icon: {
        Image(systemName: "ellipsis")
      }
    }
  }
}
