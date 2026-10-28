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
  @ScaledMetric(relativeTo: .body) private var beltDotSize: CGFloat = 12

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
  }

  private func content(_ summary: SessionSummary) -> some View {
    PaneSplit {
      List {
        dayResult(summary)
      }
    } secondary: {
      List {
        onward(summary)
      }
    } single: {
      List {
        dayResult(summary)
        onward(summary)
      }
    }
  }

  @ViewBuilder
  private func dayResult(_ summary: SessionSummary) -> some View {
    Section {
      VStack(alignment: .leading, spacing: 4) {
        SummaryBuddy(
          look: learner.summary.value?.buddy ?? BuddyLook(),
          visit: "\(sessionID):\(summary.brainPower)")

        title(summary)
          .font(.largeTitle.bold())
          .accessibilityAddTraits(.isHeader)

        Text(time(summary))
          .foregroundStyle(.secondary)
      }
      .listRowBackground(Color.clear)
    }

    Section {
      Grid(alignment: .leading, horizontalSpacing: 16, verticalSpacing: 4) {
        GridRow {
          stat(
            Text("Right", tableName: "Session", comment: "Questions answered right"),
            value: summary.questions > 0 ? "\(summary.correct)/\(summary.questions)" : "–")
          stat(
            Text("Brain Power", tableName: "Session", comment: "Brain Power earned"),
            value: "+\(summary.brainPower)", color: .brain)
          stat(
            Text("Best streak", tableName: "Session", comment: "Most right in a row"),
            value: "\(summary.bestStreak)")
        }
      }
    }

    if !summary.missions.isEmpty {
      Section {
        ForEach(Array(summary.missions.enumerated()), id: \.offset) { _, mission in
          MissionRow(mission: mission, buddyName: buddyName)
        }
      } header: {
        Text("Today's missions", tableName: "Session", comment: "The missions' header")
      } footer: {
        if summary.fullMeal {
          Text("All done. +50 Brain Power.", tableName: "Session", comment: "Missions done")
        }
      }
    }

    if let belt = summary.belt {
      Section {
        Label {
          Text(
            "\(beltName(belt.after.color) ?? belt.after.color), level \(belt.after.level)",
            tableName: "Session", comment: "The belt and level reached")
        } icon: {
          // The belt's own color, ringed so a white belt shows on a light row.
          Circle()
            .fill(ProgressBelt(rawValue: belt.after.color)?.color ?? .secondary)
            .strokeBorder(.secondary.opacity(0.35), lineWidth: 1)
            .frame(width: beltDotSize, height: beltDotSize)
        }
      }
    }

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

    if let tomorrow = summary.tomorrow {
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

  private var buddyName: String {
    learner.buddyDisplayName
  }

  private func title(_ summary: SessionSummary) -> Text {
    stopped || !summary.finished
      ? Text("Done for now", tableName: "Session", comment: "Summary after stopping")
      : Text("Session complete", tableName: "Session", comment: "Summary of a finished day")
  }

  private func time(_ summary: SessionSummary) -> String {
    summary.minutes < 1
      ? String(localized: "Done in under a minute", table: "Session", comment: "Session time")
      : String(
        localized: "Done in \(studyDuration(minutes: summary.minutes))", table: "Session",
        comment: "Session time")
  }

  private func stat(_ label: Text, value: String, color: Color = .primary) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(value)
        .font(.title2.bold().monospacedDigit())
        .foregroundStyle(color)
      label
        .font(.footnote)
        .foregroundStyle(.secondary)
    }
    .accessibilityElement(children: .combine)
  }

  private func keepLearning() {
    isAddingTime = true
    failed = false

    action = Task {
      let result = await today.addExtraTime(sessionID: sessionID)
      isAddingTime = false

      switch result {
      case .done(let destination) where !Task.isCancelled:
        router.openStudy(destination, sessions: store)
      case .failed:
        failed = true
      case .done, .obsolete:
        break
      }
    }
  }
}

/// Only the summary's first visit plays it, as main's `useFirstSummaryVisit` decides.
private struct SummaryBuddy: View {
  private static let celebratedKey = "celebratedSessionSummary"

  let look: BuddyLook
  let visit: String

  @State private var isFirstVisit: Bool

  init(look: BuddyLook, visit: String) {
    self.look = look
    self.visit = visit
    _isFirstVisit = State(
      initialValue: UserDefaults.standard.string(forKey: Self.celebratedKey) != visit)
  }

  var body: some View {
    var studied = look
    studied.studiedToday = true

    return BuddyCharacter(
      look: studied, expression: isFirstVisit ? .happy : .proud,
      reaction: isFirstVisit ? ActReaction(act: .proud, delay: .beat) : nil
    )
    .frame(width: 96, height: 96)
    .onAppear { UserDefaults.standard.set(visit, forKey: Self.celebratedKey) }
  }
}
