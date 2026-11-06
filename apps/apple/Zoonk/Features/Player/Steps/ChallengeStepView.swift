import SwiftUI

/// The team's names fill `{{slotId}}`.
struct ChallengeStepView: View {
  let step: LessonStep
  let content: ChallengeContent
  let state: LessonPlayerState
  let store: LessonPlayerStore
  let part: LessonStepPart

  @Environment(\.legibilityWeight) private var legibilityWeight
  @Environment(\.stacksContent) private var stacksContent

  @ScaledMetric(relativeTo: .subheadline) private var avatarSize = 36.0

  var body: some View {
    let progress = ChallengeProgress(
      content: content, picks: state.challengePicks(step.id), shown: state.revealed[step.id] ?? 0)

    switch (progress, part) {
    case (.intro, .screen):
      intro
    case (.intro, .turn):
      EmptyView()
    case (.deciding(_, _, let decisions, _), .screen), (.ended(_, _, let decisions), .screen):
      played(decisions, upcoming: upcoming(progress))
    case (.deciding(let node, let confirmed, _, let pending), .turn):
      LessonQuestionText(text: named(node.prompt))
      LessonOptionList(
        options: node.choices.map { LessonOption(id: $0.id, text: named($0.text)) },
        selectedId: pending,
        isChecked: false,
        isLocked: state.phase != .playing
      ) { choiceId in
        store.select(.challenge(choiceIds: confirmed + [choiceId]))
      }
    case (.ended(let ending, _, let decisions), .turn):
      if let result = state.currentResult {
        debrief(ending: ending, decisions: decisions, isCorrect: result.isCorrect)
      } else {
        outcome(ending)
      }
    }
  }

  private var intro: some View {
    VStack(alignment: .leading, spacing: 16) {
      LessonEyebrow(
        title: content.variant == .whatIf
          ? Text(
            "What if\u{00A0}· \(named(content.setting))", tableName: "Player",
            comment: "Above a what-if scenario's title")
          : Text(
            "Challenge\u{00A0}· \(named(content.setting))", tableName: "Player",
            comment: "Above a challenge's title"),
        systemImage: "target")

      LessonQuestionText(text: named(content.title))

      VStack(alignment: .leading, spacing: 8) {
        panelLabel(
          Text("Your mission", tableName: "Player", comment: "Above a challenge's mission")
        )
        .accessibilityAddTraits(.isHeader)
        LessonRichText(named(content.mission))
          .typeStyle(.section.weight(.regular))

        if let deadline = content.deadline {
          Label(named(deadline), systemImage: "clock")
            .foregroundStyle(.mutedForeground)
        }
      }
      .padding(16)
      .frame(maxWidth: .infinity, alignment: .leading)
      .panel()

      ForEach(Array(content.panels.enumerated()), id: \.offset) { _, panel in
        self.panel(panel)
      }

      Text("Your team", tableName: "Player", comment: "Above the people in a challenge")
        .typeStyle(.meta.weight(.medium))
        .foregroundStyle(.mutedForeground)

      ForEach(Array(content.team.enumerated()), id: \.offset) { _, slot in
        let name = name(for: slot.id)

        AccessibilityStack(spacing: 10, stackedSpacing: 8) {
          avatar(name, slot: slot)

          VStack(alignment: .leading) {
            Text(name)
              .typeStyle(.body.weight(.semibold))

            if !slot.ai {
              Text(named(slot.role))
                .typeStyle(.note)
                .foregroundStyle(.mutedForeground)
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
      .typeStyle(.note)
      .foregroundStyle(.mutedForeground)
    }
  }

  /// One view while deciding and once ended, so what the last decision brings is read out too.
  private func played(_ decisions: [ChallengeWalk.Decision], upcoming: ChallengeContent.Node?)
    -> some View
  {
    VStack(alignment: .leading, spacing: 20) {
      meters(decisions)
      conversation(decisions)

      if let upcoming {
        ForEach(Array(upcoming.messages.enumerated()), id: \.offset) { _, message in
          self.message(message)
        }
      }
    }
    .onChange(of: decisions.count) { previous, count in
      if count > previous, let line = newest(decisions, upcoming: upcoming) {
        announcePolitely(line)
      }
    }
  }

  private func upcoming(_ progress: ChallengeProgress) -> ChallengeContent.Node? {
    guard case .deciding(let node, _, _, _) = progress else {
      return nil
    }

    return node
  }

  /// Main's meters and conversation log read what a decision brings, in the order it shows: once
  /// per decision, even one that brings the same as the last.
  private func newest(_ decisions: [ChallengeWalk.Decision], upcoming: ChallengeContent.Node?)
    -> String?
  {
    guard let latest = decisions.last else {
      return nil
    }

    let moved = ChallengeWalk.meters(content, decisions: decisions).filter { $0.change != 0 }.map {
      "\(named($0.meter.label)) \(Self.moveWords($0.change))"
    }
    let jump =
      latest.choice.timeJump.map {
        [([named($0.label)] + ($0.panel.map(panelLines) ?? [])).joined(separator: "\n")]
      } ?? []
    let lines = latest.choice.replies.map(said) + jump + (upcoming?.messages ?? []).map(said)

    let parts = [
      moved.isEmpty ? nil : moved.formatted(.list(type: .and)),
      lines.isEmpty ? nil : lines.joinedSentences(),
    ].compactMap(\.self)

    return parts.isEmpty ? nil : parts.joined(separator: "\n")
  }

  /// In the order main and Android read a panel, with the team's names filled in everywhere but a
  /// metric's value, as they do.
  private func panelLines(_ panel: ChallengeContent.Panel) -> [String] {
    [panel.title.map(named)].compactMap(\.self)
      + panel.metrics.flatMap {
        [named($0.label), $0.value] + [$0.note.map(named)].compactMap(\.self)
      }
      + [panel.note.map(named)].compactMap(\.self)
  }

  private func said(_ message: ChallengeContent.Message) -> String {
    String(
      localized:
        "\(name(for: message.from)): \(LessonRichText.typeset(named(message.text)).said)",
      table: "Player", comment: "VoiceOver: who said a message in a challenge, then what they said")
  }

  @ViewBuilder
  private func meters(_ decisions: [ChallengeWalk.Decision]) -> some View {
    if !content.meters.isEmpty {
      VStack(alignment: .leading, spacing: 12) {
        ForEach(ChallengeWalk.meters(content, decisions: decisions), id: \.meter.id) { meter in
          VStack(alignment: .leading, spacing: 6) {
            AccessibilityStack(alignment: .firstTextBaseline, spacing: 12, stackedSpacing: 2) {
              Text(named(meter.meter.label))
                .frame(maxWidth: .infinity, alignment: .leading)

              if !decisions.isEmpty {
                move(meter.change, of: meter.meter)
              }
            }
            .typeStyle(.body)

            Meter(value: Double(meter.value), total: 100, fill: .mutedForeground)
          }
          .accessibilityElement(children: .combine)
        }
      }
      .padding(16)
      .well()
    }
  }

  @ViewBuilder
  private func move(_ change: Int, of meter: ChallengeContent.Meter) -> some View {
    if change == 0 {
      Text(Self.moveWords(change))
        .foregroundStyle(.mutedForeground)
    } else {
      let isUp = change > 0
      let isBig = abs(change) >= 25

      Label {
        Text(Self.moveWords(change))
      } icon: {
        Image(
          systemName: isBig
            ? (isUp ? "chevron.up.2" : "chevron.down.2") : (isUp ? "arrow.up" : "arrow.down"))
      }
      .typeWeight(.medium)
      .foregroundStyle(isUp == (meter.goodWhen == .high) ? Color.successText : .warningText)
    }
  }

  private static func moveWords(_ change: Int) -> String {
    switch (change > 0, abs(change) >= 25) {
    case _ where change == 0:
      String(
        localized: "no change", table: "Player",
        comment: "Beside a challenge meter the last decision didn't move")
    case (true, true):
      String(localized: "much higher", table: "Player", comment: "A challenge meter went up a lot")
    case (true, false):
      String(
        localized: "a bit higher", table: "Player", comment: "A challenge meter went up a little")
    case (false, true):
      String(
        localized: "much lower", table: "Player", comment: "A challenge meter went down a lot")
    case (false, false):
      String(
        localized: "a bit lower", table: "Player", comment: "A challenge meter went down a little")
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
        timeJump(jump)
      }
    }
  }

  private func timeJump(_ jump: ChallengeContent.Choice.TimeJump) -> some View {
    VStack(spacing: 12) {
      HStack(spacing: 12) {
        VStack { Divider() }
        Label(named(jump.label), systemImage: "calendar.badge.clock")
          .foregroundStyle(.mutedForeground)
          .multilineTextAlignment(.center)
          .layoutPriority(1)
        VStack { Divider() }
      }

      if let panel = jump.panel {
        self.panel(panel)
      }
    }
  }

  private func panel(_ panel: ChallengeContent.Panel) -> some View {
    let columns = stacksContent || panel.metrics.count < 2 ? 1 : 2

    return VStack(alignment: .leading, spacing: 12) {
      if let title = panel.title {
        panelLabel(Text(named(title)))
      }

      LazyVGrid(
        columns: Array(
          repeating: GridItem(.flexible(), spacing: 16, alignment: .topLeading), count: columns),
        alignment: .leading, spacing: 16
      ) {
        ForEach(Array(panel.metrics.enumerated()), id: \.offset) { _, metric in
          VStack(alignment: .leading, spacing: 2) {
            Text(named(metric.label))
              .typeStyle(.meta)
              .foregroundStyle(.mutedForeground)
            Text(metric.value)
              .typeStyle(.readout)
            if let note = metric.note {
              Text(named(note))
                .typeStyle(.meta)
                .foregroundStyle(.mutedForeground)
            }
          }
          .accessibilityElement(children: .combine)
        }
      }

      if let note = panel.note {
        LessonRichText(named(note))
          .typeStyle(.meta)
          .foregroundStyle(.mutedForeground)
      }
    }
    .padding(16)
    .frame(maxWidth: .infinity, alignment: .leading)
    .panel()
  }

  private func panelLabel(_ text: Text) -> some View {
    text
      .typeStyle(.label)
      .foregroundStyle(.faint)
  }

  private func message(_ message: ChallengeContent.Message) -> some View {
    let slot = content.team.first { $0.id == message.from }
    let name = name(for: message.from)

    return AccessibilityStack(alignment: .top, spacing: 12, stackedSpacing: 8) {
      avatar(name, slot: slot)

      VStack(alignment: .leading, spacing: 2) {
        speaker(name, role: slot.flatMap { $0.ai ? nil : named($0.role) })
          .typeStyle(.body)
        LessonRichText(named(message.text))
          .typeStyle(.reading)
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
    .typeStyle(.body.weight(.semibold))
    .foregroundStyle(isAI ? Color(.primaryForeground) : Color(.foreground))
    .frame(width: avatarSize, height: avatarSize)
    .background(isAI ? Color(.primary) : Color.muted, in: .circle)
    .accessibilityHidden(true)
  }

  private func speaker(_ name: String, role: String?) -> Text {
    let name = Text(name).typeWeight(.semibold, legibility: legibilityWeight)

    if let role {
      return Text("\(name)\(Text(verbatim: "\u{00A0}· \(role)").foregroundStyle(.mutedForeground))")
    }

    return name
  }

  private func pick(_ text: String) -> some View {
    let pick = LessonRichText.typeset(named(text))

    return ShareRow(share: 0.85, edge: .trailing) {
      Text(pick, legibility: legibilityWeight)
        .typeStyle(.reading)
        .foregroundStyle(Color(.primaryForeground))
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color(.primary), in: .rect(cornerRadius: Radius.xl, style: .continuous))
        .frame(maxWidth: .infinity, alignment: .trailing)
        .accessibilityLabel(
          Text(
            "You: \(pick.quoted(spoken: true, legibility: legibilityWeight))", tableName: "Player",
            comment: "VoiceOver: the learner's pick in a challenge's conversation"))
    }
  }

  /// VoiceOver skips these, as on main: the meters above say the last move.
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
              .foregroundStyle(.mutedForeground)
            move(effect.change, of: effect.meter)
          }
        }
      }
      .typeStyle(.meta)
      .accessibilityHidden(true)
    }
  }

  private func outcome(_ ending: ChallengeContent.Ending) -> some View {
    VStack(alignment: .leading, spacing: 8) {
      panelLabel(
        Text(
          "What happened", tableName: "Player",
          comment: "Above how a challenge's path ended, before the learner checks it")
      )
      .accessibilityAddTraits(.isHeader)
      LessonRichText(named(ending.outcome))
    }
    .padding(16)
    .frame(maxWidth: .infinity, alignment: .leading)
    .well()
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
      .typeStyle(.pageTitle)
      .accessibilityAddTraits(.isHeader)

      LessonRichText(named(ending.outcome))
        .foregroundStyle(.mutedForeground)

      if !good.isEmpty || !improve.isEmpty {
        VStack(alignment: .leading, spacing: 16) {
          if !good.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
              Text(
                "Nicely done", tableName: "Player", comment: "Above what went well in a challenge"
              )
              .typeStyle(.label)
              .foregroundStyle(.successText)
              .accessibilityAddTraits(.isHeader)
              ForEach(Array(good.enumerated()), id: \.offset) { _, note in
                Label {
                  LessonRichText(named(note.text))
                } icon: {
                  Image(systemName: "checkmark")
                    .foregroundStyle(.successText)
                }
              }
            }
          }

          if !good.isEmpty, !improve.isEmpty {
            Divider()
          }

          if !improve.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
              Text(
                "To improve", tableName: "Player",
                comment: "Above what to improve after a challenge"
              )
              .typeStyle(.label)
              .foregroundStyle(.warningText)
              .accessibilityAddTraits(.isHeader)
              ForEach(Array(improve.enumerated()), id: \.offset) { _, note in
                VStack(alignment: .leading, spacing: 8) {
                  LessonRichText(named(note.text))
                  if let example = note.example {
                    LessonRichText(named(example))
                      .padding(.horizontal, 12)
                      .padding(.vertical, 8)
                      .background(
                        Color.warning.opacity(0.1),
                        in: .rect(cornerRadius: Radius.xl, style: .continuous))
                  }
                }
              }
            }
          }
        }
        .typeStyle(.reading)
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .overlay(
          RoundedRectangle(cornerRadius: Radius.xl, style: .continuous).strokeBorder(.border))
      }

      if !content.skills.isEmpty {
        Text(
          "Skills practiced", tableName: "Player", comment: "Above the skills a challenge trains"
        )
        .typeStyle(.note.weight(.medium))
        .foregroundStyle(.mutedForeground)
        FlowLayout(spacing: 8) {
          ForEach(content.skills) { skill in
            Text(skill.name)
              .chip(wraps: true)
          }
        }
      }
    }
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
