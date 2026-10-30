import SwiftUI

enum TutorPlace: Hashable, Sendable {
  case account
  case subscription
  case startGoal(goal: String)
  case chapterTest(chapterId: String)
  case chooseFocus(goalId: String)
  case languageUnit(chapterId: String)
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
        } else {
          Button {
            places.open(content.place)
          } label: {
            content.action
          }
          .buttonStyle(.bordered)
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
  }

  private struct Content {
    let title: Text
    var description: Text?
    let action: Text
    let place: TutorPlace
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
        action: Text("Start", tableName: "Tutor", comment: "Starts the goal the buddy offered"),
        place: .startGoal(goal: start.goal),
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
        action: Text("Take the test", tableName: "Tutor", comment: "Opens a chapter's test-out"),
        place: .chapterTest(chapterId: test.chapterId))
    case .case3(let focus):
      return Content(
        title: Text(
          "Choose where to focus", tableName: "Tutor",
          comment: "The buddy offers choosing the plan's focus"),
        description: Text(
          "Pick the subjects that get more depth, or take a short test that picks them.",
          tableName: "Tutor", comment: "What choosing the plan's focus does"),
        action: Text("Choose", tableName: "Tutor", comment: "Opens choosing the plan's focus"),
        place: .chooseFocus(goalId: focus.goalId))
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
        action: Text("Practice", tableName: "Tutor", comment: "Opens a unit's practice call"),
        place: .languageUnit(chapterId: call.chapterId))
    case .case5(let mock):
      return Content(
        title: Text(
          "Take a mock exam", tableName: "Tutor", comment: "The buddy offers a mock exam"),
        action: Text("Choose", tableName: "Tutor", comment: "Opens choosing a mock exam"),
        place: .mockChooser,
        locked: mock.access == .plusRequired,
        lockNote: Text(
          "Mock exams come with Plus: whenever you want, and every week in your plan.",
          tableName: "Tutor", comment: "Why a free learner can't take a mock exam"))
    case .case6(let essay):
      return Content(
        title: Text(essay.subject),
        description: essayCadence(essay.cadence.rawValue),
        action: open,
        place: .subject(subjectKey: essay.subjectKey),
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
        action: open,
        place: .mistakes)
    case .case8(let pronunciation):
      return Content(
        title: Text(
          "Say \(pronunciation.count) words again", tableName: "Tutor",
          comment: "The buddy offers pronunciation practice"),
        description: Text(pronunciation.words.formatted(.list(type: .and))),
        action: Text("Practice", tableName: "Tutor", comment: "Opens pronunciation practice"),
        place: .pronunciation(goalId: pronunciation.goalId))
    case .case9:
      return Content(
        title: Text("Statistics", tableName: "Tutor", comment: "The buddy offers the statistics"),
        description: Text(
          "Energy, level, right answers and when you study best.", tableName: "Tutor",
          comment: "What the statistics show"),
        action: open, place: .statistics)
    case .case10:
      return Content(
        title: Text("Logbook", tableName: "Tutor", comment: "The buddy offers the week's logbook"),
        description: Text(
          "What you did this week next to the last, and what comes next.", tableName: "Tutor",
          comment: "What the logbook shows"),
        action: open, place: .logbook)
    case .case11:
      return Content(
        title: Text("Memory", tableName: "Tutor", comment: "The buddy offers what it remembers"),
        description: Text(
          "See, correct or delete what your buddy remembers about you.", tableName: "Tutor",
          comment: "What the memory settings do"),
        action: open, place: .memory)
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
        action: plus.subscribed
          ? Text("Manage", tableName: "Tutor", comment: "Opens the learner's subscription")
          : Text(
            "See Plus", tableName: "Tutor",
            comment: "Opens the Zoonk Plus subscription; Plus is its name, not \"more\""),
        place: .subscription)
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
