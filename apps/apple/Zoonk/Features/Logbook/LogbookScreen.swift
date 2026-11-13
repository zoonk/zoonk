import SwiftUI

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

  var isQuiet: Bool { !ready || week.daysStudied.isEmpty }
}

struct LogbookScreen: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(LearnerSummaryStore.self) private var learner
  @Environment(SessionStore.self) private var session
  @Environment(StudySessionStore.self) private var store

  var body: some View {
    let recap = store.weeklyRecap(goalID: learner.summary.value?.activeGoalID)

    NavigationStack {
      Group {
        switch recap.state {
        case .loaded(let value):
          WeeklySummary(recap: value, learnerName: learnerName)
            .onAppear {
              UsageAnalytics.track(.logbookViewed)
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
            .buttonStyle(.outline)
          }
          .lonePage()
        default:
          ProgressView()
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
      }
      .loads(recap)
      .barName(
        Text("Weekly summary", tableName: "Session", comment: "The weekly summary's name")
      )
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button(role: .close) {
            dismiss()
          }
        }
      }
    }
  }

  /// A guest has no name of their own: their placeholder would read "What a week, Guest!".
  private var learnerName: String? {
    guard learner.summary.value?.identity.isAnonymous != true else {
      return nil
    }

    return session.account?.user.name.split(separator: " ").first.map(String.init)
  }
}

/// Main's one screen: the week's days, two numbers, then a row for each thing that happened. A
/// row with nothing to count isn't drawn.
private struct WeeklySummary: View {
  @Environment(AppRouter.self) private var router
  @ScaledMetric(relativeTo: .body) private var tileWidth = 150.0

  let recap: WeeklyRecap
  let learnerName: String?

  var body: some View {
    ZoonkList {
      Section {
        WeekRings(recap: recap)
          .listRowBackground(Color.clear)
          .listRowSeparator(.hidden)

        header
      }

      if !recap.isQuiet {
        Section {
          StatTileGrid(columns: [2, 1], minimumWidth: tileWidth) {
            StatTile(
              label: Text("Time", tableName: "Session", comment: "The week's study time"),
              quantity: studyDuration(minutes: recap.week.minutes),
              systemImage: "clock")
            StatTile(
              label: Text("Questions", tableName: "Session", comment: "The week's questions"),
              value: Text(recap.week.questions, format: .number),
              systemImage: "checklist")
          }
          .listRowBackground(Color.clear)
          .listRowSeparator(.hidden)
        }

        Section {
          row(
            Text("New topics", tableName: "Session", comment: "New topics learned this week"),
            count: recap.buddyAte.newIdeas)
          row(
            Text("Reviews done", tableName: "Session", comment: "Reviews done this week"),
            count: recap.buddyAte.reviews)
          row(
            Text("Mistakes fixed", tableName: "Session", comment: "Mistakes fixed this week"),
            count: recap.buddyAte.fixes)
          row(
            Text("Trap hunter badges", tableName: "Session", comment: "Badges earned this week"),
            count: recap.badges.count)

          if let turnaround = recap.turnaround {
            row(
              Text("Most improved", tableName: "Session", comment: "The topic that grew most"),
              value: Text(
                "\(turnaround.name)\u{00A0}· \(percent(turnaround.from)) to \(percent(turnaround.to))",
                tableName: "Session",
                comment:
                  "The topic that grew most, then its right answers at the week's start and end, as in Fractions · 40% to 85%"
              ))
          }

          if let next = recap.nextFocus {
            row(
              Text("Up next", tableName: "Session", comment: "What the next study day starts with"),
              value: Text(next.title))
          }
        }
      }
    }
    .bottomBar {
      Button {
        router.showRoot(of: .today)
      } label: {
        Text("Done", tableName: "Session", comment: "Closes the weekly summary and opens Today")
      }
      .buttonStyle(.mainAction)
      .keyboardShortcut(.defaultAction)
    }
  }

  private var header: some View {
    VStack(alignment: .leading, spacing: 6) {
      Chip(Text(weekRange))
        .padding(.bottom, 6)

      title
        .typeStyle(.pageTitle)
        .accessibilityAddTraits(.isHeader)

      if let line {
        line
          .typeStyle(.reading)
          .foregroundStyle(.mutedForeground)
      }
    }
    .listRowBackground(Color.clear)
  }

  private var title: Text {
    if !recap.ready {
      return Text(
        "Your first weekly summary comes this Sunday", tableName: "Session",
        comment: "No weekly summary yet")
    }

    if recap.isQuiet {
      return Text("A quiet week", tableName: "Session", comment: "A week without study")
    }

    if let learnerName {
      return Text(
        "What a week, \(learnerName)!", tableName: "Session", comment: "The recap's title")
    }

    return Text("What a week!", tableName: "Session", comment: "The recap's title")
  }

  /// A finished phase leads; otherwise only good news is compared, and a quieter week starts over.
  private var line: Text? {
    if !recap.ready {
      return nil
    }

    if recap.isQuiet {
      return Text("Every week starts fresh.", tableName: "Session", comment: "A quiet week")
    }

    if let finished = recap.phasesFinished.first {
      return Text(
        "You finished \(finished.name).", tableName: "Session",
        comment: "Under the weekly summary's title: the plan's phase that ended this week")
    }

    if recap.comparison.minutes > 0 {
      return Text(
        "\(studyDuration(minutes: recap.comparison.minutes)) more than the week before!",
        tableName: "Session", comment: "More time than last week")
    }

    if recap.comparison.questions > 0 {
      return Text(
        "\(recap.comparison.questions) more questions than the week before!",
        tableName: "Session", comment: "More questions than last week")
    }

    return nil
  }

  private var weekRange: String {
    let range = [recap.weekStart, recap.weekEnd].compactMap(studyDate)
    let text =
      range.count == 2
      ? (range[0]..<range[1]).formatted(
        Date.IntervalFormatStyle(timeZone: .gmt).month(.abbreviated).day())
      : recap.weekStart

    return String(
      localized: "Weekly summary\u{00A0}· \(text)", table: "Session", comment: "The recap's week")
  }

  @ViewBuilder
  private func row(_ label: Text, count: Int) -> some View {
    if count > 0 {
      row(label, value: Text(count, format: .number))
    }
  }

  private func row(_ label: Text, value: Text) -> some View {
    ListRow(label) {
      EmptyView()
    } trailing: {
      value
        .typeStyle(.meta)
        .multilineTextAlignment(.trailing)
    }
    .accessibilityElement(children: .combine)
  }

  private func percent(_ share: Double) -> String {
    share.formatted(.percent.precision(.fractionLength(0)))
  }
}

private struct WeekRings: View {
  let recap: WeeklyRecap

  @ScaledMetric(relativeTo: .title3) private var ringSize = 36.0

  var body: some View {
    let start = studyDate(recap.weekStart)

    HStack {
      ForEach(0..<7, id: \.self) { offset in
        let date = start.map { $0.addingTimeInterval(Double(offset) * 86_400) }
        let key = date?.formatted(.iso8601.year().month().day()) ?? ""
        let studied = recap.week.daysStudied.contains(key)

        VStack(spacing: 6) {
          GoalRing(share: studied ? 1 : 0, size: ringSize) {
            if studied {
              Image(systemName: "checkmark")
                .foregroundStyle(.success)
            }
          }

          Text(date?.formatted(.studyDay.weekday(.narrow)) ?? "")
            .typeStyle(.small.monospaced())
            .foregroundStyle(studied ? Color(.foreground) : .faint)
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
    .dynamicTypeSize(...DynamicTypeSize.accessibility1)
    .padding(.vertical, 4)
  }
}
