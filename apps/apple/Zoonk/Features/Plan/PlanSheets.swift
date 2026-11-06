import SwiftUI

/// The sheets a plan's rows open. The screen presents them from above its `PaneSplit`: folding
/// iPhone Duo recreates the panes, and a sheet presented from a row in one closes with it.
enum PlanSheet: Identifiable, Hashable {
  case path
  case standing
  case pace
  case farTopic(skillId: String, title: String)
  case certificate(code: String)
  case suggestion(PlanSlotItem)

  var id: Self { self }
}

extension View {
  func planSheets(
    _ sheet: Binding<PlanSheet?>, context: PlanContext, syllabus: GoalSyllabus?,
    slotAnswer: Binding<PlanSlotAnswer?> = .constant(nil)
  ) -> some View {
    modifier(
      PlanSheets(sheet: sheet, slotAnswer: slotAnswer, context: context, syllabus: syllabus))
  }
}

private struct PlanSheets: ViewModifier {
  @Environment(AppRouter.self) private var router
  @Environment(PlanStore.self) private var store
  @State private var then: Then?

  @Binding var sheet: PlanSheet?
  @Binding var slotAnswer: PlanSlotAnswer?
  let context: PlanContext
  let syllabus: GoalSyllabus?

  private enum Then {
    case adjust(AdjustPlanSheet.Section)
    case showClaim(PlanClaim)
    case open(AppRoute)
  }

  func body(content: Content) -> some View {
    content
      .sheet(item: $sheet, onDismiss: doThen) { sheet in
        Group {
          switch sheet {
          case .path:
            PlanPathSheet(context: context)
          case .standing:
            NavigationStack {
              if context.goal.kind == .language,
                let language = store.languageStanding(goalId: context.goal.id).value
              {
                LanguageLevelSheet(standing: language)
              } else {
                PlanStandingSheet(context: context, syllabus: syllabus)
              }
            }
            .presentationDetents([.medium, .large])
          case .pace:
            NavigationStack {
              PlanPaceSheet(context: context) {
                then = .adjust(.top)
                self.sheet = nil
              }
            }
            .presentationDetents([.medium, .large])
          case .farTopic(let skillId, let title):
            FarTopicSheet(goal: context.goal, skillId: skillId, title: title)
          case .certificate(let code):
            CertificateSheet(code: code)
          case .suggestion(let item):
            SuggestionSheet {
              PlanSuggestionSection(context: handingOff, answer: $slotAnswer, sheetItem: item)
            }
          }
        }
        .environment(
          \.planSheetOpen,
          PlanSheetOpen { route in
            then = .open(route)
            self.sheet = nil
          }
        )
        .zoonkStyles()
      }
  }

  /// The plan's editor and a certificate's moment are presented by the screen too, so the
  /// suggestion closes before either opens.
  private var handingOff: PlanContext {
    var context = context
    context.adjust = { section in
      then = .adjust(section)
      sheet = nil
    }
    context.showClaim = { claim in
      then = .showClaim(claim)
      sheet = nil
    }
    return context
  }

  private func doThen() {
    switch then {
    case .adjust(let section): context.adjust(section)
    case .showClaim(let claim): context.showClaim(claim)
    case .open(let route): router.open(route)
    case nil: break
    }

    then = nil
  }
}

/// A far topic's outline opens over the path, so closing it comes back to the path.
private struct PlanPathSheet: View {
  @Environment(\.planSheetOpen) private var sheetOpen
  @State private var outline: PlanSheet?
  @State private var pendingRoute: AppRoute?

  let context: PlanContext

  var body: some View {
    var rows = context
    rows.show = { outline = $0 }

    return NavigationStack {
      ZoonkList {
        PlanPathRows(context: rows, brief: true)
      }
      .navigationTitle(
        Text("Your path", tableName: "Plan", comment: "Title of the plan's phases")
      )
      .toolbarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          PlanSheetDoneButton()
        }
      }
    }
    .presentationDetents([.medium, .large])
    .sheet(item: $outline, onDismiss: openPendingRoute) { sheet in
      if case .farTopic(let skillId, let title) = sheet {
        FarTopicSheet(goal: context.goal, skillId: skillId, title: title)
          .environment(
            \.planSheetOpen,
            PlanSheetOpen { route in
              pendingRoute = route
              outline = nil
            }
          )
          .zoonkStyles()
      }
    }
  }

  private func openPendingRoute() {
    if let route = pendingRoute {
      pendingRoute = nil
      sheetOpen?.open(route)
    }
  }
}
