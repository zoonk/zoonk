import SwiftUI

struct SessionSummaryView: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(AppRouter.self) private var router
  @Environment(StudySessionStore.self) private var store
  @Environment(TodayStore.self) private var today

  let sessionID: String
  let stopped: Bool

  @State private var action: Task<Void, Never>?
  @State private var isAddingTime = false
  @State private var failed = false

  var body: some View {
    let summary = store.summary(id: sessionID)

    Group {
      if let value = summary.value {
        content(value)
      } else if case .failed = summary.state {
        ContentUnavailableView {
          Label {
            Text("The summary didn't load", tableName: "Session", comment: "Load failed")
          } icon: {
            Image(systemName: "wifi.exclamationmark")
          }
        } actions: {
          Button {
            Task { await summary.refresh() }
          } label: {
            Text("Try again", tableName: "Session", comment: "Retries loading the summary")
          }
          .buttonStyle(.bordered)
        }
      } else {
        ProgressView()
          .frame(maxWidth: .infinity, maxHeight: .infinity)
      }
    }
    .loads(summary)
    .milestoneCeremony(summary.value?.ceremony)
    .onDisappear {
      action?.cancel()
    }
  }

  private func content(_ summary: SessionSummary) -> some View {
    let visit = "\(sessionID):\(summary.brainPower)"

    return SummaryVisit(visit: visit) {
      PaneSplit {
        List {
          dayResult(summary)
        }
        .celebratesOnce(id: visit)
      } secondary: {
        List {
          onward(summary)
        }
      } single: {
        List {
          dayResult(summary)
          onward(summary)
        }
        .celebratesOnce(id: visit)
      }
    }
  }

  @ViewBuilder
  private func dayResult(_ summary: SessionSummary) -> some View {
    Section {
      VStack(alignment: .leading, spacing: 4) {
        SummaryBuddy(look: learner.summary.value?.buddy ?? BuddyLook())

        title(summary)
          .font(.largeTitle.bold())
          .accessibilityAddTraits(.isHeader)

        if stopped, summary.minutes >= 1 {
          Text(
            "\(studyDuration(minutes: summary.minutes)) so far", tableName: "Session",
            comment: "Time studied in a session stopped for today"
          )
          .monospacedDigit()
          .foregroundStyle(.secondary)
        }
      }
      .listRowBackground(Color.clear)
    }

    Section {
      SummaryTiles(summary: summary, goalKind: learner.summary.value?.shownGoal?.kind)
    }
    .listRowBackground(Color.clear)
    .listRowInsets(EdgeInsets())

    EarnedToday(summary: summary, missionsBonus: store.session(id: sessionID).value?.fullMeal.bonus)
  }

  @ViewBuilder
  private func onward(_ summary: SessionSummary) -> some View {
    if !summary.skillsMoved.isEmpty {
      Section {
        ForEach(summary.skillsMoved, id: \.skillId) { skill in
          Text(skill.name)
        }
      } header: {
        Text("Skills that rose", tableName: "Session", comment: "Skills that moved up")
      }
    }

    if !stopped, let tomorrow = summary.tomorrow {
      Section {
        Label {
          Text(tomorrow.title)
        } icon: {
          KindMark(kind: .lesson)
        }
      } header: {
        Text("Tomorrow", tableName: "Session", comment: "Tomorrow's lesson")
      }
    }

    Section {
      VStack(spacing: 12) {
        Button {
          router.dismissTask()
        } label: {
          Text("Finish", tableName: "Session", comment: "Closes the summary")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.mainAction)
        .controlSize(.large)

        if stopped, let next = store.session(id: sessionID).value?.nextBlock {
          Button {
            keepGoing(next)
          } label: {
            Text("Keep going", tableName: "Session", comment: "Goes on with a stopped session")
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(.bordered)
          .controlSize(.large)
          .disabled(isAddingTime)
        }

        if summary.mistakesSaved > 0 {
          Button {
            router.open(.mistakes)
          } label: {
            Text("See mistakes", tableName: "Session", comment: "Opens the mistakes notebook")
              .frame(maxWidth: .infinity)
          }
          .buttonStyle(.bordered)
          .controlSize(.large)
          .disabled(isAddingTime)
        }

        if summary.finished && summary.extraTime.available {
          Button {
            keepLearning()
          } label: {
            HStack {
              if isAddingTime {
                ProgressView()
              }

              if summary.extraTime.lessons.isEmpty {
                Text(
                  "Study \(summary.extraTime.minutes) more minutes", tableName: "Session",
                  comment: "Adds practice once the day is done")
              } else {
                Text("Keep learning", tableName: "Session", comment: "Adds the next lessons")
              }
            }
            .frame(maxWidth: .infinity)
          }
          .buttonStyle(.bordered)
          .controlSize(.large)
          .disabled(isAddingTime)
        }

        if failed {
          Text(
            "We couldn't open the next step. Try again.", tableName: "Session",
            comment: "Adding time failed"
          )
          .font(.footnote)
          .foregroundStyle(.destructive)
        }
      }
    }
    .listRowBackground(Color.clear)
    .listRowInsets(EdgeInsets())
  }

  private func title(_ summary: SessionSummary) -> Text {
    if stopped || !summary.finished {
      return Text("Done for now", tableName: "Session", comment: "Summary after stopping")
    }

    return summary.minutes < 1
      ? Text("Done in under a minute", tableName: "Session", comment: "Session time")
      : Text(
        "Done in \(studyDuration(minutes: summary.minutes))", tableName: "Session",
        comment: "Session time")
  }

  /// Main's "Keep going" opens the next block, as the next stop's button does.
  private func keepGoing(_ next: StudyBlock) {
    isAddingTime = true
    failed = false

    action = Task {
      let result = await today.open(next, sessionID: sessionID)
      isAddingTime = false

      switch result {
      case .done(.session), .done(.lessonWait):
        // The next stop shows the step, and follows a lesson being written.
        router.playback.resume(sessionID: sessionID)
      case .done(let destination) where !Task.isCancelled:
        router.playback.resume(sessionID: sessionID)
        router.openStudy(destination)
      case .failed:
        failed = true
      case .done, .obsolete:
        break
      }
    }
  }

  private func keepLearning() {
    isAddingTime = true
    failed = false

    action = Task {
      let result = await today.addExtraTime(sessionID: sessionID)
      isAddingTime = false

      switch result {
      case .done(let destination) where !Task.isCancelled:
        router.openStudy(destination)
      case .failed:
        failed = true
      case .done, .obsolete:
        break
      }
    }
  }
}

/// Main's session numbers: right answers, where the goal stands and what comes back to review. What
/// the session earned is its own section.
private struct SummaryTiles: View {
  let summary: SessionSummary
  let goalKind: LearnerGoal.Kind?

  @ScaledMetric(relativeTo: .body) private var minimumWidth = 150.0

  var body: some View {
    StatTileGrid(columns: [4, 2], minimumWidth: minimumWidth) {
      if summary.questions > 0 {
        StatTile(
          label: Text("Right", tableName: "Session", comment: "Questions answered right"),
          value: Text(verbatim: "\(summary.correct)/\(summary.questions)"),
          systemImage: "target", tone: .success, detail: rightDetail)
      }

      if let goal = goalNumber {
        StatTile(
          label: goal.label, value: Text(verbatim: goal.value),
          systemImage: goal.dropped ? "chart.line.downtrend.xyaxis" : "chart.line.uptrend.xyaxis",
          tone: goal.dropped ? .neutral : .success,
          detail: goal.before.map { Text(verbatim: "\($0) → \(goal.value)") })
      }

      StatTile(
        label: Text("To review", tableName: "Session", comment: "Topics that come back to review"),
        value: Text(summary.comesBack.reduce(0) { $0 + $1.skills }, format: .number),
        systemImage: "arrow.counterclockwise", detail: comesBack)
    }
  }

  private var rightDetail: Text? {
    let parts = [
      summary.accuracy.map { $0.formatted(.percent.precision(.fractionLength(0))) },
      summary.netScore.map {
        String(localized: "net \($0)", table: "Session", comment: "Right minus wrong answers")
      },
    ].compactMap(\.self)

    return parts.isEmpty ? nil : Text(verbatim: parts.joined(separator: " · "))
  }

  /// A language goal has no number here; an exam shows its preparation, any other goal its
  /// progress.
  private var goalNumber: (label: Text, value: String, before: String?, dropped: Bool)? {
    let share: SessionSummary.Share

    switch goalKind {
    case .exam: share = summary.preparation
    case .learn: share = summary.progress
    case .language, .explain, nil: return nil
    }

    guard let after = share.after else {
      return nil
    }

    let start = share.before ?? after
    let format: (Double) -> String =
      goalKind == .exam
      ? { $0.formatted(.percent.precision(.fractionLength(0))) }
      : { $0.formatted(.percent.precision(.fractionLength(0...2))) }
    let moved = format(after) != format(start)

    return (
      goalKind == .exam
        ? Text("Preparation", tableName: "Session", comment: "An exam's preparation")
        : Text("Progress", tableName: "Session", comment: "The goal's progress"),
      format(after), moved ? format(start) : nil, moved && after < start
    )
  }

  private var comesBack: Text? {
    guard !summary.comesBack.isEmpty else {
      return nil
    }

    let days = summary.comesBack.compactMap { studyDate($0.date) }
      .map { $0.formatted(.studyDay.month(.abbreviated).day()) }

    return Text(
      "Back \(days.formatted(.list(type: .and)))", tableName: "Session",
      comment: "When the topics to review come back, such as Back Oct 30 and Nov 7")
  }
}

/// Main's `useFirstSummaryVisit`: only the summary's first visit celebrates.
private let celebratedSummaryKey = "celebratedSessionSummary"

private struct SummaryVisit<Content: View>: View {
  let visit: String
  @ViewBuilder let content: Content

  @State private var isFirstVisit: Bool

  init(visit: String, @ViewBuilder content: () -> Content) {
    self.visit = visit
    self.content = content()
    _isFirstVisit = State(
      initialValue: UserDefaults.standard.string(forKey: celebratedSummaryKey) != visit)
  }

  var body: some View {
    content
      .environment(\.celebrates, isFirstVisit)
      .onAppear {
        UserDefaults.standard.set(visit, forKey: celebratedSummaryKey)
      }
  }
}

private struct SummaryBuddy: View {
  @Environment(\.celebrates) private var celebrates

  let look: BuddyLook

  var body: some View {
    var studied = look
    studied.studiedToday = true

    return BuddyCharacter(
      look: studied, expression: celebrates ? .happy : .proud,
      reaction: celebrates ? ActReaction(act: .proud, delay: .beat) : nil
    )
    .frame(width: 96, height: 96)
  }
}

/// Main's `EarnedToday`: the Brain Power the session earned, then the day's missions bonus, a belt's
/// new levels and the best streak as rows. The bonus is once a day across goals, so another goal's
/// earning it never says this goal's missions are done.
private struct EarnedToday: View {
  let summary: SessionSummary
  let missionsBonus: Int?

  private static let shownStreak = 3

  private var missionsDone: Bool {
    summary.fullMeal && !summary.missions.isEmpty && summary.missions.allSatisfy(\.isDone)
  }

  private var stripes: SessionSummary.Belt? {
    guard let belt = summary.belt, belt.stripesGained > 0 else { return nil }
    return belt
  }

  private var streak: Int? {
    summary.bestStreak >= Self.shownStreak ? summary.bestStreak : nil
  }

  var body: some View {
    if summary.brainPower > 0 || missionsDone || stripes != nil || streak != nil {
      Section {
        if summary.brainPower > 0 {
          HStack(alignment: .firstTextBaseline, spacing: 6) {
            EarnedNumber(value: summary.brainPower)
              .font(.largeTitle.weight(.semibold))
              .foregroundStyle(.brain)

            Text("Brain Power", tableName: "Session", comment: "Brain Power earned")
              .font(.subheadline.weight(.medium))
              .foregroundStyle(.secondary)
          }
          .accessibilityElement(children: .combine)
        }

        if missionsDone {
          LabeledContent {
            if let missionsBonus {
              Text(missionsBonus, format: .number.sign(strategy: .always()))
                .monospacedDigit()
                .foregroundStyle(.brain)
            }
          } label: {
            Label {
              Text("Today's missions", tableName: "Session", comment: "The missions' header")
              Text(
                "All \(summary.missions.count) done", tableName: "Session",
                comment: "Every one of the day's missions is done")
            } icon: {
              Image(systemName: "checklist")
            }
          }
        }

        if let stripes, let belt = ProgressBelt(rawValue: stripes.after.color) {
          VStack(alignment: .leading, spacing: 8) {
            LabeledContent {
              Text(
                "+\(stripes.stripesGained) levels", tableName: "Session",
                comment: "How many belt levels the session added"
              )
              .monospacedDigit()
              .foregroundStyle(.success)
            } label: {
              Label {
                Text(
                  "\(beltName(stripes.after.color) ?? stripes.after.color), level \(stripes.after.level)",
                  tableName: "Session", comment: "The belt and level reached")
              } icon: {
                BeltDot(belt: belt)
              }
            }

            // The ticks hold still: each level already landed at the end of the block that reached it.
            BeltTicks(belt: belt, level: stripes.after.level)
          }
          .accessibilityElement(children: .combine)
        }

        if let streak {
          Label {
            Text(
              "\(streak) right in a row", tableName: "Session",
              comment: "The session's most right answers in a row")
          } icon: {
            Image(systemName: "chevron.up.2")
          }
        }
      } header: {
        Text("Earned today", tableName: "Session", comment: "What the session earned")
      }
    }
  }
}
