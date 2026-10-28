import SwiftUI

/// The learner's last week (`GET /v1/me/weekly-recap`), as the logbook draws it.
struct WeeklyRecap: Decodable, Equatable, Sendable {
  struct Week: Decodable, Equatable, Sendable {
    let daysStudied: [String]
    let minutes: Int
    let questions: Int
  }

  struct Comparison: Decodable, Equatable, Sendable {
    let minutes: Int
    let questions: Int
  }

  struct BuddyAte: Decodable, Equatable, Sendable {
    let fixes: Int
    let newIdeas: Int
    let reviews: Int
  }

  struct PhaseFinished: Decodable, Equatable, Sendable {
    let name: String
    let phase: Int
  }

  struct NextFocus: Decodable, Equatable, Sendable {
    let title: String
  }

  struct Turnaround: Decodable, Equatable, Sendable {
    let from: Double
    let name: String
    let reason: String
    let rememberedOn: [String]
    let to: Double
  }

  let badges: [Milestone]
  let buddyAte: BuddyAte
  let comparison: Comparison
  let nextFocus: NextFocus?
  let phasesFinished: [PhaseFinished]
  let ready: Bool
  let turnaround: Turnaround?
  let week: Week
  let weekEnd: String
  let weekStart: String
}

/// The weekly recap as a full-screen task: the week's days and numbers, the skill that grew the
/// most, what the learner learned, and what the plan does next week.
struct LogbookScreen: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(SessionStore.self) private var session
  @Environment(StudySessionStore.self) private var store

  var body: some View {
    let recap = store.weeklyRecap(goalID: learner.summary.value?.activeGoalID)

    NavigationStack {
      Group {
        switch recap.state {
        case .loaded(let value) where value.ready && value.week.minutes > 0:
          content(value)
        case .loaded(let value):
          ContentUnavailableView {
            Label {
              value.ready
                ? Text("A quiet week", tableName: "Session", comment: "A week without study")
                : Text(
                  "Your first summary comes on Sunday", tableName: "Session",
                  comment: "No weekly summary yet")
            } icon: {
              Image(systemName: "calendar")
            }
          } description: {
            value.ready
              ? Text("Every week starts fresh.", tableName: "Session", comment: "A quiet week")
              : Text(
                "It shows your week in numbers and the skill that grew the most.",
                tableName: "Session", comment: "What the weekly summary shows")
          }
        case .failed(let error) where error != .unauthorized:
          ContentUnavailableView {
            Label {
              Text("The summary didn't load", tableName: "Session", comment: "Load failed")
            } icon: {
              Image(systemName: "wifi.exclamationmark")
            }
          } actions: {
            Button {
              Task { await recap.refresh() }
            } label: {
              Text("Try again", tableName: "Session", comment: "Retries loading")
            }
            .buttonStyle(.bordered)
          }
        default:
          ProgressView()
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
      }
      .loads(recap)
      .navigationTitle(Text("Logbook", tableName: "Session", comment: "The weekly recap's title"))
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button(role: .close) {
            dismiss()
          }
        }
      }
    }
  }

  private func content(_ recap: WeeklyRecap) -> some View {
    List {
      Section {
        VStack(alignment: .leading, spacing: 6) {
          Text(eyebrow(recap))
            .font(.subheadline)
            .foregroundStyle(.secondary)

          title
            .font(.largeTitle.bold())
            .accessibilityAddTraits(.isHeader)

          if let gain = gain(recap) {
            Text(gain)
              .foregroundStyle(.success)
          }
        }
        .listRowBackground(Color.clear)

        WeekRings(recap: recap)
      }

      Section {
        LabeledContent {
          Text(studyDuration(minutes: recap.week.minutes))
            .monospacedDigit()
        } label: {
          Label {
            Text("Time", tableName: "Session", comment: "The week's study time")
          } icon: {
            Image(systemName: "clock")
          }
        }

        LabeledContent {
          Text(recap.week.questions, format: .number)
        } label: {
          Label {
            Text("Questions", tableName: "Session", comment: "The week's questions")
          } icon: {
            Image(systemName: "checklist")
          }
        }
      }

      if let turnaround = recap.turnaround {
        Section {
          VStack(alignment: .leading, spacing: 4) {
            Text(turnaround.name)
              .font(.headline)

            Text(
              "\(turnaround.from.formatted(.percent.precision(.fractionLength(0)))) → \(turnaround.to.formatted(.percent.precision(.fractionLength(0)))) right answers",
              tableName: "Session", comment: "A skill's right answers at the week's start and end"
            )
            .monospacedDigit()
            .foregroundStyle(.secondary)
          }
        } header: {
          Text("The biggest turnaround", tableName: "Session", comment: "The skill that grew most")
        }
      }

      Section {
        LabeledContent {
          Text(recap.buddyAte.newIdeas, format: .number)
        } label: {
          Text("New ideas", tableName: "Session", comment: "New ideas learned this week")
        }

        LabeledContent {
          Text(recap.buddyAte.reviews, format: .number)
        } label: {
          Text("Reviews", tableName: "Session", comment: "Reviews done this week")
        }

        LabeledContent {
          Text(recap.buddyAte.fixes, format: .number)
        } label: {
          Text("Mistakes fixed", tableName: "Session", comment: "Mistakes fixed this week")
        }

        if !recap.badges.isEmpty {
          LabeledContent {
            Text(recap.badges.count, format: .number)
          } label: {
            Text("Trap hunter badges", tableName: "Session", comment: "Badges earned this week")
          }
        }
      } header: {
        Text("What you learned", tableName: "Session", comment: "The week's learning")
      }

      if let next = recap.nextFocus {
        Section {
          Text(next.title)
        } header: {
          Text("Next week", tableName: "Session", comment: "The plan's next week")
        }
      }

      Section {
        Button {
          router.showRoot(of: .today)
        } label: {
          Text("Let's go", tableName: "Session", comment: "Closes the recap and opens Today")
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.mainAction)
        .controlSize(.large)
      }
      .listRowBackground(Color.clear)
      .listRowInsets(EdgeInsets())
    }
  }

  private var title: Text {
    let name = session.account?.user.name.split(separator: " ").first.map(String.init)

    if let name, learner.summary.value?.identity.isAnonymous != true {
      return Text("What a week, \(name)!", tableName: "Session", comment: "The recap's title")
    }

    return Text("What a week!", tableName: "Session", comment: "The recap's title")
  }

  private func eyebrow(_ recap: WeeklyRecap) -> String {
    if let finished = recap.phasesFinished.first {
      return String(
        localized: "Phase \(finished.phase + 1) · \(finished.name) done", table: "Session",
        comment: "A phase finished this week")
    }

    let range = [recap.weekStart, recap.weekEnd].compactMap(studyDate)
    let text =
      range.count == 2
      ? (range[0]..<range[1]).formatted(
        Date.IntervalFormatStyle(timeZone: .gmt).month(.abbreviated).day())
      : recap.weekStart

    return String(
      localized: "Weekly summary · \(text)", table: "Session", comment: "The recap's week")
  }

  /// Only good news is compared; a quieter week starts over.
  private func gain(_ recap: WeeklyRecap) -> String? {
    if recap.comparison.minutes > 0 {
      return String(
        localized: "\(studyDuration(minutes: recap.comparison.minutes)) more than the week before!",
        table: "Session", comment: "More time than last week")
    }

    if recap.comparison.questions > 0 {
      return String(
        localized: "\(recap.comparison.questions) more questions than the week before!",
        table: "Session", comment: "More questions than last week")
    }

    return nil
  }
}

/// The week's seven days, each marked studied or not.
private struct WeekRings: View {
  let recap: WeeklyRecap

  var body: some View {
    let start = studyDate(recap.weekStart)

    HStack {
      ForEach(0..<7, id: \.self) { offset in
        let date = start.map { $0.addingTimeInterval(Double(offset) * 86_400) }
        let key = date?.formatted(.iso8601.year().month().day()) ?? ""
        let studied = recap.week.daysStudied.contains(key)

        VStack(spacing: 4) {
          Image(systemName: studied ? "checkmark.circle.fill" : "circle")
            .font(.title3)
            .foregroundStyle(studied ? AnyShapeStyle(.success) : AnyShapeStyle(.quaternary))

          Text(date?.formatted(.studyDay.weekday(.narrow)) ?? "")
            .font(.caption2)
            .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Text(date?.formatted(.studyDay.weekday(.wide)) ?? ""))
        .accessibilityValue(
          studied
            ? Text("Studied", tableName: "Session", comment: "A day studied this week")
            : Text("Not studied", tableName: "Session", comment: "A day not studied"))
      }
    }
    .padding(.vertical, 4)
  }
}
