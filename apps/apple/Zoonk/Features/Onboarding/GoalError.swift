import SwiftUI

enum GoalLimitReason: Equatable, Sendable {
  case dailyExplanations
  case dailyGoals
  case guest
  case monthlyExplanations
  case monthlyGoals
  case oneActiveGoal
  case signUpRequired
  case slowDown

  var isPlusLimit: Bool { self == .oneActiveGoal || self == .monthlyGoals }

  /// Mirrors main's `getGoalLimitReason`.
  init(_ limit: OnboardingLimit) {
    let monthly = limit.period == "month"

    if limit.tier == "guest" {
      self = .guest
    } else if limit.resource == "activeGoals" {
      self = .oneActiveGoal
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
        "You've asked as many new questions as the free plan allows today. Try again tomorrow, or get Plus to keep going now.",
        table: "Onboarding",
        comment: "A free learner asked as many quick questions as allowed today")
    case .dailyGoals:
      LocalizedStringResource(
        "You've started as many new goals as your plan allows today. Try again tomorrow.",
        table: "Onboarding", comment: "The learner started as many goals as allowed today")
    case .guest:
      LocalizedStringResource(
        "Without an account, you can follow one goal. Create a free account to keep going.",
        table: "Onboarding", comment: "A guest can't start another goal")
    case .monthlyExplanations:
      LocalizedStringResource(
        "You've asked as many new questions as the free plan allows this month. Try again next month, or get Plus to keep going now.",
        table: "Onboarding",
        comment: "A free learner asked as many quick questions as allowed this month")
    case .monthlyGoals:
      LocalizedStringResource(
        "You've started as many new goals as the free plan allows this month. Try again next month, or get Plus to keep going now.",
        table: "Onboarding", comment: "A free learner started as many goals as allowed this month")
    case .oneActiveGoal:
      LocalizedStringResource(
        "The free plan follows one goal at a time. To start this one, pause your current goal from the menu on your Plan, or get Plus.",
        table: "Onboarding", comment: "A free learner already follows a goal")
    case .signUpRequired:
      LocalizedStringResource(
        "Create your free account to continue.", table: "Onboarding",
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
          "Without an account, you can send a few new goals a day. Create a free account to keep going.",
          table: "Onboarding", comment: "A guest sent as many goals as allowed today"),
        needsAccount: true)
    case .limit(let limit) where limit.tier == "plus":
      return GoalError(
        message: LocalizedStringResource(
          "You've sent as many new goals as your plan allows today. Try again tomorrow.",
          table: "Onboarding", comment: "A Plus learner sent as many goals as allowed today"))
    case .limit(let limit) where limit.period == "month":
      return GoalError(
        message: LocalizedStringResource(
          "You've sent as many new goals as the free plan allows this month. Try again next month, or get Plus to keep going now.",
          table: "Onboarding", comment: "A free learner sent as many goals as allowed this month"))
    case .limit:
      return GoalError(
        message: LocalizedStringResource(
          "You've sent as many new goals as the free plan allows today. Try again tomorrow, or get Plus to keep going now.",
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
    } else {
      Section {
        Text(error.message)
          .foregroundStyle(error.needsAccount ? Color.primary : Color.destructive)

        if error.needsAccount {
          CreateAccountButton()
        }
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
    .listRowInsets(EdgeInsets())
    .listRowBackground(Color.clear)
  }
}

struct GoalLimitNoticeSection: View {
  let reason: GoalLimitReason
  var upFront = false

  @Environment(AppRouter.self) private var router

  var body: some View {
    if reason.isPlusLimit {
      Section {
        Label {
          VStack(alignment: .leading, spacing: 4) {
            if reason == .oneActiveGoal {
              Text(
                "More goals at once with Plus", tableName: "Onboarding",
                comment: "Title of the notice that the free plan follows one goal at a time"
              )
              .font(.headline)

              if upFront {
                Text(
                  "The free plan follows one goal at a time. To start another, pause your current goal from the menu on your Plan. Quick questions work anytime.",
                  tableName: "Onboarding",
                  comment: "Said before typing a goal when the free plan's one goal is taken")
              } else {
                Text(reason.message)
              }
            } else {
              Text(reason.message)
            }
          }
        } icon: {
          Image(systemName: "sparkles")
            .foregroundStyle(.tint)
        }

        Button {
          router.present(.subscription)
        } label: {
          Text(
            "See Plus", tableName: "Onboarding",
            comment: "Opens the Zoonk Plus subscription; Plus is its name, not \"more\"")
        }

        if reason == .oneActiveGoal {
          Button {
            router.showRoot(of: .plan)
          } label: {
            Text(
              "Go to your Plan", tableName: "Onboarding",
              comment: "Opens the Plan, whose menu pauses the current goal")
          }
        }
      }
    }
  }
}
