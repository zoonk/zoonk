import SwiftUI

/// A ready plan's own items in the "…" options, which its header draws beside its title with
/// "Adjust plan" (`PlanHeaderActions`), as main's Plan has them at every width.
struct PlanToolbar: ViewModifier {
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner

  let context: PlanContext

  func body(content: Content) -> some View {
    content
      .modifier(GoalOptionsToolbar(goal: context.goal, inPageHeader: true) { planItems })
  }

  @ViewBuilder
  private var planItems: some View {
    Section {
      if context.goal.kind == .exam {
        Button {
          router.open(.exam)
        } label: {
          Label {
            Text("About the exam", tableName: "Plan", comment: "Opens the exam's page")
          } icon: {
            Image(systemName: "graduationcap")
          }
        }
      }

      if let course = context.plan.libraryCourse {
        Button {
          router.open(.course(courseId: course.courseId, title: course.title))
        } label: {
          Label {
            Text(
              "See the full course", tableName: "Plan",
              comment: "Opens the Library course the plan is built from")
          } icon: {
            Image(systemName: "books.vertical")
          }
        }
      }
    }

    ShareLink(item: shareURL) {
      Label {
        Text("Share the plan", tableName: "Plan", comment: "Shares a link to the plan")
      } icon: {
        Image(systemName: "square.and.arrow.up")
      }
    }

    Button {
      router.select(.buddy)
    } label: {
      Label {
        Text(
          "Talk to \(learner.buddyDisplayName)", tableName: "Plan",
          comment: "Opens the buddy's conversation, where questions about the plan go")
      } icon: {
        Image(systemName: "questionmark.bubble")
      }
    }

    Button {
      context.report()
    } label: {
      Label {
        Text(
          "Report a problem", tableName: "Plan", comment: "Opens the feedback form about the plan"
        )
      } icon: {
        Image(systemName: "flag")
      }
    }
  }

  private var shareURL: URL {
    URL(string: "https://www.zoonk.com/plan-link/\(context.plan.planId)")!
  }
}

/// Main's `PlanHeader`: "Adjust plan" and the "…" options after the title.
struct PlanHeaderActions: View {
  @Environment(\.planOptions) private var options

  let context: PlanContext

  var body: some View {
    HStack(spacing: 8) {
      Button {
        context.adjust(.top)
      } label: {
        Text("Adjust plan", tableName: "Plan", comment: "Opens the plan's settings to change them")
      }
      .buttonStyle(.outline)
      .controlSize(.small)

      options
    }
  }
}
