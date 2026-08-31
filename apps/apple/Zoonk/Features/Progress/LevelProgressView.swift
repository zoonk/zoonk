import SwiftUI

struct LevelProgressView: View {
  @Environment(ProgressStore.self) private var progress

  var body: some View {
    ProgressDetailLoadStateView(
      state: progress.levelState,
      emptyTitle: LocalizedStringResource(
        "No level yet",
        table: "Progress",
        comment: "Title shown before the learner earns Brain Power"),
      emptyDescription: LocalizedStringResource(
        "Complete a lesson to earn Brain Power and reach your first level.",
        table: "Progress",
        comment: "Guidance shown before the learner has a level"),
      systemImage: "brain.head.profile",
      retry: { await progress.loadLevel(force: true) }
    ) { level in
      LevelProgressContent(level: level)
    }
    .refreshesProgress {
      await progress.loadLevel()
    }
  }
}

private struct LevelProgressContent: View {
  let level: LevelProgress

  private var milestoneDescription: Text {
    if level.isMaxLevel {
      return Text(
        "Maximum level reached.",
        tableName: "Progress",
        comment: "Description shown after reaching the maximum level")
    }

    return Text(
      "\(level.bpToNextLevel) BP to the next level",
      tableName: "Progress",
      comment: "Brain Power remaining before the learner reaches the next level")
  }

  var body: some View {
    ProgressDetailPage {
      ProgressDetailHero(
        title: Text(level.belt.localizedTitle),
        value: Text(
          "Level \(level.level)",
          tableName: "Progress",
          comment: "Learner's current numbered level"),
        description: milestoneDescription,
        systemImage: "brain.head.profile",
        tint: level.belt.accentColor)

      ProgressDetailSection(
        title: Text(
          "Level progress",
          tableName: "Progress",
          comment: "Title above progress toward the next level")
      ) {
        VStack(alignment: .leading, spacing: 10) {
          HStack(alignment: .firstTextBaseline) {
            if level.isMaxLevel {
              Text(
                "Max level reached",
                tableName: "Progress",
                comment: "Status shown after reaching the maximum level")
            } else {
              Text(
                "\(level.progressInLevel) of \(level.bpPerLevel) BP",
                tableName: "Progress",
                comment: "Brain Power earned within the current level")
            }

            Spacer()

            if level.isMaxLevel {
              Text(
                "Complete",
                tableName: "Progress",
                comment: "Completion value for the maximum level"
              )
              .foregroundStyle(.secondary)
            } else {
              Text(
                "\(level.bpToNextLevel) BP left",
                tableName: "Progress",
                comment: "Short Brain Power amount remaining before the next level"
              )
              .foregroundStyle(.secondary)
            }
          }
          .font(.subheadline)

          ProgressView(value: level.progressValue, total: level.progressTotal)
            .tint(level.belt.progressColor)
            .accessibilityLabel(
              level.isMaxLevel
                ? Text(
                  "Level progress",
                  tableName: "Progress",
                  comment: "Accessibility label for progress within the maximum level")
                : Text(
                  "Progress to the next level",
                  tableName: "Progress",
                  comment: "Accessibility label for progress toward the learner's next level")
            )
            .accessibilityValue(milestoneDescription)
        }
      }

      ProgressDetailMetricGrid {
        ProgressDetailMetric(
          label: Text(
            "Total Brain Power",
            tableName: "Progress",
            comment: "Label for the learner's lifetime Brain Power"),
          value: Text(
            "\(level.totalBrainPower) BP",
            tableName: "Progress",
            comment: "Learner's lifetime Brain Power value"),
          systemImage: "brain",
          tint: level.belt.accentColor)

        ProgressDetailMetric(
          label: Text(
            "Brain Power per level",
            tableName: "Progress",
            comment: "Label for the Brain Power required to advance one level"),
          value: Text(
            "\(level.bpPerLevel) BP",
            tableName: "Progress",
            comment: "Brain Power required to advance one level"),
          systemImage: "arrow.up.forward",
          tint: level.belt.accentColor)
      }

      ProgressDetailSection(
        title: Text(
          "Belt journey",
          tableName: "Progress",
          comment: "Title above the sequence of learning belts"),
        subtitle: Text(
          "Every ten levels unlocks the next belt.",
          tableName: "Progress",
          comment: "Explains when the learner advances to a new belt")
      ) {
        LazyVGrid(
          columns: [GridItem(.adaptive(minimum: 88, maximum: 120), spacing: 10)],
          spacing: 14
        ) {
          ForEach(ProgressBelt.allCases, id: \.self) { belt in
            BeltMilestone(belt: belt, isCurrent: belt == level.belt)
          }
        }
      }

      ProgressDetailExplanation(
        title: Text(
          "How levels work",
          tableName: "Progress",
          comment: "Title explaining how learners progress through levels"),
        description: Text(
          "Every completed lesson earns 10 BP. Brain Power never goes down, so each lesson moves you closer to the next level.",
          tableName: "Progress",
          comment: "Explains how much Brain Power a lesson earns and that it never decreases."),
        systemImage: "brain.head.profile",
        tint: level.belt.accentColor)
    }
  }
}

private struct BeltMilestone: View {
  let belt: ProgressBelt
  let isCurrent: Bool

  var body: some View {
    VStack(spacing: 8) {
      BeltBadge(belt: belt, isCurrent: isCurrent, size: 34)

      Text(belt.localizedTitle)
        .font(.caption)
        .fontWeight(isCurrent ? .semibold : .regular)
        .multilineTextAlignment(.center)
    }
    .frame(maxWidth: .infinity)
    .padding(.vertical, 8)
    .background(
      isCurrent ? belt.progressColor.opacity(0.09) : .clear,
      in: RoundedRectangle(cornerRadius: 12, style: .continuous)
    )
    .accessibilityElement(children: .combine)
    .accessibilityValue(
      isCurrent
        ? Text(
          "Current belt",
          tableName: "Progress",
          comment: "Accessibility value identifying the learner's current belt")
        : Text(
          "Belt milestone",
          tableName: "Progress",
          comment: "Accessibility value identifying another belt milestone"))
  }
}

private struct BeltBadge: View {
  let belt: ProgressBelt
  let isCurrent: Bool
  let size: CGFloat

  var body: some View {
    Circle()
      .fill(belt.color)
      .overlay {
        Circle()
          .stroke(.secondary.opacity(0.35), lineWidth: 1)
      }
      .overlay {
        if isCurrent {
          Image(systemName: "checkmark")
            .font(.system(size: size * 0.36, weight: .bold))
            .foregroundStyle(checkmarkColor)
        }
      }
      .frame(width: size, height: size)
      .accessibilityHidden(true)
  }

  private var checkmarkColor: Color {
    switch belt {
    case .white, .yellow, .orange:
      .black
    case .green, .blue, .purple, .brown, .red, .gray, .black:
      .white
    }
  }
}
