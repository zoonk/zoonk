import SwiftUI

enum TutorPlace: Hashable, Sendable {
  case account
  case subscription
  case startGoal(goal: String)
  case chapterTest(chapterId: String)
  case chooseFocus(goalId: String)
  case call(conversationId: String)
  case mockChooser
  case subject(subjectKey: String)
  case mistakes
  case pronunciation(goalId: String)
  case statistics
  case logbook
  case memory
  case energy
  case earlierQuestions
  case mission(Components.Schemas.StudyMissionOpens)
}

struct TutorPlaces {
  let open: @MainActor (TutorPlace) -> Void

  static let unavailable = TutorPlaces { _ in }
}

extension EnvironmentValues {
  @Entry var tutorPlaces = TutorPlaces.unavailable
}

/// A Plus-only one shows locked, with See Plus instead.
struct TutorToolOfferCard: View {
  @Environment(\.tutorPlaces) private var places
  @State private var isCallOpen = false
  @State private var callMinutes: Int?
  @State private var callStart = CallStart()
  @State private var startedCall: String?

  let offer: Components.Schemas.TutorToolOffer

  var body: some View {
    let content = offerContent

    GroupBox {
      VStack(alignment: .leading, spacing: 12) {
        if let description = content.description {
          description
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }

        if content.locked {
          PlusNotice(description: content.lockNote, isInset: true)
        } else if let action = content.action {
          switch action {
          case .open(let label, let place):
            Button {
              places.open(place)
            } label: {
              label
            }
            .buttonStyle(.bordered)
          case .practiceCall(let label):
            Button {
              isCallOpen = true
            } label: {
              label
            }
            .buttonStyle(.bordered)
          }
        }
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    } label: {
      HStack {
        content.title

        if content.locked {
          Spacer()
          PlusMark()
        }
      }
    }
    .sheet(isPresented: $isCallOpen, onDismiss: openStartedCall) {
      if case .case4(let call) = offer,
        let conversation: LanguageUnit.Conversation = try? PracticeJSON.recode(call.call)
      {
        NavigationStack {
          List {
            PracticeCallSection(
              conversation: conversation, chapterId: call.chapterId, goalId: call.goalId,
              minutes: $callMinutes, start: callStart
            ) { conversationId in
              startedCall = conversationId
              isCallOpen = false
            }
          }
          .navigationTitle(Text(call.unitTitle))
          .navigationBarTitleDisplayMode(.inline)
          .toolbar {
            ToolbarItem(placement: .cancellationAction) {
              Button(role: .close) {
                isCallOpen = false
              }
            }
          }
        }
        .presentationDetents([.medium, .large])
        .onDisappear { callStart.cancel() }
      }
    }
  }

  /// A call opens once its sheet is gone: one modal can't present another.
  private func openStartedCall() {
    guard let startedCall else {
      return
    }

    self.startedCall = nil
    places.open(.call(conversationId: startedCall))
  }

  private enum Action {
    case open(Text, TutorPlace)
    case practiceCall(Text)
  }

  private struct Content {
    let title: Text
    var description: Text?
    let action: Action?
    var locked = false
    var lockNote: Text?
  }

  private var offerContent: Content {
    let open = Text("Open", tableName: "Tutor", comment: "Opens the app place the buddy offered")

    switch offer {
    case .case1(let start):
      return Content(
        title: Text(
          "Start a new goal", tableName: "Tutor", comment: "The buddy offers starting a goal"),
        description: Text(
          "“\(start.goal)”", tableName: "Tutor", comment: "The goal the learner said, quoted"),
        action: .open(
          Text("Start", tableName: "Tutor", comment: "Starts the goal the buddy offered"),
          .startGoal(goal: start.goal)),
        locked: start.access == .plusRequired,
        lockNote: Text(
          "The free plan follows one goal at a time: pause your current goal from its menu, or follow more than one with Plus.",
          tableName: "Tutor", comment: "Why a free learner can't start another goal"))
    case .case2(let test):
      return Content(
        title: Text(
          "Test: \(test.chapterTitle)", tableName: "Tutor",
          comment: "The buddy offers a chapter's test-out; the argument is the chapter"),
        description: Text(
          "Pass it to skip up to \(test.lessonsLeft) lessons you already know.", tableName: "Tutor",
          comment: "What passing a chapter's test does"),
        action: .open(
          Text("Take the test", tableName: "Tutor", comment: "Opens a chapter's test-out"),
          .chapterTest(chapterId: test.chapterId)))
    case .case3(let focus):
      return Content(
        title: Text(
          "Choose where to focus", tableName: "Tutor",
          comment: "The buddy offers choosing the plan's focus"),
        description: Text(
          "Pick the subjects that get more depth, or take a short test that picks them.",
          tableName: "Tutor", comment: "What choosing the plan's focus does"),
        action: .open(
          Text("Choose", tableName: "Tutor", comment: "Opens choosing the plan's focus"),
          .chooseFocus(goalId: focus.goalId)))
    case .case4(let call) where call.call.paused:
      return Content(
        title: Text(call.unitTitle),
        description: Text(
          "Calls are paused for everyone right now. Try again later.", tableName: "Tutor",
          comment: "The buddy offers a practice call while calls are paused for everyone"),
        action: nil)
    case .case4(let call):
      return Content(
        title: Text(call.unitTitle),
        description: call.call.character.map { character in
          Text(
            "A short call out loud with \(character.name), \(character.role).", tableName: "Tutor",
            comment: "The buddy offers a practice call; the arguments are who the learner talks to")
        }
          ?? Text(
            "A short call out loud, at your level.", tableName: "Tutor",
            comment: "The buddy offers a practice call"),
        action: .practiceCall(
          Text("Practice", tableName: "Tutor", comment: "Opens a unit's practice call")))
    case .case5(let mock):
      return Content(
        title: Text(
          "Take a mock exam", tableName: "Tutor", comment: "The buddy offers a mock exam"),
        action: .open(
          Text("Choose", tableName: "Tutor", comment: "Opens choosing a mock exam"), .mockChooser),
        locked: mock.access == .plusRequired,
        lockNote: Text(
          "Mock exams come with Plus: whenever you want, and every week in your plan.",
          tableName: "Tutor", comment: "Why a free learner can't take a mock exam"))
    case .case6(let essay):
      return Content(
        title: Text(essay.subject),
        description: essayCadence(essay.cadence.rawValue),
        action: .open(open, .subject(subjectKey: essay.subjectKey)),
        locked: essay.access == .plusRequired,
        lockNote: Text(
          "Essay practice with grading comes with Plus.", tableName: "Tutor",
          comment: "Why a free learner can't practice essays"))
    case .case7(let mistakes):
      return Content(
        title: Text(
          "Mistakes notebook", tableName: "Tutor", comment: "The buddy offers the mistakes notebook"
        ),
        description: Text(
          "\(mistakes.open) mistakes to fix, with practice that brings each one back.",
          tableName: "Tutor", comment: "What the mistakes notebook holds"),
        action: .open(open, .mistakes))
    case .case8(let pronunciation):
      return Content(
        title: Text(
          "Say \(pronunciation.count) words again", tableName: "Tutor",
          comment: "The buddy offers pronunciation practice"),
        description: Text(pronunciation.words.formatted(.list(type: .and))),
        action: .open(
          Text("Practice", tableName: "Tutor", comment: "Opens pronunciation practice"),
          .pronunciation(goalId: pronunciation.goalId)))
    case .case9:
      return Content(
        title: Text("Statistics", tableName: "Tutor", comment: "The buddy offers the statistics"),
        description: Text(
          "Energy, level, right answers and when you study best.", tableName: "Tutor",
          comment: "What the statistics show"),
        action: .open(open, .statistics))
    case .case10:
      return Content(
        title: Text("Logbook", tableName: "Tutor", comment: "The buddy offers the week's logbook"),
        description: Text(
          "What you did this week next to the last, and what comes next.", tableName: "Tutor",
          comment: "What the logbook shows"),
        action: .open(open, .logbook))
    case .case11:
      return Content(
        title: Text("Memory", tableName: "Tutor", comment: "The buddy offers what it remembers"),
        description: Text(
          "See, correct or delete what your buddy remembers about you.", tableName: "Tutor",
          comment: "What the memory settings do"),
        action: .open(open, .memory))
    case .case12(let plus):
      return Content(
        title: Text("Plus", tableName: "Tutor", comment: "The buddy offers the subscription"),
        description: plus.subscribed
          ? Text(
            "Your plan and its billing.", tableName: "Tutor",
            comment: "What the subscription page shows a subscriber")
          : Text(
            "What Plus includes and its price.", tableName: "Tutor",
            comment: "What the subscription page shows"),
        action: .open(
          plus.subscribed
            ? Text("Manage", tableName: "Tutor", comment: "Opens the learner's subscription")
            : Text(
              "See Plus", tableName: "Tutor",
              comment: "Opens the Zoonk Plus subscription; Plus is its name, not \"more\""),
          .subscription))
    }
  }

  private func essayCadence(_ cadence: String) -> Text {
    switch cadence {
    case "biweekly":
      Text(
        "Practiced every other week in your plan, each draft graded.", tableName: "Tutor",
        comment: "How often an exam's essay is practiced")
    case "finalWeeks":
      Text(
        "Practiced in the final weeks before the exam, each draft graded.", tableName: "Tutor",
        comment: "How often an exam's essay is practiced")
    default:
      Text(
        "Practiced every week in your plan, each draft graded.", tableName: "Tutor",
        comment: "How often an exam's essay is practiced")
    }
  }
}
