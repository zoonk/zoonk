import SwiftUI

/// A team challenge: the case's intro, then one decision at a time with the team's messages and
/// replies and the meters it moves, then how it went. The team's names fill `{{slotId}}`. The
/// learner's turn is the decision's choices, then the debrief.
struct ChallengeStepView: View {
  let step: LessonStep
  let content: ChallengeContent
  let state: LessonPlayerState
  let store: LessonPlayerStore
  let part: LessonStepPart

  var body: some View {
    let progress = ChallengeProgress(
      content: content, picks: state.challengePicks(step.id), shown: state.revealed[step.id] ?? 0)

    switch (progress, part) {
    case (.intro, .screen):
      intro
    case (.intro, .turn):
      EmptyView()
    case (.deciding(let node, _, let decisions, _), .screen):
      meters(decisions)
      conversation(decisions)
      ForEach(Array(node.messages.enumerated()), id: \.offset) { _, message in
        bubble(message)
      }
      LessonQuestionText(text: named(node.prompt))
    case (.deciding(let node, let confirmed, _, let pending), .turn):
      LessonOptionList(
        options: node.choices.map { LessonOption(id: $0.id, text: named($0.text)) },
        selectedId: pending,
        isChecked: false,
        isLocked: state.phase != .playing
      ) { choiceId in
        store.select(.challenge(choiceIds: confirmed + [choiceId]))
      }
    case (.ended(_, _, let decisions), .screen):
      meters(decisions)
      conversation(decisions)
    case (.ended(let ending, _, let decisions), .turn):
      if let result = state.currentResult {
        debrief(ending: ending, decisions: decisions, isCorrect: result.isCorrect)
      }
    }
  }

  private var intro: some View {
    VStack(alignment: .leading, spacing: 16) {
      Label {
        content.variant == .whatIf
          ? Text(
            "What if · \(named(content.setting))", tableName: "Player",
            comment: "Above a what-if scenario's title")
          : Text(
            "Challenge · \(named(content.setting))", tableName: "Player",
            comment: "Above a challenge's title")
      } icon: {
        Image(systemName: "target")
      }
      .font(.subheadline.weight(.medium))
      .foregroundStyle(.secondary)

      LessonQuestionText(text: named(content.title))

      VStack(alignment: .leading, spacing: 4) {
        Text("Your mission", tableName: "Player", comment: "Above a challenge's mission")
          .font(.caption.weight(.medium))
          .foregroundStyle(.secondary)
        LessonRichText(named(content.mission))
          .font(.title3)
      }

      if let deadline = content.deadline {
        Label(named(deadline), systemImage: "clock")
          .foregroundStyle(.secondary)
      }

      Text("Your team", tableName: "Player", comment: "Above the people in a challenge")
        .font(.caption.weight(.medium))
        .foregroundStyle(.secondary)

      ForEach(Array(content.team.enumerated()), id: \.offset) { _, slot in
        Label {
          VStack(alignment: .leading) {
            Text(name(for: slot.id))
              .font(.subheadline.weight(.medium))
            Text(slot.expertise)
              .font(.footnote)
              .foregroundStyle(.secondary)
          }
        } icon: {
          Image(systemName: slot.ai ? "sparkles" : "person.crop.circle")
        }
      }

      Group {
        if content.team.contains(where: \.ai) {
          Text(
            "You can ask the team or the AI for help. Your decisions change the outcome.",
            tableName: "Player",
            comment: "Under a challenge's team with an AI assistant")
        } else {
          Text(
            "You can ask the team for help. Your decisions change the outcome.",
            tableName: "Player",
            comment: "Under a challenge's team")
        }
      }
      .font(.subheadline)
      .foregroundStyle(.secondary)
    }
  }

  private func meters(_ decisions: [ChallengeWalk.Decision]) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      ForEach(ChallengeWalk.meters(content, decisions: decisions), id: \.meter.id) { meter in
        Gauge(value: Double(meter.value), in: 0...100) {
          HStack {
            Text(named(meter.meter.label))
            Spacer()
            if meter.change != 0 {
              Text(meter.change, format: .number.sign(strategy: .always()))
                .foregroundStyle(
                  isGood(meter.meter, change: meter.change) ? .success : .destructive)
            }
          }
          .font(.footnote)
        }
        .gaugeStyle(.linearCapacity)
        .tint(.success)
      }
    }
  }

  private func isGood(_ meter: ChallengeContent.Meter, change: Int) -> Bool {
    meter.goodWhen == .high ? change > 0 : change < 0
  }

  @ViewBuilder
  private func conversation(_ decisions: [ChallengeWalk.Decision]) -> some View {
    ForEach(Array(decisions.enumerated()), id: \.offset) { _, decision in
      ForEach(Array(decision.node.messages.enumerated()), id: \.offset) { _, message in
        bubble(message)
      }
      Text(named(decision.choice.text))
        .font(.subheadline.weight(.medium))
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .trailing)
        .background(Color.accentColor.opacity(0.15), in: .rect(cornerRadius: 16))
      ForEach(Array(decision.choice.replies.enumerated()), id: \.offset) { _, reply in
        bubble(reply)
      }
      if let jump = decision.choice.timeJump {
        Label(named(jump.label), systemImage: "clock.arrow.circlepath")
          .font(.footnote)
          .foregroundStyle(.secondary)
      }
    }
  }

  private func bubble(_ message: ChallengeContent.Message) -> some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(name(for: message.from))
        .font(.caption.weight(.medium))
        .foregroundStyle(.secondary)
      LessonRichText(named(message.text))
        .font(.subheadline)
    }
    .padding(12)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 16))
    .accessibilityElement(children: .combine)
  }

  private func debrief(
    ending: ChallengeContent.Ending, decisions: [ChallengeWalk.Decision], isCorrect: Bool
  )
    -> some View
  {
    let notes = decisions.flatMap(\.choice.notes)
    let good = notes.filter { $0.kind == .good }
    let improve = notes.filter { $0.kind == .improve }

    return VStack(alignment: .leading, spacing: 16) {
      Group {
        content.variant == .whatIf
          ? Text(
            "Scenario complete", tableName: "Player", comment: "Title after a what-if scenario ends"
          )
          : Text("Challenge complete", tableName: "Player", comment: "Title after a challenge ends")
      }
      .font(.title2.weight(.semibold))
      .accessibilityAddTraits(.isHeader)

      LessonRichText(named(ending.outcome))
        .foregroundStyle(.secondary)

      if !good.isEmpty {
        notesSection(
          Text("Nicely done", tableName: "Player", comment: "Above what went well in a challenge"),
          notes: good,
          tint: .success)
      }

      if !improve.isEmpty {
        notesSection(
          Text(
            "To improve", tableName: "Player", comment: "Above what to improve after a challenge"),
          notes: improve, tint: .warning)
      }

      if !content.skills.isEmpty {
        Text(
          "Skills practiced", tableName: "Player", comment: "Above the skills a challenge trains"
        )
        .font(.caption.weight(.medium))
        .foregroundStyle(.secondary)
        FlowLayout(spacing: 8) {
          ForEach(content.skills) { skill in
            Text(skill.name)
              .font(.footnote)
              .padding(.horizontal, 10)
              .padding(.vertical, 4)
              .background(Color(.secondarySystemBackground), in: .capsule)
          }
        }
      }
    }
  }

  private func notesSection(_ title: Text, notes: [ChallengeContent.Choice.Note], tint: Color)
    -> some View
  {
    VStack(alignment: .leading, spacing: 8) {
      title
        .font(.headline)
        .foregroundStyle(tint)
      ForEach(Array(notes.enumerated()), id: \.offset) { _, note in
        VStack(alignment: .leading, spacing: 2) {
          LessonRichText(named(note.text))
          if let example = note.example {
            LessonRichText(named(example))
              .font(.subheadline)
              .foregroundStyle(.secondary)
          }
        }
      }
    }
    .padding()
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(tint.opacity(0.15), in: .rect(cornerRadius: 20))
  }

  /// A team slot's name: the learner's team member for that slot, or the slot's role.
  private func name(for slotId: String) -> String {
    let people = content.team.filter { !$0.ai }

    if let index = people.firstIndex(where: { $0.id == slotId }), index < store.challengeTeam.count
    {
      return store.challengeTeam[index]
    }

    return content.team.first { $0.id == slotId }?.role ?? slotId
  }

  private func named(_ text: String) -> String {
    text.replacing(/\{\{([\w-]+)\}\}/) { name(for: String($0.output.1)) }
  }
}
