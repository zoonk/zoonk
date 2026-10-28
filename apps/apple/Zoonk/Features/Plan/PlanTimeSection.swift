import SwiftUI

/// The time a day, as onboarding asks it, with what the chosen time covers right under it, so each
/// change shows its effect: the whole goal, or what it leaves lighter. Then "Find the time that
/// covers everything", which plans the goal at each daily time only when the learner asks, moving a
/// goal's date to the day the time covers it, and an exam's "Study everything, even after the
/// exam", which says what it changes first.
struct PlanTimeSection: View {
  @Environment(PlanStore.self) private var store
  @State private var found: Found?
  @State private var isFinding = false
  @State private var fullCourseEffect: FullCourseEffect?

  let editor: PlanEditor
  let goal: LearnerGoal
  let plan: GoalPlan

  /// What Find answered.
  private enum Found: Equatable {
    case building
    case failed
    case time(PlanTimeToCover)
  }

  private struct FullCourseEffect: Identifiable {
    let effect: PlanEffect?

    var id: Int { 0 }
  }

  var body: some View {
    let current = plan.schedule.dailyMinutes
    var choices = Set(Self.timeChoices + [current])

    if case .time(let time) = found, let minutes = time.recommendedMinutes {
      choices.insert(minutes)
    }

    return Section {
      Picker(
        selection: Binding(
          get: { current },
          set: { minutes in
            guard minutes != current else {
              return
            }

            Task { await setMinutes(minutes) }
          })
      ) {
        ForEach(choices.sorted(), id: \.self) { minutes in
          Text(planDurationText(minutes: Double(minutes)))
            .tag(minutes)
        }
      } label: {
        Text("Time a day", tableName: "Plan", comment: "Setting: study time a day")
      }

      if let coverage = planCoverageText(plan) {
        Text(coverage)
          .font(.subheadline)
          .foregroundStyle(.secondary)

        findRows
      } else if plan.feasibility?.deadline != nil {
        Text(
          "Covers your whole goal.", tableName: "Plan", comment: "The time a day covers everything"
        )
        .font(.subheadline)
        .foregroundStyle(.secondary)
      }

      if goal.kind == .exam, plan.feasibility?.deadline != nil {
        Toggle(
          isOn: Binding(
            get: { plan.schedule.fullCourse },
            set: { on in Task { await askFullCourse(on) } })
        ) {
          Text(
            "Study everything, even after the exam", tableName: "Plan",
            comment: "Setting: keep studying every topic after the exam")
        }
        .tint(.success)
      }
    } footer: {
      Text(
        "Your plan changes from today. Less time spreads your lessons over more days.",
        tableName: "Plan", comment: "Explains what changing the time a day does")
    }
    .alert(
      Text("Study everything", tableName: "Plan", comment: "Title asking to study everything"),
      isPresented: Binding(
        get: { fullCourseEffect != nil }, set: { if !$0 { fullCourseEffect = nil } }),
      presenting: fullCourseEffect
    ) { _ in
      Button {
        Task {
          await editor.change(
            [.fullCourse(true)],
            sentence: String(
              localized: "Your plan studies everything, even after the exam.", table: "Plan",
              comment: "Says the plan now studies everything"))
        }
      } label: {
        Text("Study everything", tableName: "Plan", comment: "Confirms studying everything")
      }

      Button(role: .cancel) {
      } label: {
        Text("Cancel", tableName: "Plan", comment: "Cancels a change")
      }
    } message: { preview in
      let what = String(
        localized: "Every topic, even after the exam, at your own pace.", table: "Plan",
        comment: "What studying everything does")

      Text(
        verbatim: [what, planEffectText(preview.effect, plan: plan)].compactMap(\.self).joined(
          separator: " "))
    }
  }

  @ViewBuilder
  private var findRows: some View {
    switch found {
    case nil:
      if !(plan.feasibility?.timeCovers ?? false) {
        Button {
          Task { await find() }
        } label: {
          Text(
            "Find the time that covers everything", tableName: "Plan",
            comment: "Plans the goal at each time a day to find one that covers it")
        }
        .disabled(isFinding)
      }
    case .building:
      Text(
        "Your plan is still being built. Try again in a moment.", tableName: "Plan",
        comment: "Find asked while the plan was being built"
      )
      .font(.subheadline)
      .foregroundStyle(.secondary)
    case .failed:
      Text(
        "We couldn't work out the time needed.", tableName: "Plan",
        comment: "Find failed"
      )
      .font(.subheadline)
      .foregroundStyle(.secondary)
    case .time(let time):
      foundRows(time)
    }

    if isFinding {
      Label {
        Text("Finding the time…", tableName: "Plan", comment: "Find is planning each time a day")
      } icon: {
        ProgressView()
      }
      .foregroundStyle(.secondary)
    }
  }

  @ViewBuilder
  private func foundRows(_ time: PlanTimeToCover) -> some View {
    if let minutes = time.recommendedMinutes, let date = time.targetDate ?? plan.schedule.targetDate
    {
      Button {
        Task { await setMinutes(minutes) }
      } label: {
        Text(
          "At \(planDurationText(minutes: Double(minutes))) a day, your plan covers everything by \(PlanDate.text(date, today: plan.today)).",
          tableName: "Plan", comment: "The time a day Find found, which a tap applies")
      }
    } else if let date = plan.schedule.targetDate {
      Text(
        "No amount of time a day covers everything in depth by \(PlanDate.text(date, today: plan.today)).",
        tableName: "Plan", comment: "Find found no time a day that covers everything"
      )
      .font(.subheadline)
      .foregroundStyle(.secondary)
    }

    // A goal that isn't an exam can move its date to the day its own time covers everything.
    if goal.kind != .exam, let fittingDate = time.fittingDate {
      Button {
        Task {
          await editor.change(
            [.targetDate(fittingDate)],
            sentence: String(
              localized: "Date moved to \(PlanDate.text(fittingDate, today: plan.today)).",
              table: "Plan", comment: "Says the goal's date moved"))
        }
      } label: {
        Text(
          "Move your date to \(PlanDate.text(fittingDate, today: plan.today))", tableName: "Plan",
          comment: "Moves the goal's date to the day its time covers everything")
      }
    }
  }

  private func setMinutes(_ minutes: Int) async {
    await editor.change(
      [.dailyMinutes(minutes)],
      sentence: String(
        localized: "Daily time changed to \(planDurationText(minutes: Double(minutes))).",
        table: "Plan", comment: "Says the plan's time a day changed"))
  }

  private func find() async {
    isFinding = true
    defer { isFinding = false }

    let goalId = goal.id
    let time = await store.write { api, token in
      try await api.timeToCover(token: token, goalId: goalId)
    } changed: { _ in
      false
    }

    switch time {
    case .done(let time) where time.ready: found = .time(time)
    case .done: found = .building
    case .failed: found = .failed
    case .obsolete: break
    }
  }

  /// Turning it on says what it changes first; turning it off applies at once.
  private func askFullCourse(_ on: Bool) async {
    guard on else {
      await editor.change(
        [.fullCourse(false)],
        sentence: String(
          localized: "What doesn't fit by the exam is left out of your plan.", table: "Plan",
          comment: "Says the plan stops studying everything"))
      return
    }

    let goalId = goal.id
    let effect = await store.write { api, token in
      try await api.preview(token: token, goalId: goalId, edits: [.fullCourse(true)])
    } changed: { _ in
      false
    }

    switch effect {
    case .done(let effect): fullCourseEffect = FullCourseEffect(effect: effect)
    case .failed: fullCourseEffect = FullCourseEffect(effect: nil)
    case .obsolete: break
    }
  }

  /// The times onboarding offers, with the learner's own among them.
  private static let timeChoices = [10, 15, 20, 30, 45, 60, 90, 120, 180]
}

/// What the learner's own time covers by the date, exactly as their plan has it; nil when it
/// covers everything in depth.
func planCoverageText(_ plan: GoalPlan) -> String? {
  guard let feasibility = plan.feasibility, feasibility.deadline != nil, !feasibility.fits else {
    return nil
  }

  let time = planDurationText(minutes: Double(plan.schedule.dailyMinutes))
  let isExam = feasibility.measure == "exam"

  if feasibility.coveredShare < 0.005 {
    return String(
      localized: "\(time) a day isn't enough time to cover your goal.", table: "Plan",
      comment: "The time a day covers next to nothing")
  }

  if feasibility.coreFits && isExam {
    return feasibility.deepensMostAsked
      ? String(
        localized:
          "\(time) a day studies every topic of the exam, the ones that come up most in more depth.",
        table: "Plan", comment: "What the time a day covers of an exam")
      : String(
        localized: "\(time) a day studies every topic of the exam, some of them in less depth.",
        table: "Plan", comment: "What the time a day covers of an exam")
  }

  if feasibility.coreFits {
    return String(
      localized:
        "\(time) a day studies every part of your goal, the ones that matter most in more depth.",
      table: "Plan", comment: "What the time a day covers of a goal")
  }

  if isExam && plan.schedule.fullCourse {
    return String(
      localized:
        "\(time) a day doesn't reach every topic by the exam: the ones that come up least come after it.",
      table: "Plan", comment: "What the time a day leaves for after the exam")
  }

  return isExam
    ? String(
      localized:
        "\(time) a day doesn't reach every topic: the ones that come up least are left out.",
      table: "Plan", comment: "What the time a day leaves out of an exam")
    : String(
      localized:
        "\(time) a day doesn't reach every part of your goal: what comes last in your path is left out.",
      table: "Plan", comment: "What the time a day leaves out of a goal")
}
