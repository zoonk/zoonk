import SwiftUI

/// Never shows its owner or their progress. The owner is sent to their own Plan.
struct PlanLinkScreen: View {
  let planId: String

  @Environment(AppRouter.self) private var router
  @Environment(OnboardingStore.self) private var onboarding
  @State private var dailyMinutes = 30
  @State private var isStarting = false
  @State private var error: GoalError?
  @State private var goalID: String?
  @State private var startTask: Task<Void, Never>?

  var body: some View {
    let resource = onboarding.planLink(id: planId)

    NavigationStack {
      if let goalID {
        GoalSetupContent(goalID: goalID)
      } else {
        Group {
          switch resource.state {
          case .loaded(let link):
            plan(link)
          case .failed(.notFound):
            ContentUnavailableView {
              Label {
                Text(
                  "This plan isn't available", tableName: "PlanLink",
                  comment: "A shared plan link that doesn't exist")
              } icon: {
                Image(systemName: "link")
              }
            }
          case .failed:
            ContentUnavailableView {
              Text(
                "We couldn't load this plan", tableName: "PlanLink",
                comment: "A shared plan failed to load")
            } actions: {
              Button {
                Task { await resource.refresh() }
              } label: {
                Text("Try again", tableName: "PlanLink", comment: "Loads the shared plan again")
              }
            }
          case .idle, .loading, .empty:
            ProgressView()
          }
        }
        .closesTask()
      }
    }
    .loads(resource, refreshable: false)
    .onDisappear {
      startTask?.cancel()
    }
    .onChange(of: resource.value?.owner?.goalId) { _, ownGoal in
      if ownGoal != nil {
        router.showRoot(of: .plan)
      }
    }
  }

  private func plan(_ link: Components.Schemas.PlanLink) -> some View {
    let outline = link.outline

    return Form {
      Section {
        VStack(alignment: .leading, spacing: 6) {
          Text(
            "A study plan someone shared with you", tableName: "PlanLink",
            comment: "Eyebrow over a shared plan's subject"
          )
          .font(.subheadline)
          .foregroundStyle(.secondary)
          Group {
            if let subject = outline.subject?.title {
              Text(subject)
            } else {
              Text(
                "A study plan", tableName: "PlanLink", comment: "A shared plan without a subject")
            }
          }
          .font(.title2.bold())
          .accessibilityAddTraits(.isHeader)

          if let description = outline.subject?.description {
            Text(description)
              .foregroundStyle(.secondary)
          }

          Text(
            "You get your own plan for the same subject, at your own pace. A few questions then skip what you already know.",
            tableName: "PlanLink", comment: "What starting from a shared plan does"
          )
          .font(.subheadline)
          .foregroundStyle(.secondary)
        }
        .listRowBackground(Color.clear)
      }

      Section {
        Picker(selection: $dailyMinutes) {
          ForEach([15, 30, 45, 60, 90, 120], id: \.self) { minutes in
            Text(duration(minutes)).tag(minutes)
          }
        } label: {
          Text(
            "How much time a day?", tableName: "PlanLink",
            comment: "Label of the daily time picker for a shared plan")
        }
      }

      if let error {
        Section {
          Text(error.message)
            .foregroundStyle(.destructive)
        }
      }

      Section {
        Button(action: start) {
          Text(
            "Start from this plan", tableName: "PlanLink",
            comment: "Starts the learner's own plan from a shared one"
          )
          .frame(maxWidth: .infinity)
        }
        .buttonStyle(.mainAction)
        .controlSize(.large)
        .disabled(isStarting)
        .listRowInsets(EdgeInsets())
        .listRowBackground(Color.clear)
      }

      Section {
        ForEach(Array(outline.phases.enumerated()), id: \.offset) { index, phase in
          LabeledContent {
            if let size = phaseSize(phase.hours) {
              Text(size)
                .monospacedDigit()
            }
          } label: {
            Label {
              Text(phase.name)
              if let milestone = phase.milestone {
                Text(milestone)
              }
            } icon: {
              Text(index + 1, format: .number)
                .monospacedDigit()
                .foregroundStyle(index == 0 ? AnyShapeStyle(.tint) : AnyShapeStyle(.secondary))
            }
          }
        }
      } header: {
        Text("A study plan", tableName: "PlanLink", comment: "Header over a shared plan's phases")
      } footer: {
        Text(
          "~\(duration(max(1, minutes(outline.hours)))) of study · \(outline.phases.count) phases · \(outline.skillCount) skills",
          tableName: "PlanLink", comment: "A shared plan's size: its study time, phases and skills")
      }
    }
  }

  private func start() {
    guard !isStarting else {
      return
    }

    isStarting = true
    error = nil

    startTask = Task {
      defer { isStarting = false }

      do {
        let started = try await onboarding.startFromPlanLink(id: planId, dailyMinutes: dailyMinutes)

        if started.isNew {
          goalID = started.goalID
        } else {
          router.showRoot(of: .plan)
        }
      } catch is CancellationError {
      } catch OnboardingError.goalLimit, OnboardingError.signUpRequired, OnboardingError.slowDown {
        error = GoalError(
          message: LocalizedStringResource(
            "You can't start another goal right now. Finish or pause one first.", table: "PlanLink",
            comment: "A goal limit refused starting from a shared plan"))
      } catch {
        self.error = GoalError(
          message: LocalizedStringResource(
            "That didn't work. Try again in a moment.", table: "PlanLink",
            comment: "Starting from a shared plan failed"))
      }
    }
  }

  /// A phase too small to measure shows no size, so nothing ever reads "~0 min".
  private func phaseSize(_ hours: Double) -> String? {
    let minutes = minutes(hours)
    return minutes > 0 ? "~" + duration(minutes) : nil
  }

  /// Under an hour counts in minutes; from an hour on, in whole hours, since it's an estimate.
  private func minutes(_ hours: Double) -> Int {
    let minutes = Int((hours * 60).rounded())
    return minutes < 60 ? minutes : Int(hours.rounded()) * 60
  }

  private func duration(_ minutes: Int) -> String {
    Duration.seconds(minutes * 60).formatted(
      .units(allowed: [.hours, .minutes], width: .abbreviated))
  }
}
