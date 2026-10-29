import Charts
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
    enum Reason: String, Decodable, Sendable {
      case gold
      case practice
      case solid
    }

    struct Point: Decodable, Equatable, Sendable {
      let accuracy: Double?
      let date: String
    }

    let from: Double
    let name: String
    let points: [Point]
    let reason: Reason
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

  var isQuiet: Bool { !ready || week.daysStudied.isEmpty }

  /// Main's story: the week, its biggest turnaround, what was learned, then next week.
  var steps: [LogbookStep] {
    guard !isQuiet else {
      return [.week]
    }

    return LogbookStep.allCases.filter { step in
      switch step {
      case .week: true
      case .turnaround: turnaround != nil
      case .learned: buddyAte.newIdeas + buddyAte.reviews + buddyAte.fixes + badges.count > 0
      case .next: nextFocus != nil
      }
    }
  }
}

enum LogbookStep: CaseIterable, Hashable {
  case week
  case turnaround
  case learned
  case next
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
          LogbookSteps(recap: value, learnerName: learnerName)
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

  /// A guest has no name of their own: their placeholder would read "What a week, Guest!".
  private var learnerName: String? {
    guard learner.summary.value?.identity.isAnonymous != true else {
      return nil
    }

    return session.account?.user.name.split(separator: " ").first.map(String.init)
  }
}

/// One step at a time, as main tells it; a swipe or Continue turns the page. Two panes have room
/// for the whole story at once.
private struct LogbookSteps: View {
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @Environment(AppRouter.self) private var router
  @State private var current = LogbookStep.week
  @AccessibilityFocusState private var focusedStep: LogbookStep?

  let recap: WeeklyRecap
  let learnerName: String?

  var body: some View {
    let steps = recap.steps

    PaneSplit {
      List {
        page(.week)
      }
    } secondary: {
      List {
        ForEach(steps.filter { $0 != .week }, id: \.self) { step in
          page(step)
        }

        Section {
          letsGo
            .controlSize(.large)
        }
        .listRowBackground(Color.clear)
        .listRowInsets(EdgeInsets())
      }
    } single: {
      TabView(selection: $current) {
        ForEach(steps, id: \.self) { step in
          List {
            page(step)
          }
          .tag(step)
        }
      }
      .tabViewStyle(.page(indexDisplayMode: steps.count > 1 ? .always : .never))
      .indexViewStyle(.page(backgroundDisplayMode: .always))
      .background(Color(.systemGroupedBackground))
      .safeAreaBar(edge: .bottom) {
        action(steps)
          .controlSize(.large)
          .scenePadding(.horizontal)
          .padding(.vertical, 10)
          .keepsOffFold()
      }
    }
    .onChange(of: current) {
      focusedStep = current
    }
  }

  @ViewBuilder
  private func action(_ steps: [LogbookStep]) -> some View {
    let position = steps.firstIndex(of: current) ?? 0

    if position + 1 < steps.count {
      Button {
        withAnimation(reduceMotion ? nil : .default) {
          current = steps[position + 1]
        }
      } label: {
        Text("Continue", tableName: "Session", comment: "Turns to the recap's next step")
          .frame(maxWidth: .infinity)
      }
      .buttonStyle(.mainAction)
    } else {
      letsGo
    }
  }

  private var letsGo: some View {
    Button {
      router.showRoot(of: .today)
    } label: {
      Text("Let's go", tableName: "Session", comment: "Closes the recap and opens Today")
        .frame(maxWidth: .infinity)
    }
    .buttonStyle(.mainAction)
  }

  @ViewBuilder
  private func page(_ step: LogbookStep) -> some View {
    switch step {
    case .week:
      weekPage
    case .turnaround:
      if let turnaround = recap.turnaround {
        Section {
          header(
            .turnaround,
            eyebrow: Text(
              "The biggest turnaround", tableName: "Session", comment: "The skill that grew most"),
            title: Text(turnaround.name),
            detail: Text(
              "\(turnaround.from.formatted(.percent.precision(.fractionLength(0)))) → \(turnaround.to.formatted(.percent.precision(.fractionLength(0)))) right answers",
              tableName: "Session", comment: "A skill's right answers at the week's start and end"
            )
            .monospacedDigit())
        }

        Section {
          TurnaroundChart(turnaround: turnaround)

          if let reason = reason(turnaround) {
            reason
          }
        }
      }
    case .learned:
      Section {
        header(
          .learned,
          title: Text("What you learned", tableName: "Session", comment: "The week's learning"))
      }

      Section {
        learnedRow(
          .lesson, Text("New ideas", tableName: "Session", comment: "New ideas learned this week"),
          count: recap.buddyAte.newIdeas)
        learnedRow(
          .review, Text("Reviews", tableName: "Session", comment: "Reviews done this week"),
          count: recap.buddyAte.reviews)
        learnedRow(
          .mistakes,
          Text("Mistakes fixed", tableName: "Session", comment: "Mistakes fixed this week"),
          count: recap.buddyAte.fixes)

        if !recap.badges.isEmpty {
          LabeledContent {
            Text(recap.badges.count, format: .number)
          } label: {
            Label {
              Text("Trap hunter badges", tableName: "Session", comment: "Badges earned this week")
            } icon: {
              Image(systemName: "rosette")
                .foregroundStyle(.secondary)
            }
          }
        }
      }
    case .next:
      if let next = recap.nextFocus {
        Section {
          header(
            .next,
            eyebrow: Text("Next week", tableName: "Session", comment: "The plan's next week"),
            title: Text(next.title))
        }
      }
    }
  }

  @ViewBuilder
  private var weekPage: some View {
    Section {
      WeekRings(recap: recap)
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)

      if recap.isQuiet {
        header(
          .week, eyebrow: Text(weekRange),
          title: recap.ready
            ? Text("A quiet week", tableName: "Session", comment: "A week without study")
            : Text(
              "Your first summary comes on Sunday", tableName: "Session",
              comment: "No weekly summary yet"),
          detail: recap.ready
            ? Text("Every week starts fresh.", tableName: "Session", comment: "A quiet week")
            : Text(
              "It shows your week in numbers and the skill that grew the most.",
              tableName: "Session", comment: "What the weekly summary shows"))
      } else {
        header(.week, eyebrow: Text(weekEyebrow), title: weekTitle, detail: gain)
      }
    }

    if !recap.isQuiet {
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
    }
  }

  private func header(
    _ step: LogbookStep, eyebrow: Text? = nil, title: Text, detail: Text? = nil
  ) -> some View {
    VStack(alignment: .leading, spacing: 6) {
      if let eyebrow {
        eyebrow
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }

      title
        .font(.largeTitle.bold())
        .accessibilityAddTraits(.isHeader)
        .accessibilityFocused($focusedStep, equals: step)

      if let detail {
        detail
          .foregroundStyle(.secondary)
      }
    }
    .listRowBackground(Color.clear)
  }

  @ViewBuilder
  private func learnedRow(_ kind: LearnKind, _ label: Text, count: Int) -> some View {
    if count > 0 {
      LabeledContent {
        Text(count, format: .number)
      } label: {
        Label {
          label
        } icon: {
          KindMark(kind: kind)
        }
      }
    }
  }

  private func reason(_ turnaround: WeeklyRecap.Turnaround) -> Text? {
    switch turnaround.reason {
    case .gold:
      Text(
        "\(turnaround.name) is Mastered now: you remembered it on \(turnaround.rememberedOn.count) different days.",
        tableName: "Session",
        comment:
          "Why the week's biggest turnaround grew: its skill, then the days it was remembered on"
      )
    case .solid:
      Text(
        "\(turnaround.name) is Solid now: you kept getting it right on later days.",
        tableName: "Session",
        comment: "Why the week's biggest turnaround grew; the argument is its skill"
      )
    case .practice:
      nil
    }
  }

  private var weekTitle: Text {
    if let learnerName {
      return Text(
        "What a week, \(learnerName)!", tableName: "Session", comment: "The recap's title")
    }

    return Text("What a week!", tableName: "Session", comment: "The recap's title")
  }

  private var weekRange: String {
    let range = [recap.weekStart, recap.weekEnd].compactMap(studyDate)
    let text =
      range.count == 2
      ? (range[0]..<range[1]).formatted(
        Date.IntervalFormatStyle(timeZone: .gmt).month(.abbreviated).day())
      : recap.weekStart

    return String(
      localized: "Weekly summary · \(text)", table: "Session", comment: "The recap's week")
  }

  private var weekEyebrow: String {
    guard let finished = recap.phasesFinished.first else {
      return weekRange
    }

    return String(
      localized: "Phase \(finished.phase + 1) · \(finished.name) done", table: "Session",
      comment: "A phase finished this week")
  }

  /// Only good news is compared; a quieter week starts over.
  private var gain: Text? {
    if recap.comparison.minutes > 0 {
      return Text(
        "\(studyDuration(minutes: recap.comparison.minutes)) more than the week before!",
        tableName: "Session", comment: "More time than last week"
      )
      .foregroundStyle(.success)
    }

    if recap.comparison.questions > 0 {
      return Text(
        "\(recap.comparison.questions) more questions than the week before!",
        tableName: "Session", comment: "More questions than last week"
      )
      .foregroundStyle(.success)
    }

    return nil
  }
}

/// Right answers on the skill each day it was studied, across the week's seven days.
private struct TurnaroundChart: View {
  let turnaround: WeeklyRecap.Turnaround

  var body: some View {
    let days = Array(turnaround.points.enumerated())

    Chart {
      RuleMark(y: .value(rightAnswers, 0.0))
        .foregroundStyle(Color(.separator))

      ForEach(days, id: \.offset) { index, point in
        if let accuracy = point.accuracy {
          LineMark(x: .value(day, index), y: .value(rightAnswers, accuracy))
            .lineStyle(StrokeStyle(lineWidth: 3, lineCap: .round))
            .foregroundStyle(.success)

          PointMark(x: .value(day, index), y: .value(rightAnswers, accuracy))
            .symbolSize(64)
            .foregroundStyle(.success)
            .accessibilityLabel(Text(weekday(point, .wide)))
            .accessibilityValue(Text(accuracy.formatted(.percent.precision(.fractionLength(0)))))
        }
      }
    }
    .chartXScale(domain: 0...max(days.count - 1, 1))
    .chartYScale(domain: 0...1)
    .chartYAxis(.hidden)
    .chartXAxis {
      AxisMarks(values: days.map(\.offset)) { value in
        AxisValueLabel {
          if let index = value.as(Int.self), days.indices.contains(index) {
            Text(weekday(days[index].element, .narrow))
          }
        }
      }
    }
    .frame(height: 140)
    .padding(.vertical, 8)
    .accessibilityLabel(
      Text(
        "Right answers on this skill each day of the week", tableName: "Session",
        comment: "Spoken name of the turnaround chart"))
  }

  private var day: Text {
    Text("Day", tableName: "Session", comment: "Turnaround chart axis: a day")
  }

  private var rightAnswers: Text {
    Text("Right answers", tableName: "Session", comment: "Turnaround chart axis: right answers")
  }

  private func weekday(
    _ point: WeeklyRecap.Turnaround.Point, _ width: Date.FormatStyle.Symbol.Weekday
  )
    -> String
  {
    studyDate(point.date)?.formatted(.studyDay.weekday(width)) ?? ""
  }
}

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
    .dynamicTypeSize(...DynamicTypeSize.accessibility1)
    .padding(.vertical, 4)
  }
}
