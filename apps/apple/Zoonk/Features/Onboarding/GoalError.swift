import SwiftUI

enum GoalLimitReason: Equatable, Sendable {
  case dailyExplanations
  case dailyGoals
  case guest
  case monthlyExplanations
  case activeGoals
  case monthlyGoals
  case signUpRequired
  case slowDown

  var isPlusLimit: Bool { self == .activeGoals || self == .monthlyGoals }

  /// Mirrors main's `getGoalLimitReason`.
  init(_ limit: OnboardingLimit) {
    let monthly = limit.period == "month"

    if limit.tier == "guest" {
      self = .guest
    } else if limit.resource == "activeGoals" {
      self = .activeGoals
    } else if limit.resource == "explanation" {
      self = monthly ? .monthlyExplanations : .dailyExplanations
    } else {
      self = monthly ? .monthlyGoals : .dailyGoals
    }
  }

  var message: LocalizedStringResource {
    switch self {
    case .dailyExplanations:
      LocalizedStringResource(
        "No more quick explanations today. More tomorrow, or subscribe to keep going.",
        table: "Onboarding",
        comment: "A free learner asked for as many quick explanations as allowed today")
    case .dailyGoals:
      LocalizedStringResource(
        "No more new goals today. More tomorrow.",
        table: "Onboarding", comment: "The learner started as many goals as allowed today")
    case .guest:
      LocalizedStringResource(
        "Without an account, you study one goal. Create a free account to start another.",
        table: "Onboarding", comment: "A guest can't start another goal")
    case .monthlyExplanations:
      LocalizedStringResource(
        "No more quick explanations this month. More next month, or subscribe to keep going.",
        table: "Onboarding",
        comment: "A free learner asked for as many quick explanations as allowed this month")
    case .monthlyGoals:
      LocalizedStringResource(
        "No more new goals this month. More next month, or subscribe to keep going.",
        table: "Onboarding", comment: "A free learner started as many goals as allowed this month")
    case .activeGoals:
      LocalizedStringResource(
        "That's all the goals you can study at once. Pause one, or subscribe to study more.",
        table: "Onboarding",
        comment:
          "A free learner studies as many goals at once as their plan allows; it's about goals at the same time, not new goals started per day or month. Pausing a goal keeps its progress"
      )
    case .signUpRequired:
      LocalizedStringResource(
        "This needs a free account.", table: "Onboarding",
        comment: "Guests' shared AI budget for the day is spent")
    case .slowDown:
      LocalizedStringResource(
        "You're starting goals quickly. Try again in a few minutes.", table: "Onboarding",
        comment: "The learner is starting goals too quickly")
    }
  }
}

/// A limit only an account lifts isn't an error: it says why, and creating a free account is the way
/// on.
struct GoalError: Equatable {
  let message: LocalizedStringResource
  var needsAccount = false
  var limit: GoalLimitReason?

  /// The entry keeps the words to send again.
  static func starting(_ error: Error) -> GoalError {
    switch error as? OnboardingError {
    case .limit(let limit) where limit.isGoalLimit:
      return GoalError(message: GoalLimitReason.guest.message, needsAccount: true)
    case .limit(let limit) where limit.tier == "guest":
      return GoalError(
        message: LocalizedStringResource(
          "No more new goals today without an account.",
          table: "Onboarding", comment: "A guest sent as many goals as allowed today"),
        needsAccount: true)
    case .limit(let limit) where limit.tier == "plus":
      return GoalError(
        message: LocalizedStringResource(
          "No more new goals today. More tomorrow.",
          table: "Onboarding", comment: "A subscriber sent as many goals as allowed today"))
    case .limit(let limit) where limit.period == "month":
      return GoalError(
        message: LocalizedStringResource(
          "No more new goals this month. More next month, or subscribe to keep going.",
          table: "Onboarding", comment: "A free learner sent as many goals as allowed this month"))
    case .limit:
      return GoalError(
        message: LocalizedStringResource(
          "No more new goals today. More tomorrow, or subscribe to keep going.",
          table: "Onboarding", comment: "A free learner sent as many goals as allowed today"))
    case .signUpRequired:
      return GoalError(message: GoalLimitReason.signUpRequired.message, needsAccount: true)
    case .slowDown:
      return GoalError(
        message: LocalizedStringResource(
          "One moment. Try again in a few seconds.", table: "Onboarding",
          comment: "The learner is sending goals too quickly"))
    default:
      return GoalError(
        message: LocalizedStringResource(
          "We couldn't read your goal. Try again in a moment.", table: "Onboarding",
          comment: "Sending a typed goal failed"))
    }
  }

  static func creating(_ error: Error) -> GoalError {
    let reason: GoalLimitReason? =
      switch error as? OnboardingError {
      case .goalLimit(let limit): GoalLimitReason(limit)
      case .signUpRequired: .signUpRequired
      case .slowDown: .slowDown
      default: nil
      }

    guard let reason else {
      return GoalError(
        message: LocalizedStringResource(
          "We couldn't save your goal. Try again in a moment.", table: "Onboarding",
          comment: "Creating the confirmed goals failed"))
    }

    return GoalError(
      message: reason.message,
      needsAccount: reason == .guest || reason == .signUpRequired,
      limit: reason)
  }
}

struct GoalErrorSection: View {
  let error: GoalError

  var body: some View {
    if let limit = error.limit, limit.isPlusLimit {
      GoalLimitNoticeSection(reason: limit)
    } else if error.needsAccount {
      Section {
        Text(error.message)
          .announcesAlert(String(localized: error.message))

        CreateAccountButton()
      }
    } else {
      Section {
        FailureLine(message: error.message)
      }
    }
  }
}

struct CreateAccountButton: View {
  @Environment(AppRouter.self) private var router

  var body: some View {
    Button {
      router.present(.signIn)
    } label: {
      Text(
        "Create a free account", tableName: "Onboarding",
        comment: "Opens sign-up; a guest's plan and progress come with them"
      )
      .frame(maxWidth: .infinity)
    }
    .buttonStyle(.mainAction)
    .controlSize(.large)
    .keepsOffFold()
    .listRowInsets(.vertical, 0)
    .listRowBackground(Color.clear)
  }
}

/// Main's `GoalLimitNotice`: the gate a learner meets on trying to start a goal their plan has no
/// room for.
struct GoalLimitNoticeSection: View {
  let reason: GoalLimitReason

  @Environment(AppRouter.self) private var router

  var body: some View {
    if reason == .activeGoals {
      Section {
        SubscribeGate(
          title: Text(
            "That's all the goals you can study at once", tableName: "Onboarding",
            comment:
              "A free learner studies as many goals at once as their plan allows; it's about goals at the same time, not new goals started per day or month"
          ),
          line: Text(
            "Pause one in your Plan, or subscribe to study more at once.", tableName: "Onboarding",
            comment: "Pausing a goal keeps its progress")
        ) {
          Button {
            router.showRoot(of: .plan)
          } label: {
            Text(
              "Go to your Plan", tableName: "Onboarding",
              comment: "Opens the Plan, whose menu pauses a goal and keeps its progress")
          }
        }
        .announcesAlert(String(localized: reason.message))
      }
    } else if reason == .monthlyGoals {
      Section {
        SubscribeGate(
          title: Text(
            "No more new goals this month", tableName: "Onboarding",
            comment: "A free learner started as many new goals as their plan allows this month"),
          line: HelpLimit.limitReached(period: .month, tier: .free).comesBack.map(Text.init)
        )
        .announcesAlert(String(localized: reason.message))
      }
    }
  }
}
