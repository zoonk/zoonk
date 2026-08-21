import SwiftUI

struct EnergyProgressView: View {
  @Environment(ProgressStore.self) private var progress

  var body: some View {
    ProgressDetailLoadStateView(
      state: progress.energyState,
      emptyTitle: LocalizedStringResource(
        "No Energy yet",
        table: "Progress",
        comment: "Title shown before the learner has an Energy value"),
      emptyDescription: LocalizedStringResource(
        "Complete lessons to start building your Energy.",
        table: "Progress",
        comment: "Guidance shown before the learner has Energy progress"),
      systemImage: "bolt.fill",
      retry: { await progress.loadEnergy(force: true) }
    ) { energy in
      EnergyProgressContent(energy: energy)
    }
    .refreshesProgress {
      await progress.loadEnergy()
    }
  }
}

private struct EnergyProgressContent: View {
  let energy: EnergyProgress

  private var contributions: [ProgressContributionPoint] {
    ProgressChartData.energyContributions(from: energy.days)
  }

  private var contributionWeeks: [ProgressContributionWeek] {
    ProgressChartData.contributionWeeks(from: contributions)
  }

  var body: some View {
    ProgressDetailPage {
      ProgressDetailHero(
        title: Text(
          "Current Energy",
          tableName: "Progress",
          comment: "Label above the learner's current Energy value"),
        value: Text(
          energy.currentEnergy / 100,
          format: .percent.precision(.fractionLength(0))),
        description: energyDescription,
        systemImage: "bolt.fill",
        tint: ProgressDestination.energy.tint)

      ProgressView(value: energy.currentEnergy, total: 100)
        .tint(ProgressDestination.energy.tint)
        .accessibilityLabel(
          Text(
            "Current Energy",
            tableName: "Progress",
            comment: "Accessibility label for the current Energy progress bar")
        )
        .accessibilityValue(
          Text(energy.currentEnergy / 100, format: .percent.precision(.fractionLength(0))))

      ProgressDetailSection(
        title: Text(
          "Energy history",
          tableName: "Progress",
          comment: "Title above the Energy contribution calendar"),
        subtitle: Text(
          "Past 12 months. Days without an Energy value stay empty.",
          tableName: "Progress",
          comment: "Period and missing-value behavior for the Energy contribution calendar")
      ) {
        if contributionWeeks.isEmpty {
          ProgressDetailNoChartData()
        } else {
          ProgressContributionCalendar(
            weeks: contributionWeeks,
            maximumIntensity: ProgressChartData.energyMaximumIntensity,
            tint: ProgressDestination.energy.tint,
            lowLabel: Text(
              "Low",
              tableName: "Progress",
              comment: "Low end of the Energy contribution legend"),
            highLabel: Text(
              "High",
              tableName: "Progress",
              comment: "High end of the Energy contribution legend"),
            accessibilityLabel: Text(
              "Energy history over the past 12 months",
              tableName: "Progress",
              comment: "Accessibility label for the Energy contribution calendar"),
            accessibilityValue: energyAccessibilityValue)
        }
      }

      if let insights = energy.insights {
        ProgressDetailMetricGrid {
          ProgressDetailMetric(
            label: Text(
              "Average Energy",
              tableName: "Progress",
              comment: "Label for the learner's average recorded Energy"),
            value: Text(
              insights.averageEnergy / 100,
              format: .percent.precision(.fractionLength(0))),
            systemImage: "chart.line.uptrend.xyaxis",
            tint: ProgressDestination.energy.tint)

          ProgressDetailMetric(
            label: Text(
              "Days at 100% Energy",
              tableName: "Progress",
              comment: "Label for the number of days the learner reached full Energy"),
            value: Text(insights.fullEnergyDays, format: .number),
            systemImage: "bolt.circle",
            tint: ProgressDestination.energy.tint)
        }
      }

      VStack(alignment: .leading, spacing: 20) {
        ProgressDetailExplanation(
          title: Text(
            "How do I increase my Energy?",
            tableName: "Progress",
            comment: "Title explaining how to increase Energy"),
          description: Text(
            "Complete lessons and answer questions correctly to increase your Energy.",
            tableName: "Progress",
            comment: "Explanation of how learning increases Energy"),
          systemImage: "arrow.up.circle",
          tint: ProgressDestination.energy.tint)

        VStack(alignment: .leading, spacing: 6) {
          Text(
            "Missed a day?",
            tableName: "Progress",
            comment: "Title explaining what happens to Energy after a missed day"
          )
          .font(.headline)

          Text(
            "Your Energy drops a little. Complete lessons to fill it back up.",
            tableName: "Progress",
            comment: "Explanation of how to recover Energy after missing a day"
          )
          .foregroundStyle(.secondary)
        }
      }
    }
  }

  private var energyDescription: Text {
    if energy.currentEnergy >= 100 {
      return Text(
        "You're fully energized.",
        tableName: "Progress",
        comment: "Encouragement shown when the learner reaches full Energy.")
    }

    return Text(
      "Keep learning to reach 100%.",
      tableName: "Progress",
      comment: "Encouragement shown while the learner builds Energy.")
  }

  private func energyAccessibilityValue(_ point: ProgressContributionPoint) -> Text {
    guard let energy = point.value else {
      return Text(
        "No Energy recorded",
        tableName: "Progress",
        comment: "Accessible value for a day without recorded Energy")
    }

    return Text(
      "Energy: \(energy / 100, format: .percent.precision(.fractionLength(0)))",
      tableName: "Progress",
      comment: "Accessible daily value in the Energy contribution calendar")
  }
}
