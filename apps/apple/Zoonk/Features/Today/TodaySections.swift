import SwiftUI

/// "Up next in your plan" under a day with nothing left to start: the lessons "Keep learning"
/// adds, the first opening them. Being done for the day, or resting, never hides what comes next.
struct TodayUpNextSection: View {
  let view: TodayView
  let isBusy: Bool
  let keepLearning: () -> Void

  var body: some View {
    Section {
      ForEach(Array(view.upNextLessons.enumerated()), id: \.offset) { index, lesson in
        let row = HStack(alignment: .firstTextBaseline, spacing: 12) {
          KindMark(kind: .lesson)
            .frame(minWidth: 20)
          Text(lesson.title)
            .font(index == 0 ? .body.weight(.semibold) : .body)
          Spacer(minLength: 8)
          Text(studyDuration(minutes: lesson.minutes))
            .font(.footnote.monospacedDigit())
            .foregroundStyle(.secondary)
        }

        if index == 0 {
          Button(action: keepLearning) { row }
            .tint(.primary)
            .disabled(isBusy)
            .listRowBackground(NextRowBackground())
        } else {
          row
        }
      }
    } header: {
      Text("Up next in your plan", tableName: "Today", comment: "The plan's next lessons")
    }

    Section {
      TodayMainAction(kind: .keepLearning, isBusy: isBusy, failed: false, action: keepLearning)
    }
    .listRowBackground(Color.clear)
    .listRowInsets(EdgeInsets())
    .listSectionSpacing(.compact)
  }
}

/// What else the day offers: practice on a day with nothing new, more time once it's done or on a
/// rest day, the lessons left to catch up while it's underway, and the week's challenge and the
/// buddy's quiz on a day with nothing new. Nothing beside "Keep learning" or past the goal's date.
struct TodayMoreSection: View {
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner

  let view: TodayView
  let busy: TodayDayView.Tap?
  let addTime: () -> Void
  let catchUp: () -> Void

  var body: some View {
    let state = view.session.state

    if !view.isPastDate && view.upNextLessons.isEmpty {
      if state == .ahead && view.session.extraTime.available {
        Section {
          TodayMainAction(
            kind: .practice(minutes: view.session.extraTime.minutes),
            isBusy: busy == .keepLearning, failed: false, action: addTime)
        }
        .listRowBackground(Color.clear)
        .listRowInsets(EdgeInsets())
        .listSectionSpacing(.compact)
      }

      if hasRows(state) {
        Section {
          if state == .ahead {
            TodayChallengeRow(view: view)

            Button {
              router.select(.buddy)
            } label: {
              Label {
                Text(
                  "Practice with \(learner.buddyDisplayName)", tableName: "Today",
                  comment: "Opens the buddy's quiz")
              } icon: {
                Image(systemName: "bubble.left")
              }
            }
            .tint(.primary)
          }

          if (state == .done || state == .rest) && view.session.extraTime.available {
            Button(action: addTime) {
              Label {
                view.studiedToday
                  ? Text(
                    "Study \(view.session.extraTime.minutes) more minutes", tableName: "Today",
                    comment: "Adds study time once the day is done")
                  : Text(
                    "Study for \(view.session.extraTime.minutes) minutes", tableName: "Today",
                    comment: "Adds study time on a rest day")
              } icon: {
                Image(systemName: "plus.circle")
              }
            }
            .disabled(busy != nil)
          }

          if let later = view.session.catchUp?.later, later.offered,
            state == .underway || state == .done
          {
            Button(action: catchUp) {
              Label {
                Text(
                  "Catch up today · +\(studyDuration(minutes: later.minutes))", tableName: "Today",
                  comment: "Adds the lessons earlier days left to today")
              } icon: {
                if busy == .catchUp {
                  ProgressView()
                } else {
                  Image(systemName: "arrow.uturn.forward")
                }
              }
            }
            .disabled(busy != nil)
          }
        }
      }
    }
  }

  private func hasRows(_ state: DayState) -> Bool {
    switch state {
    case .ahead:
      true
    case .done, .rest:
      view.session.extraTime.available || view.session.catchUp?.later.offered == true
    case .underway:
      view.session.catchUp?.later.offered == true
    case .limit, .waiting:
      false
    }
  }
}

/// The week's challenge or mock exam ahead: its intro shows what it asks, before its day too.
struct TodayChallengeRow: View {
  @Environment(AppRouter.self) private var router

  let view: TodayView

  var body: some View {
    if let challenge = view.weeklyChallenge, let planItemID = challenge.planItemId,
      let dateText = challenge.date, dateText >= view.session.localDate,
      let date = studyDate(dateText)
    {
      let day = date.formatted(.studyDay.weekday(.wide))

      Button {
        router.open(.challenge(planItemId: planItemID))
      } label: {
        HStack {
          Label {
            challenge.kind == "mock"
              ? Text("See \(day)'s mock exam", tableName: "Today", comment: "The week's mock")
              : Text("See \(day)'s challenge", tableName: "Today", comment: "The week's challenge")
          } icon: {
            KindMark(kind: challenge.kind == "mock" ? .mock : .challenge)
          }

          if challenge.requiresPlus {
            Spacer()
            Text("Plus", tableName: "Today", comment: "Marks something that comes with Plus")
              .chip()
          }
        }
      }
      .tint(.primary)
    }
  }
}

/// A plan change waiting for the learner's say; the Plan shows it and decides it.
struct TodayPlanChangeSection: View {
  @Environment(AppRouter.self) private var router

  let change: TodayView.PlanChange?

  var body: some View {
    Section {
      VStack(alignment: .leading, spacing: 4) {
        Text(
          "Your plan has a change for you to look at.", tableName: "Today",
          comment: "A proposed plan change")

        if let reason = change?.reason {
          Text(reason)
            .font(.subheadline)
            .foregroundStyle(.secondary)
        }
      }

      Button {
        router.select(.plan)
      } label: {
        Text("See your plan", tableName: "Today", comment: "Opens the Plan")
      }
    }
  }
}

/// Today's missions: how many are left and their Brain Power, then each one, opening where it's
/// done.
struct TodayMissionsSection: View {
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner

  let view: TodayView
  let open: (StudyBlock, Bool) -> Void

  private var missions: [StudyMission] { view.session.missions }

  var body: some View {
    let left = missions.filter { !$0.isDone }
    let won = view.session.fullMeal.earned

    Section {
      VStack(alignment: .leading, spacing: 8) {
        HStack(alignment: .firstTextBaseline) {
          if won {
            Text(
              "You earned +\(view.session.fullMeal.bonus) Brain Power.", tableName: "Today",
              comment: "Today's missions are done")
          } else {
            Text(
              "\(left.count) left · ~\(studyDuration(minutes: minutesLeft(left)))",
              tableName: "Today", comment: "Missions left and their time"
            )
            .monospacedDigit()
          }

          Spacer()

          if !won {
            Label {
              Text("+\(view.session.fullMeal.bonus)")
                .monospacedDigit()
            } icon: {
              Image(systemName: "brain")
            }
            .foregroundStyle(.brain)
            .accessibilityLabel(
              Text(
                "\(view.session.fullMeal.bonus) Brain Power for finishing them", tableName: "Today",
                comment: "The missions' reward"))
          }
        }
        .font(.subheadline)

        MeterParts(
          parts: missions.map {
            MeterParts.Part(fill: $0.isDone ? .color(.brain) : .color(.brain.opacity(0.18)))
          })
      }
      .listRowSeparator(.hidden, edges: .bottom)

      ForEach(Array(missions.enumerated()), id: \.offset) { _, mission in
        MissionRow(mission: mission, buddyName: learner.buddyDisplayName) {
          go(mission)
        }
      }
    } header: {
      won
        ? Text("Missions done", tableName: "Today", comment: "Today's missions are done")
        : Text("Today's missions", tableName: "Today", comment: "Today's missions header")
    }
  }

  private func minutesLeft(_ missions: [StudyMission]) -> Int {
    Int(missions.reduce(0) { $0 + ($1.minutes ?? 0) }.rounded())
  }

  /// Opens where the mission is done: a block of the day, or a place of its own, whose activity
  /// saves the day itself on its first answer (core's `saveDayBeforeActivity`).
  private func go(_ mission: StudyMission) {
    guard let opens = mission.opens else {
      return
    }

    switch opens.kind {
    case "block":
      if let block = view.session.blocks.first(where: { mission.opens($0) }) {
        open(block, false)
      }
    case "mistakesPractice":
      router.open(.mistakePractice())
    case "pattern":
      if let patternID = opens.patternId {
        router.open(.pattern(patternId: patternID))
      }
    case "pronunciation":
      router.open(.pronunciation(goalId: view.goal.id))
    case "call":
      if let chapterID = opens.chapterId {
        router.open(.languageUnit(chapterId: chapterID))
      }
    case "buddy":
      router.select(.buddy)
    case "mockChooser":
      router.open(.mockChooser)
    default:
      router.select(.plan)
    }
  }
}

/// The learner's week: each day's study against its goal, and the week's time; the week's
/// challenge under it.
struct TodayWeekSection: View {
  let view: TodayView

  private var week: StudyWeek { view.session.week }

  private var title: some View {
    Text("This week", tableName: "Today", comment: "The week's header")
  }

  private var numbers: some View {
    Text(
      "\(week.daysHitGoal) of \(week.studyDays) days · \(studyDuration(minutes: week.time.studiedMinutes)) / \(studyDuration(minutes: Int(week.time.targetMinutes)))",
      tableName: "Today", comment: "Days the goal was reached and the week's time"
    )
    .monospacedDigit()
    .lineLimit(1)
  }

  var body: some View {
    Section {
      HStack {
        ForEach(week.days, id: \.date) { day in
          WeekDayMark(day: day, localDate: view.session.localDate)
            .frame(maxWidth: .infinity)
        }
      }
      .padding(.vertical, 4)

      if view.session.state != .ahead {
        TodayChallengeRow(view: view)
      }
    } header: {
      ViewThatFits(in: .horizontal) {
        HStack {
          title
          Spacer()
          numbers
        }

        VStack(alignment: .leading, spacing: 2) {
          title
          numbers
        }
      }
    }
  }
}

/// One day of the week: reached, studied, today, planned or a rest day, with its letter.
private struct WeekDayMark: View {
  let day: StudyWeek.Day
  let localDate: String

  var body: some View {
    let date = studyDate(day.date)

    VStack(spacing: 4) {
      symbol
        .font(.title3)

      Text(date?.formatted(.studyDay.weekday(.narrow)) ?? "")
        .font(.caption2.weight(day.isToday ? .bold : .regular))
        .foregroundStyle(day.isToday ? .primary : .secondary)
    }
    .accessibilityElement(children: .ignore)
    .accessibilityLabel(
      Text(
        "\(date?.formatted(.studyDay.weekday(.wide)) ?? day.date): \(status)", tableName: "Today",
        comment: "A day of the week and how it went"))
  }

  @ViewBuilder
  private var symbol: some View {
    if day.hitGoal {
      Image(systemName: "checkmark.circle")
        .foregroundStyle(.success)
    } else if day.studied {
      Image(systemName: "circle.lefthalf.filled")
        .foregroundStyle(.success)
    } else if day.kind == "rest" {
      Image(systemName: "moon")
        .foregroundStyle(.tertiary)
    } else if day.isToday {
      Image(systemName: "circle")
        .fontWeight(.semibold)
        .foregroundStyle(.secondary)
    } else {
      Image(systemName: "circle")
        .foregroundStyle(.quaternary)
    }
  }

  private var status: String {
    if day.hitGoal {
      return String(localized: "goal reached", table: "Today", comment: "A day's status")
    }

    if day.studied {
      return String(localized: "studied", table: "Today", comment: "A day's status")
    }

    switch day.kind {
    case "exam":
      return String(localized: "exam day", table: "Today", comment: "A day's status")
    case "deadline":
      return String(localized: "your goal's date", table: "Today", comment: "A day's status")
    case "beforeStart":
      return String(localized: "before your plan", table: "Today", comment: "A day's status")
    case "afterEnd":
      return String(localized: "after your date", table: "Today", comment: "A day's status")
    case "rest":
      return String(localized: "rest day", table: "Today", comment: "A day's status")
    default:
      break
    }

    if day.isToday {
      return String(localized: "today", table: "Today", comment: "A day's status")
    }

    return day.date > localDate
      ? String(localized: "planned", table: "Today", comment: "A day's status")
      : String(localized: "not studied", table: "Today", comment: "A day's status")
  }
}

/// Practice the learner can do any time: the mistakes notebook, a noticed pattern, a mock exam or
/// speaking tasks.
struct TodayPracticeSection: View {
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner

  let view: TodayView

  var body: some View {
    let places = learner.summary.value?.places

    Section {
      NavigationLink(value: AppRoute.mistakes) {
        Label {
          VStack(alignment: .leading, spacing: 2) {
            Text("Mistakes notebook", tableName: "Today", comment: "Opens the mistakes notebook")
            Text("Redo what you got wrong", tableName: "Today", comment: "The notebook's line")
              .font(.footnote)
              .foregroundStyle(.secondary)
          }
        } icon: {
          KindMark(kind: .mistakes)
        }
      }
      .badge(places?.readyMistakes ?? 0)

      if let pattern = view.pattern {
        Button {
          router.open(.pattern(patternId: pattern.id))
        } label: {
          Label {
            VStack(alignment: .leading, spacing: 2) {
              Text("Practice a pattern", tableName: "Today", comment: "Opens a noticed pattern")
              Text(pattern.title)
                .font(.footnote)
                .foregroundStyle(.secondary)
            }
          } icon: {
            KindMark(kind: .practice)
          }
        }
        .tint(.primary)
      }

      if places?.exam == true {
        NavigationLink(value: AppRoute.mockChooser) {
          Label {
            Text("Take a mock exam", tableName: "Today", comment: "Opens the mock chooser")
          } icon: {
            KindMark(kind: .mock)
          }
        }
      }

      if places?.speaking == true {
        NavigationLink(value: AppRoute.speaking) {
          Label {
            Text("Speaking practice", tableName: "Today", comment: "Opens speaking tasks")
          } icon: {
            KindMark(kind: .conversation)
          }
        }
      }
    } header: {
      Text("Practice anytime", tableName: "Today", comment: "Practice section header")
    }
  }
}
