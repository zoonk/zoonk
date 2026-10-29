import SwiftUI

struct MistakesScreen: View {
  @Environment(SessionStore.self) private var session
  @Environment(PracticeStore.self) private var practice
  @Environment(\.practiceHooks) private var hooks
  @Environment(LearnerSummaryStore.self) private var summary
  @State private var showsFixed = false
  @State private var isLoadingMore = false
  @State private var width: CGFloat = 0

  private var resource: Resource<Components.Schemas.MistakeList> {
    practice.mistakes(goalId: goalId, fixed: showsFixed)
  }

  private var goalId: String? { summary.summary.value?.activeGoalID }

  var body: some View {
    let state = resource.state
    let list = resource.value
    let pattern = goalId.map { practice.pattern(goalId: $0) }

    List {
      Section {
        NotebookHeader(list: list) { hooks.navigate(.mistakePractice(skillId: nil)) }
      }
      .listRowBackground(Color.clear)
      // The row's own side margins: at the cell's edge, a wrapped line's first letter was clipped.
      .listRowInsets(.vertical, 8)

      Section {
        Picker(selection: $showsFixed) {
          Text(
            "To fix \(list?.counts.open ?? 0)", tableName: "Practice",
            comment: "Notebook list of open mistakes, with its count."
          )
          .tag(false)
          Text(
            "Fixed \(list?.counts.fixed ?? 0)", tableName: "Practice",
            comment: "Notebook list of fixed mistakes, with its count."
          )
          .tag(true)
        } label: {
          Text(
            "Mistakes", tableName: "Practice",
            comment: "VoiceOver name of the notebook's list picker.")
        }
        .pickerStyle(.segmented)
      }
      .listRowBackground(Color.clear)
      .listRowInsets(EdgeInsets())

      if !showsFixed, let noticed = pattern?.value {
        Section {
          PatternRow(pattern: noticed) { hooks.navigate(.pattern(patternId: noticed.id)) }
        }
      }

      if let list {
        let labels = PracticeTrueFalseLabels(list.trueFalseLabels.value1)

        if list.data.isEmpty {
          Section {
            Text(emptyText).foregroundStyle(.secondary)
          }
        }

        ForEach(groups(list.data), id: \.key) { group in
          Section {
            ForEach(Array(group.mistakes.enumerated()), id: \.element.id) { position, mistake in
              MistakeEntryView(
                mistake: mistake, labels: labels,
                continuesSet: position > 0 && mistake.snapshot.set != nil
                  && group.mistakes[position - 1].snapshot.set?.value1.id
                    == mistake.snapshot.set?.value1.id
              )
            }
          } header: {
            HStack {
              Text(group.name)
              Spacer()
              Text(group.mistakes.count, format: .number).monospacedDigit()
            }
          }
        }

        if list.pagination.hasMore {
          Section {
            Button {
              Task { await loadMore() }
            } label: {
              Text("Show more", tableName: "Practice", comment: "Loads the notebook's next page.")
            }
            .disabled(isLoadingMore)
          }
        }
      } else if case .failed(let error) = state {
        PracticeLoadFailureView(error: error) { Task { await resource.refresh() } }
          .listRowBackground(Color.clear)
      } else {
        ProgressView().frame(maxWidth: .infinity).listRowBackground(Color.clear)
      }
    }
    .listStyle(.insetGrouped)
    .safeAreaPadding(.horizontal, max(0, (width - PracticeLayout.readableWidth) / 2))
    .onGeometryChange(for: CGFloat.self) {
      $0.size.width
    } action: {
      width = $0
    }
    .navigationTitle(
      Text("Mistakes notebook", tableName: "Practice", comment: "Title of the mistakes notebook.")
    )
    .loads(resource)
    .modifier(LoadsPattern(pattern: pattern))
  }

  private var emptyText: LocalizedStringResource {
    showsFixed
      ? LocalizedStringResource(
        "Mistakes you fix in practice show up here.", table: "Practice",
        comment: "Empty fixed list of the notebook.")
      : LocalizedStringResource(
        "Nothing to fix right now. Mistakes from your lessons and reviews show up here.",
        table: "Practice",
        comment: "Empty open list of the notebook.")
  }

  private struct SkillGroup {
    let key: String
    let name: String
    let mistakes: [Components.Schemas.Mistake]
  }

  /// Questions without a skill last.
  private func groups(_ mistakes: [Components.Schemas.Mistake]) -> [SkillGroup] {
    var order: [String] = []
    var bySkill: [String: [Components.Schemas.Mistake]] = [:]

    for mistake in mistakes {
      let key = mistake.skill?.id ?? "none"
      if bySkill[key] == nil { order.append(key) }
      bySkill[key, default: []].append(mistake)
    }

    return order.map { key in
      let mistakes = bySkill[key] ?? []
      return SkillGroup(
        key: key,
        name: mistakes.first?.skill?.name
          ?? String(
            localized: "Other questions", table: "Practice",
            comment: "Notebook group of mistakes without a skill."),
        mistakes: mistakes)
    }
  }

  /// Appends the next page, unless the list was read again while the page loaded.
  private func loadMore() async {
    let resource = resource
    guard let cursor = resource.value?.pagination.nextCursor,
      let identity = session.authenticatedSession
    else { return }

    let revision = resource.revision
    isLoadingMore = true
    defer { isLoadingMore = false }

    guard
      let next = try? await practice.api.mistakes(
        token: identity.bearerToken, goalId: goalId, fixed: showsFixed,
        cursor: cursor),
      resource.revision == revision
    else { return }

    resource.update { current in
      var merged = next
      merged.data = current.data + next.data
      return merged
    }
  }
}

private struct NotebookHeader: View {
  let list: Components.Schemas.MistakeList?
  let practice: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      if let list {
        let ready = list.availability.ready
        let tomorrow = list.availability.tomorrow

        Text(countsLine(ready: ready, tomorrow: tomorrow, fixed: list.counts.fixed))
          .font(.subheadline.monospacedDigit())
          .foregroundStyle(.secondary)

        if ready == 0, tomorrow > 0 {
          Text(
            "Mistakes come back for practice from the day after you make them.",
            tableName: "Practice",
            comment: "Why today's mistakes can't be practiced yet."
          )
          .font(.subheadline)
          .foregroundStyle(.secondary)
        }

        if ready > 0 {
          Button(action: practice) {
            Text(
              "Practice mistakes", tableName: "Practice",
              comment: "Starts practicing the notebook's ready mistakes."
            )
            .frame(maxWidth: .infinity)
          }
          .buttonStyle(.mainAction)
          .controlSize(.large)
        }
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }

  /// A count of 0 has its own string, since Portuguese's "one" case covers 0.
  private func countsLine(ready: Int, tomorrow: Int, fixed: Int) -> String {
    var parts: [String] = []

    if ready > 0 {
      parts.append(
        String(
          localized: "\(ready) ready to practice", table: "Practice",
          comment: "Notebook count of mistakes ready now."))
    } else if tomorrow == 0 {
      parts.append(
        String(
          localized: "0 ready to practice", table: "Practice",
          comment: "Notebook count when no mistake is ready now."))
    }

    if tomorrow > 0 {
      parts.append(
        String(
          localized: "\(tomorrow) available tomorrow", table: "Practice",
          comment: "Notebook count of today's mistakes."))
    }

    parts.append(
      fixed == 0
        ? String(
          localized: "0 fixed", table: "Practice",
          comment: "Notebook count when no mistake is fixed yet.")
        : String(
          localized: "\(fixed) fixed", table: "Practice",
          comment: "Notebook count of fixed mistakes."))
    return parts.joined(separator: " · ")
  }
}

private struct MistakeEntryView: View {
  let mistake: Components.Schemas.Mistake
  let labels: PracticeTrueFalseLabels
  let continuesSet: Bool
  @Environment(\.practiceHooks) private var hooks

  var body: some View {
    let snapshot = mistake.snapshot
    let fixed = mistake.status == .fixed

    VStack(alignment: .leading, spacing: 12) {
      HStack {
        Label {
          Text(causeLabel(fixed: fixed))
        } icon: {
          Image(systemName: causeIcon)
        }
        Spacer()
        Text(entryDate)
          .monospacedDigit()
      }
      .font(.caption.weight(.medium))
      .foregroundStyle(.secondary)

      if let set = try? snapshot.set.map({ try PracticeJSON.recode($0.value1) as PracticeItemSet })
      {
        ItemSetStimulusView(set: set, continued: continuesSet)
      }

      ItemSupportView(
        context: snapshot.context,
        image: try? snapshot.image.map { try PracticeJSON.recode($0.value1) },
        visual: try? snapshot.visual.map { try PracticeJSON.recode($0) })

      ItemText(snapshot.question).font(.body.weight(.medium))

      if let answer = TrueFalseWords.savedAnswer(snapshot.answer, labels: labels) {
        MistakeAnswerRow(text: answer, isRight: false)
      }

      if let correct = TrueFalseWords.savedAnswer(snapshot.correctAnswer, labels: labels) {
        MistakeAnswerRow(text: correct, isRight: true)
      }

      if let explanation = snapshot.explanation {
        ItemText(explanation).font(.subheadline).foregroundStyle(.secondary)
      }

      actions
    }
    .padding(.vertical, 6)
  }

  @ViewBuilder
  private var actions: some View {
    let skillId = mistake.practiceAvailable ? mistake.skill?.id : nil

    if mistake.practiceAvailableTomorrow || skillId != nil || mistake.lesson != nil {
      HStack(spacing: 12) {
        if mistake.practiceAvailableTomorrow {
          Text(
            "Practice tomorrow", tableName: "Practice",
            comment: "A mistake from today, ready to practice tomorrow."
          )
          .font(.caption)
          .foregroundStyle(.secondary)
        }

        if let skillId {
          Button {
            hooks.navigate(.mistakePractice(skillId: skillId))
          } label: {
            Text(
              "Practice this skill", tableName: "Practice",
              comment: "Practices only this skill's mistakes.")
          }
          .buttonStyle(.bordered)
        }

        if let lesson = mistake.lesson {
          Button {
            hooks.navigate(.lesson(lessonId: lesson.id))
          } label: {
            Text(
              "Open the lesson", tableName: "Practice",
              comment: "Opens the lesson that teaches a mistake's idea.")
          }
          .buttonStyle(.borderless)
        }
      }
      .controlSize(.small)
    }
  }

  private var entryDate: String {
    let date = mistake.status == .fixed ? (mistake.fixedAt ?? mistake.createdAt) : mistake.createdAt
    let sameYear = Calendar.current.isDate(date, equalTo: .now, toGranularity: .year)
    return sameYear
      ? date.formatted(.dateTime.month(.abbreviated).day())
      : date.formatted(.dateTime.month(.abbreviated).day().year())
  }

  private var causeIcon: String {
    switch mistake.cause?.value1 {
    case .gap: "lightbulb"
    case .guess: "hand.raised"
    case .misread: "eye"
    case .time: "timer"
    case .trap: "exclamationmark.triangle"
    case nil: "circle.dashed"
    }
  }

  private func causeLabel(fixed: Bool) -> String {
    let cause: String =
      switch mistake.cause?.value1 {
      case .gap:
        String(
          localized: "Content gap", table: "Practice",
          comment: "Mistake cause: didn't know the idea.")
      case .misread:
        String(
          localized: "Misread", table: "Practice", comment: "Mistake cause: misread the question.")
      case .trap:
        String(
          localized: "Fell for a trap", table: "Practice",
          comment: "Mistake cause: fell for a trap answer.")
      case .time:
        String(
          localized: "Ran out of time", table: "Practice",
          comment: "Mistake cause: ran out of time.")
      case .guess:
        String(localized: "Guessed", table: "Practice", comment: "Mistake cause: guessed.")
      case nil:
        String(
          localized: "Not sorted yet", table: "Practice", comment: "Mistake cause not named yet.")
      }

    return fixed
      ? String(
        localized: "\(cause) · Fixed", table: "Practice", comment: "A fixed mistake's cause line.")
      : cause
  }
}

struct MistakeAnswerRow: View {
  let text: String
  let isRight: Bool

  var body: some View {
    HStack(alignment: .firstTextBaseline, spacing: 12) {
      Text(ItemTextBlock.inline(text)).frame(maxWidth: .infinity, alignment: .leading)
      Text(
        isRight
          ? LocalizedStringResource(
            "Correct", table: "Practice",
            comment: "Mark beside the right option once a question is graded.")
          : LocalizedStringResource(
            "Your answer", table: "Practice",
            comment: "Mark beside the learner's wrong pick once a question is graded.")
      )
      .font(.caption.weight(.semibold))
      .foregroundStyle(isRight ? Color.success : Color.destructive)
    }
    .font(.subheadline.weight(.medium))
    .padding(12)
    .background(
      (isRight ? Color.success : Color.destructive).opacity(0.1),
      in: RoundedRectangle(cornerRadius: 10, style: .continuous)
    )
    .overlay(
      RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(
        isRight ? Color.success : Color.destructive, lineWidth: 1.5)
    )
    .accessibilityElement(children: .combine)
  }
}

private struct LoadsPattern: ViewModifier {
  let pattern: Resource<NoticedPattern>?

  func body(content: Content) -> some View {
    if let pattern {
      content.loads(pattern, refreshable: false)
    } else {
      content
    }
  }
}

private struct PatternRow: View {
  let pattern: NoticedPattern
  let open: () -> Void

  var body: some View {
    Button(action: open) {
      Label {
        VStack(alignment: .leading, spacing: 2) {
          Text(
            pattern.isTypos
              ? LocalizedStringResource(
                "Just typos", table: "Practice",
                comment: "Title when recent mistakes were only typos.")
              : LocalizedStringResource(
                "We noticed a pattern", table: "Practice",
                comment: "Eyebrow over a noticed mistake pattern.")
          )
          .foregroundStyle(.primary)

          Text(
            pattern.isTypos
              ? String(
                localized: "Your recent mistakes were slips, not a rule to learn.",
                table: "Practice",
                comment: "Notebook row for a typos-only pattern.")
              : pattern.title
          )
          .font(.subheadline)
          .foregroundStyle(.secondary)
        }
      } icon: {
        Image(systemName: pattern.isTypos ? "keyboard" : "sparkles")
          .foregroundStyle(pattern.isTypos ? Color.secondary : Color.warning)
      }
    }
  }
}
