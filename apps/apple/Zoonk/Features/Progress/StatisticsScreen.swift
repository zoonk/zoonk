import SwiftUI

/// Every number covers all of the learner's goals.
struct StatisticsScreen: View {
  @State private var detail = StatsSection.level

  var body: some View {
    PaneSplit {
      StatsOverview()
        .environment(\.statsSectionOpen, StatsSectionOpen(shown: detail) { detail = $0 })
        // Each pane is about a phone wide, so the overview and the stat take their phone layouts.
        .environment(\.horizontalSizeClass, .compact)
    } secondary: {
      page(detail)
        .environment(\.horizontalSizeClass, .compact)
    } single: {
      StatsOverview()
    }
    .navigationTitle(Text(AppTab.statistics.title))
    .navigationSubtitle(
      Text(
        "All goals", tableName: "Progress",
        comment: "Under Statistics: its numbers cover every goal")
    )
    .navigationDestination(for: StatsSection.self) { section in
      pushed(section)
    }
  }

  @ViewBuilder
  private func pushed(_ section: StatsSection) -> some View {
    if section == .patterns {
      page(section)
        .navigationTitle(Text(section.title))
        .navigationSubtitle(
          Text(
            "When you answer best, over the last 90 days.", tableName: "Progress",
            comment: "Under the Patterns title on a phone: what the patterns cover"))
    } else {
      page(section)
        .navigationTitle(Text(section.title))
    }
  }

  @ViewBuilder
  private func page(_ section: StatsSection) -> some View {
    switch section {
    case .level:
      LevelStatsView()
    case .energy:
      EnergyStatsView()
    case .activity:
      ActivityStatsView()
    case .score:
      ScoreStatsView()
    case .patterns:
      PatternsStatsView()
    }
  }
}

private struct StatsOverview: View {
  @Environment(\.horizontalSizeClass) private var sizeClass
  @Environment(ProgressStore.self) private var progress

  var body: some View {
    content
      .loads(progress.activity, progress.level, progress.energy, progress.score, progress.patterns)
  }

  @ViewBuilder
  private var content: some View {
    if !isSettled {
      StatsLoading()
    } else if case .failed(let failure) = progress.activity.state {
      StatsFailure(failure: failure) {
        async let activity: Void = progress.activity.refresh()
        async let level: Void = progress.level.refresh()
        async let energy: Void = progress.energy.refresh()
        async let score: Void = progress.score.refresh()
        async let patterns: Void = progress.patterns.refresh()
        _ = await (activity, level, energy, score, patterns)
      }
    } else if let activity = progress.activity.value,
      activity.summary.learningDays > 0 || progress.level.value != nil
    {
      StatsPage {
        OverviewTiles(
          activity: activity.summary, energy: progress.energy.value, level: progress.level.value,
          score: progress.score.value?.performance)

        ActivityCalendar(days: activity.days)

        if sizeClass == .regular {
          StatsColumns(minimumWidth: 860) {
            ScoreTrend(score: progress.score.value)
              .frame(maxWidth: .infinity, alignment: .topLeading)
            PatternsOverview(patterns: progress.patterns.value)
              .frame(maxWidth: .infinity, alignment: .topLeading)
          }
        } else {
          PatternsLinkRow(patterns: progress.patterns.value)
        }
      }
    } else {
      StatsEmpty()
    }
  }

  /// Whether every read has an answer, so the overview draws once instead of tile by tile.
  private var isSettled: Bool {
    func settled<Value>(_ state: LoadState<Value>) -> Bool {
      switch state {
      case .idle, .loading: false
      case .loaded, .empty, .failed: true
      }
    }

    return settled(progress.activity.state) && settled(progress.level.state)
      && settled(progress.energy.state) && settled(progress.score.state)
      && settled(progress.patterns.state)
  }
}

private struct OverviewTiles: View {
  let activity: ActivitySummary
  let energy: EnergyProgress?
  let level: LevelProgress?
  let score: ScorePerformance?

  @ScaledMetric(relativeTo: .body) private var minimumWidth = 150.0

  var body: some View {
    StatTileGrid(columns: [4, 2, 1], minimumWidth: minimumWidth) {
      if let level {
        TileLink(section: .level) {
          StatTile(
            label: Text(StatsSection.level.title),
            value: Text(level.level, format: .number),
            icon: { BeltDot(belt: level.belt) },
            detail: Text(level.belt.localizedTitle)
          )
        }
      }

      if let energy {
        TileLink(section: .energy) {
          StatTile(
            label: Text(StatsSection.energy.title),
            value: Text(verbatim: wholePercent(energy.currentEnergy)),
            systemImage: "bolt.fill", tone: .energy,
            detail: energy.insights.map {
              Text(
                "Average \(metricPercent($0.averageEnergy))", tableName: "Progress",
                comment: "The learner's average Energy")
            }
          )
        }
      }

      TileLink(section: .activity) {
        StatTile(
          label: Text(
            "Study days", tableName: "Progress", comment: "Tile: how many days the learner studied"),
          value: Text(activity.learningDays, format: .number),
          systemImage: "chart.bar.fill", tone: .success,
          detail: Text(
            verbatim: "\(lessonCount) · \(progressLearningTime(activity.totalLearningSeconds))")
        )
      }

      TileLink(section: .score) {
        StatTile(
          label: Text(StatsSection.score.title),
          value: score.map { Text(verbatim: metricPercent($0.score)) }
            ?? Text("Not yet", tableName: "Progress", comment: "A stat without a value yet"),
          systemImage: "target", tone: .success,
          detail: score.map {
            Text(
              "\($0.correctAnswers.formatted())/\($0.totalAnswers.formatted()) right",
              tableName: "Progress",
              comment: "Under the Score: right answers of all answers (128/183 right)")
          }
            ?? Text(
              "Right answers in the last 90 days", tableName: "Progress",
              comment: "Under the Score before the learner has answers: what it will count")
        )
      }
    }
  }

  private var lessonCount: String {
    activity.totalLessonCompletions == 0
      ? String(
        localized: "0 lessons", table: "Progress",
        comment: "Under the study days: no lessons finished")
      : String(
        localized: "\(activity.totalLessonCompletions) lessons", table: "Progress",
        comment: "Under the study days: lessons finished")
  }
}

private struct TileLink<Tile: View>: View {
  let section: StatsSection
  @ViewBuilder let tile: Tile

  var body: some View {
    let shape = RoundedRectangle(cornerRadius: 12, style: .continuous)

    StatsSectionLink(section: section) {
      tile
        .contentShape(.hoverEffect, shape)
        .hoverEffect(.highlight)
        .modifier(StatsSelection(section: section, shape: shape))
    }
    .buttonStyle(.plain)
  }
}

private struct StatsSelection<Outline: InsettableShape>: ViewModifier {
  @Environment(\.statsSectionOpen) private var sectionOpen

  let section: StatsSection
  let shape: Outline

  func body(content: Content) -> some View {
    let isShown = sectionOpen?.shown == section

    content
      .overlay {
        if isShown {
          shape.strokeBorder(.tint, lineWidth: 2)
        }
      }
      .accessibilityAddTraits(isShown ? .isSelected : [])
  }
}

private struct ScoreTrend: View {
  let score: ScoreProgress?

  var body: some View {
    StatsBlock(
      title: Text(
        "Score · 90 days", tableName: "Progress",
        comment: "Title of the Score trend on the overview"),
      trailing: number
    ) {
      if let score {
        ScoreTrendChart(score: score)
      } else {
        Text(
          "Your score shows after your first answers.", tableName: "Progress",
          comment: "In place of the Score trend before the learner has answers"
        )
        .font(.subheadline)
        .foregroundStyle(.secondary)
      }
    }
  }
}

extension ScoreTrend {
  @ViewBuilder
  fileprivate var number: some View {
    if let score {
      Text(metricPercent(score.performance.score))
        .font(.subheadline.monospacedDigit())
        .foregroundStyle(.secondary)
    }
  }
}

private struct PatternsOverview: View {
  let patterns: ScorePatterns?

  var body: some View {
    StatsBlock(
      title: Text(
        "Patterns · 90 days", tableName: "Progress",
        comment: "Title of the patterns on the overview"),
      trailing: seeAll
    ) {
      VStack(spacing: 0) {
        row(
          Text(
            "Best day", tableName: "Progress",
            comment: "The day of the week the learner answers best"),
          value: patterns?.bestDayName, share: patterns?.dayVerdict.best?.performance.score)
        Divider()
        row(
          Text(
            "Best time", tableName: "Progress",
            comment: "The part of the day the learner answers best"),
          value: patterns?.bestTimeName, share: patterns?.timeVerdict.best?.performance.score)

        if let spread = patterns?.weekSpreadText {
          Divider()
          row(
            Text(
              "Spread across the week", tableName: "Progress",
              comment: "Row: the range from the week's lowest to highest day score, like 40–75%"),
            value: spread, share: nil)
        }
      }
      .padding(.horizontal)
      .background(
        Color(.secondarySystemGroupedBackground),
        in: RoundedRectangle(cornerRadius: 16, style: .continuous))

      if let patterns {
        PatternsNote(patterns: patterns)
      }
    }
  }

  private var seeAll: some View {
    StatsSectionLink(section: .patterns) {
      HStack(spacing: 4) {
        Text("See all", tableName: "Progress", comment: "Opens every pattern from the overview")
        Image(systemName: "chevron.forward")
          .imageScale(.small)
      }
      .font(.subheadline)
    }
    .buttonStyle(.borderless)
  }

  private func row(_ label: Text, value: String?, share: Double?) -> some View {
    LabeledContent {
      HStack(spacing: 12) {
        Text(
          value
            ?? String(
              localized: "Not yet", table: "Progress", comment: "A stat without a value yet")
        )
        .foregroundStyle(.primary)

        if let share {
          Text(wholePercent(share))
            .monospacedDigit()
        }
      }
    } label: {
      label
    }
    .font(.subheadline)
    .padding(.vertical, 12)
  }
}

private struct PatternsLinkRow: View {
  @Environment(\.dynamicTypeSize) private var typeSize

  let patterns: ScorePatterns?

  private var value: String {
    let names = [patterns?.bestDayName, patterns?.bestTimeName].compactMap(\.self)
    return names.isEmpty
      ? String(localized: "Not yet", table: "Progress", comment: "A stat without a value yet")
      : names.joined(separator: " · ")
  }

  var body: some View {
    StatsSectionLink(section: .patterns) {
      HStack(spacing: 12) {
        let layout =
          typeSize.isAccessibilitySize
          ? AnyLayout(VStackLayout(alignment: .leading, spacing: 4))
          : AnyLayout(HStackLayout(spacing: 12))

        layout {
          Text(StatsSection.patterns.title)
            .foregroundStyle(.primary)

          if !typeSize.isAccessibilitySize {
            Spacer(minLength: 12)
          }

          Text(value)
            .foregroundStyle(.secondary)
            .multilineTextAlignment(typeSize.isAccessibilitySize ? .leading : .trailing)
        }
        .frame(maxWidth: .infinity, alignment: .leading)

        Image(systemName: "chevron.forward")
          .font(.footnote.weight(.semibold))
          .foregroundStyle(.tertiary)
          .accessibilityHidden(true)
      }
      .padding(.horizontal)
      .padding(.vertical, 12)
      .frame(maxWidth: .infinity, minHeight: 44)
      .background(
        Color(.secondarySystemGroupedBackground),
        in: RoundedRectangle(cornerRadius: 16, style: .continuous)
      )
      .contentShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
      .modifier(
        StatsSelection(
          section: .patterns, shape: RoundedRectangle(cornerRadius: 16, style: .continuous)))
    }
    .buttonStyle(.plain)
  }
}
