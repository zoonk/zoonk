import SwiftUI

/// The team's names fill `{{slotId}}`.
struct ChallengeStepView: View {
  let step: LessonStep
  let content: ChallengeContent
  let state: LessonPlayerState
  let store: LessonPlayerStore
  let part: LessonStepPart

  @ScaledMetric(relativeTo: .subheadline) private var avatarSize = 36.0

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
        self.message(message)
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
    case (.ended(let ending, _, let decisions), .screen):
      meters(decisions)
      conversation(decisions)
      // Once checked, the debrief opens with the outcome.
      if state.currentResult == nil {
        outcome(ending)
      }
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
            "What if\u{00A0}· \(named(content.setting))", tableName: "Player",
            comment: "Above a what-if scenario's title")
          : Text(
            "Challenge\u{00A0}· \(named(content.setting))", tableName: "Player",
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
        let name = name(for: slot.id)

        AccessibilityStack(spacing: 10, stackedSpacing: 8) {
          avatar(name, slot: slot)

          VStack(alignment: .leading) {
            Text(name)
              .font(.subheadline.weight(.semibold))

            if !slot.ai {
              Text(named(slot.role))
                .font(.footnote)
                .foregroundStyle(.secondary)
            }
          }
        }
        .accessibilityElement(children: .combine)
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

  @ViewBuilder
  private func meters(_ decisions: [ChallengeWalk.Decision]) -> some View {
    if !content.meters.isEmpty {
      GroupBox {
        VStack(alignment: .leading, spacing: 12) {
          ForEach(ChallengeWalk.meters(content, decisions: decisions), id: \.meter.id) { meter in
            Gauge(value: Double(meter.value), in: 0...100) {
              AccessibilityStack(alignment: .firstTextBaseline, spacing: 12, stackedSpacing: 2) {
                Text(named(meter.meter.label))
                  .frame(maxWidth: .infinity, alignment: .leading)

                if !decisions.isEmpty {
                  move(meter.change, of: meter.meter)
                }
              }
              .font(.subheadline)
            }
            .gaugeStyle(.linearCapacity)
            .tint(.secondary)
          }
        }
      }
    }
  }

  /// A move of 25 or more is "much".
  @ViewBuilder
  private func move(_ change: Int, of meter: ChallengeContent.Meter) -> some View {
    if change == 0 {
      Text(
        "no change", tableName: "Player",
        comment: "Beside a challenge meter the last decision didn't move"
      )
      .foregroundStyle(.secondary)
    } else {
      let isUp = change > 0
      let isBig = abs(change) >= 25

      Label {
        switch (isUp, isBig) {
        case (true, true):
          Text("much higher", tableName: "Player", comment: "A challenge meter went up a lot")
        case (true, false):
          Text("a bit higher", tableName: "Player", comment: "A challenge meter went up a little")
        case (false, true):
          Text("much lower", tableName: "Player", comment: "A challenge meter went down a lot")
        case (false, false):
          Text(
            "a bit lower", tableName: "Player", comment: "A challenge meter went down a little")
        }
      } icon: {
        Image(
          systemName: isBig
            ? (isUp ? "chevron.up.2" : "chevron.down.2") : (isUp ? "arrow.up" : "arrow.down"))
      }
      .fontWeight(.medium)
      .foregroundStyle(isUp == (meter.goodWhen == .high) ? Color.success : .warning)
    }
  }

  @ViewBuilder
  private func conversation(_ decisions: [ChallengeWalk.Decision]) -> some View {
    ForEach(Array(decisions.enumerated()), id: \.offset) { _, decision in
      ForEach(Array(decision.node.messages.enumerated()), id: \.offset) { _, message in
        self.message(message)
      }
      VStack(alignment: .trailing, spacing: 8) {
        pick(decision.choice.text)
        effects(decision.choice)
      }
      ForEach(Array(decision.choice.replies.enumerated()), id: \.offset) { _, reply in
        message(reply)
      }
      if let jump = decision.choice.timeJump {
        Label(named(jump.label), systemImage: "clock.arrow.circlepath")
          .font(.footnote)
          .foregroundStyle(.secondary)
      }
    }
  }

  private func message(_ message: ChallengeContent.Message) -> some View {
    let slot = content.team.first { $0.id == message.from }
    let name = name(for: message.from)

    return AccessibilityStack(alignment: .top, spacing: 12, stackedSpacing: 8) {
      avatar(name, slot: slot)

      VStack(alignment: .leading, spacing: 2) {
        speaker(name, role: slot.flatMap { $0.ai ? nil : named($0.role) })
        LessonRichText(named(message.text))
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
    .accessibilityElement(children: .combine)
  }

  private func avatar(_ name: String, slot: ChallengeContent.TeamSlot?) -> some View {
    let isAI = slot?.ai == true

    return Group {
      if isAI {
        Image(systemName: "sparkles")
      } else {
        Text(name.prefix(1).uppercased())
      }
    }
    .font(.subheadline.weight(.semibold))
    .foregroundStyle(isAI ? Color(.systemBackground) : .primary)
    .frame(width: avatarSize, height: avatarSize)
    .background(isAI ? Color.primary : Color(.tertiarySystemFill), in: .circle)
    .accessibilityHidden(true)
  }

  /// "Name · role", the role quieter.
  private func speaker(_ name: String, role: String?) -> Text {
    var line = AttributedString(name)
    line.font = .subheadline.weight(.semibold)

    if let role {
      var rest = AttributedString("\u{00A0}· \(role)")
      rest.foregroundColor = .secondary
      line += rest
    }

    return Text(line)
      .font(.subheadline)
  }

  private func pick(_ text: String) -> some View {
    let pick = LessonRichText.typeset(named(text))

    return Text(pick)
      .foregroundStyle(Color(.systemBackground))
      .padding(.horizontal, 16)
      .padding(.vertical, 10)
      .background(.primary, in: .rect(cornerRadius: 16, style: .continuous))
      .padding(.leading, 40)
      .frame(maxWidth: .infinity, alignment: .trailing)
      .accessibilityLabel(
        Text(
          "You: \(pick.quoted(spoken: true))", tableName: "Player",
          comment: "VoiceOver: the learner's pick in a challenge's conversation"))
  }

  /// The meters a pick moved. VoiceOver skips them, as on main, and hears the last move from the
  /// meters.
  @ViewBuilder
  private func effects(_ choice: ChallengeContent.Choice) -> some View {
    let moved = choice.effects.compactMap { effect in
      content.meters.first { $0.id == effect.meter && effect.change != 0 }
        .map { (meter: $0, change: effect.change) }
    }

    if !moved.isEmpty {
      FlowLayout(spacing: 16, rowAlignment: .trailing, rowSpacing: 4) {
        ForEach(Array(moved.enumerated()), id: \.offset) { _, effect in
          HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(named(effect.meter.label))
              .foregroundStyle(.secondary)
            move(effect.change, of: effect.meter)
          }
        }
      }
      .font(.caption)
      .accessibilityHidden(true)
    }
  }

  private func outcome(_ ending: ChallengeContent.Ending) -> some View {
    GroupBox {
      VStack(alignment: .leading, spacing: 8) {
        Text(
          "What happened", tableName: "Player",
          comment: "Above how a challenge's path ended, before the learner checks it"
        )
        .font(.caption.weight(.medium))
        .textCase(.uppercase)
        .foregroundStyle(.secondary)
        .accessibilityAddTraits(.isHeader)
        LessonRichText(named(ending.outcome))
      }
      .frame(maxWidth: .infinity, alignment: .leading)
    }
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
