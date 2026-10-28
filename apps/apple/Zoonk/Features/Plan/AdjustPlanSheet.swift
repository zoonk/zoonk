import SwiftUI

/// "Adjust your plan": the goal's date, the time a day and the study days. Each change re-plans
/// from today and saves at once, as main's editor does: fewer minutes or a closed day apply right
/// away, this week included, and the sheet says what the latest change did (its new end, whether
/// today's session follows it) with Undo while it's the plan's latest change. Opened at a setting
/// the Plan lists, it scrolls there.
struct AdjustPlanSheet: View {
  enum Section: Hashable, Identifiable {
    case date
    case days
    case time
    case top

    var id: Self { self }
  }

  @Environment(PlanStore.self) private var store
  @State private var latest: Latest?
  @State private var isSaving = false
  @State private var failed = false

  let goal: LearnerGoal
  let plan: GoalPlan
  let section: Section

  /// The latest change, until it's undone.
  private enum Latest: Equatable {
    case applied(AppliedPlanChange, sentence: String)
    case undone
    case unchanged
  }

  var body: some View {
    NavigationStack {
      ScrollViewReader { proxy in
        Form {
          if let latest {
            latestSection(latest)
          }

          dateSection
            .id(Section.date)
          timeSection
            .id(Section.time)
          daysSection
            .id(Section.days)
        }
        .disabled(isSaving)
        .onAppear {
          if section != .top {
            proxy.scrollTo(section, anchor: .top)
          }
        }
      }
      .navigationTitle(
        Text("Adjust your plan", tableName: "Plan", comment: "Title of the plan editor")
      )
      .toolbarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          PlanSheetDoneButton()
        }

        if isSaving {
          ToolbarItem(placement: .status) {
            ProgressView()
          }
        }
      }
      .alert(
        Text("Couldn't save", tableName: "Plan", comment: "Title of an error saving the plan"),
        isPresented: $failed
      ) {
      } message: {
        Text(
          "Check your connection and try again.", tableName: "Plan",
          comment: "Explains a failed save")
      }
    }
    .presentationDetents([.medium, .large])
  }

  // MARK: Sections

  private var dateSection: some View {
    SwiftUI.Section {
      if let targetDate = plan.schedule.targetDate, let date = PlanDate.date(targetDate) {
        DatePicker(
          selection: Binding(
            get: { date },
            set: { picked in
              let isoDate = picked.formatted(
                .iso8601.year().month().day().timeZone(separator: .omitted))
              save([.targetDate(String(isoDate.prefix(10)))], sentence: dateSentence(picked))
            }),
          in: (PlanDate.date(plan.today) ?? .now)...,
          displayedComponents: .date
        ) {
          dateLabel
        }
        .environment(\.timeZone, .gmt)
      } else {
        LabeledContent {
          goal.kind == .exam
            ? Text("To be confirmed", tableName: "Plan", comment: "An exam's date not known yet")
            : Text("No date", tableName: "Plan", comment: "A goal without a date")
        } label: {
          dateLabel
        }
      }
    }
  }

  private var dateLabel: Text {
    goal.kind == .exam
      ? Text("Exam date", tableName: "Plan", comment: "Setting: the exam's date")
      : Text("Goal date", tableName: "Plan", comment: "Setting: the goal's date")
  }

  private var timeSection: some View {
    let current = plan.schedule.dailyMinutes
    let choices = Array(Set(Self.timeChoices + [current])).sorted()

    return SwiftUI.Section {
      Picker(
        selection: Binding(
          get: { current },
          set: { minutes in
            guard minutes != current else {
              return
            }

            save(
              [.dailyMinutes(minutes)],
              sentence: String(
                localized: "Daily time changed to \(planDurationText(minutes: Double(minutes))).",
                table: "Plan", comment: "Says the plan's time a day changed"))
          })
      ) {
        ForEach(choices, id: \.self) { minutes in
          Text(planDurationText(minutes: Double(minutes)))
            .tag(minutes)
        }
      } label: {
        Text("Time a day", tableName: "Plan", comment: "Setting: study time a day")
      }
    } footer: {
      Text(
        "Your plan changes from today. Less time spreads your lessons over more days.",
        tableName: "Plan", comment: "Explains what changing the time a day does")
    }
  }

  private var daysSection: some View {
    let weekdayMinutes = plan.schedule.weekdayMinutes
    let studyCount = weekdayMinutes.filter { $0 > 0 }.count
    let symbols = Calendar.current.weekdaySymbols

    return SwiftUI.Section {
      ForEach(Self.mondayFirst, id: \.self) { weekday in
        let studies = weekdayMinutes.indices.contains(weekday) && weekdayMinutes[weekday] > 0

        Toggle(
          symbols[weekday],
          isOn: Binding(
            get: { studies },
            set: { on in
              let minutes = on ? plan.schedule.dailyMinutes : 0
              save(
                [.weekdayMinutes(minutes, weekdays: [weekday])],
                sentence: on
                  ? String(
                    localized:
                      "\(symbols[weekday]): \(planDurationText(minutes: Double(minutes))) a day.",
                    table: "Plan", comment: "Says a weekday became a study day with its time")
                  : String(
                    localized: "\(symbols[weekday]): rest day.", table: "Plan",
                    comment: "Says a weekday became a rest day"))
            })
        )
        // A plan needs at least one study day.
        .disabled(studies && studyCount == 1)
      }
    } header: {
      Text("Study days", tableName: "Plan", comment: "Setting: the days of the week to study")
    }
    .tint(.success)
  }

  private func latestSection(_ latest: Latest) -> some View {
    SwiftUI.Section {
      switch latest {
      case .undone:
        Text(
          "Undone. Your plan is back as it was.", tableName: "Plan",
          comment: "Says the latest plan change was undone")
      case .unchanged:
        Text(
          "Your plan already works that way.", tableName: "Plan",
          comment: "Says a change wasn't needed")
      case .applied(let change, let sentence):
        VStack(alignment: .leading, spacing: 4) {
          Text(sentence)
            .font(.headline)

          if let effect = effectText(change) {
            Text(effect)
              .foregroundStyle(.secondary)
          }

          appliedLine(change)
            .foregroundStyle(.secondary)
        }
        .font(.subheadline)

        if change.canUndo {
          Button {
            undo(change)
          } label: {
            Text("Undo", tableName: "Plan", comment: "Undoes the latest plan change")
          }
        }
      }
    }
  }

  // MARK: Texts

  private func dateSentence(_ date: Date) -> String {
    String(
      localized:
        "Date moved to \(date.formatted(Date.FormatStyle(date: .long, time: .omitted, timeZone: .gmt))).",
      table: "Plan", comment: "Says the goal's date moved")
  }

  /// "Ends Nov 12 instead of Nov 13."
  private func effectText(_ change: AppliedPlanChange) -> String? {
    guard
      let after = change.effect?.endDateAfter, let before = change.effect?.endDateBefore,
      after != before
    else {
      return nil
    }

    let today = plan.today
    let afterText = PlanDate.text(after, today: today)
    let beforeText = PlanDate.text(before, today: today)

    return plan.schedule.targetDate == nil || plan.schedule.targetDateEstimated
      ? String(
        localized: "Ends around \(afterText) instead of \(beforeText).", table: "Plan",
        comment: "How a change moved the plan's estimated end")
      : String(
        localized: "Ends \(afterText) instead of \(beforeText).", table: "Plan",
        comment: "How a change moved the plan's end")
  }

  /// Whether today's session follows the change or it starts on the next study day.
  private func appliedLine(_ change: AppliedPlanChange) -> Text {
    switch change.todaySession {
    case "changed":
      Text(
        "It's in your plan, and today's session follows it.", tableName: "Plan",
        comment: "Says a change applies to today's session too")
    case "unchanged":
      Text(
        "It's in your plan from your next study day. Today's session stays as it is.",
        tableName: "Plan", comment: "Says a change starts on the next study day")
    default:
      Text("Your plan follows it from now on.", tableName: "Plan", comment: "Says a change applies")
    }
  }

  // MARK: Saving

  private func save(_ edits: [PlanEdit], sentence: String) {
    Task {
      isSaving = true
      let outcome = await store.change(goalId: goal.id, edits: edits)
      isSaving = false

      switch outcome {
      case .applied(let change):
        latest = .applied(change, sentence: sentence)
      case .unchanged, .invalidDate:
        latest = .unchanged
      case nil:
        failed = true
      }
    }
  }

  private func undo(_ change: AppliedPlanChange) {
    Task {
      isSaving = true
      let undone = await store.undo(goalId: goal.id, changeId: change.id)
      isSaving = false

      if undone {
        latest = .undone
      } else {
        failed = true
      }
    }
  }

  private static let mondayFirst = [1, 2, 3, 4, 5, 6, 0]
  /// The times onboarding offers, with the learner's own among them.
  private static let timeChoices = [10, 15, 20, 30, 45, 60, 90, 120, 180]
}
