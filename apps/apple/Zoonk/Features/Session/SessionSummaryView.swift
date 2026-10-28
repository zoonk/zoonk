import SwiftUI

/// The end of today's session, or what's done so far once the learner stops: the time, what they
/// got right and the Brain Power earned, the missions, the belt, the skills that rose and what
/// comes tomorrow; its milestone's ceremony first, once. Finish goes back to Today, and "Keep
/// learning" adds the plan's next lessons when there's time for them.
struct SessionSummaryView: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(AppRouter.self) private var router
  @Environment(StudySessionStore.self) private var store
  @Environment(TodayStore.self) private var today

  let sessionID: String
  let stopped: Bool

  @State private var ceremony: Milestone?
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
    .onChange(of: summary.value?.ceremony, initial: true) { _, milestone in
      if ceremony == nil, let milestone {
        ceremony = milestone
      }
    }
    .fullScreenCover(item: $ceremony) { milestone in
      MilestoneCeremony(milestone: milestone) {
        ceremony = nil
      }
    }
  }

  private func content(_ summary: SessionSummary) -> some View {
    List {
      Section {
        VStack(alignment: .leading, spacing: 4) {
          title(summary)
            .font(.largeTitle.bold())
            .accessibilityAddTraits(.isHeader)

          Text(time(summary))
            .foregroundStyle(.secondary)
        }
        .listRowBackground(Color.clear)
        .listRowInsets(EdgeInsets())
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
            HStack(alignment: .firstTextBaseline, spacing: 12) {
              StatusMark(status: mission.isDone ? .done : .todo)
              Text(mission.name(buddy: "Zu"))
                .foregroundStyle(mission.isDone ? .secondary : .primary)
            }
            .accessibilityElement(children: .combine)
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
            Image(systemName: "figure.martial.arts")
          }
        }
      }

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

    Task {
      let destination = await today.addExtraTime(sessionID: sessionID)
      isAddingTime = false

      if let destination {
        router.openStudy(destination)
      } else {
        failed = true
      }
    }
  }
}
