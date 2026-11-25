import SwiftUI

/// The sheets a plan's rows open. The screen presents them from above its `PaneSplit`: folding
/// iPhone Duo recreates the panes, and a sheet presented from a row in one closes with it.
enum PlanSheet: Identifiable, Hashable {
  case mockSchedule(String)
  case path
  case standing
  case schedule
  /// `lessons` and `start` say what its row says: how many lessons and when they start.
  case farTopic(skillId: String, title: String, lessons: Int, start: String?)
  case certificate(code: String)
  case suggestion(PlanSlotItem)
  case language
  case country

  var id: Self { self }

  var isSuggestion: Bool {
    if case .suggestion = self { true } else { false }
  }
}

extension View {
  func planSheets(
    _ sheet: Binding<PlanSheet?>, context: PlanContext, syllabus: GoalSyllabus?,
    slotAnswer: Binding<PlanSlotAnswer?>
  ) -> some View {
    modifier(
      PlanSheets(sheet: sheet, slotAnswer: slotAnswer, context: context, syllabus: syllabus))
  }
}

private struct PlanSheets: ViewModifier {
  @Environment(AppRouter.self) private var router
  @Environment(LearnerSummaryStore.self) private var learner
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
          case .mockSchedule(let id):
            MockScheduleSheet(planItemId: id, today: context.plan.today)
          case .path:
            PlanPathSheet(context: context)
          case .standing:
            NavigationStack {
              if context.goal.kind == .language,
                let language = store.languageStanding(goalId: context.goal.id).value
              {
                LanguageLevelSheet(
                  standing: language, assessment: context.plan.placementTest?.languageResult)
              } else {
                PlanStandingSheet(context: context, syllabus: syllabus)
              }
            }
            .presentationDetents([.medium, .large])
          case .schedule:
            NavigationStack {
              PlanScheduleSheet(context: context) {
                then = .adjust(.top)
                self.sheet = nil
              }
            }
            .presentationDetents([.medium, .large])
          case .farTopic(let skillId, let title, let lessons, let start):
            FarTopicSheet(
              goal: context.goal, skillId: skillId, title: title,
              line: planNotReadyLine(lessons: lessons, start: start, today: context.plan.today))
          case .certificate(let code):
            CertificateSheet(code: code)
          case .suggestion(let item):
            SuggestionSheet {
              PlanSuggestionSection(context: handingOff, answer: $slotAnswer, sheetItem: item)
            }
          case .language:
            if let variety = context.goal.variety {
              LanguageVarietySheet(variety: variety) { region in
                await learner.setTargetRegion(region, goalID: context.goal.id)
              }
            }
          case .country:
            if let country = context.goal.contentCountry {
              CountryPickerSheet(
                title: Text(
                  "Country", tableName: "Plan",
                  comment:
                    "Title of the sheet that picks a language goal's country, such as Argentina; the row that opens it says Language"
                ),
                language: context.goal.language,
                suggested: context.goal.suggestedCountries,
                selected: country.code,
                confirmsRebuild: true
              ) { choice in
                await learner.setContentCountry(choice.code, goalID: context.goal.id)
              }
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
        .zoonkSheet()
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
  @Environment(\.dismiss) private var dismiss
  @Environment(\.planSheetOpen) private var sheetOpen
  @State private var outline: PlanSheet?
  @State private var pendingRoute: AppRoute?

  let context: PlanContext

  var body: some View {
    var rows = context
    rows.show = { outline = $0 }

    return NavigationStack {
      ZoonkList {
        PlanPathRows(context: rows)
      }
      .navigationTitle(
        Text("Your path", tableName: "Plan", comment: "Title of the plan's phases")
      )
      .toolbarTitleDisplayMode(.inline)
      .sheetClose { dismiss() }
    }
    // The whole path at once; the grabber still says it closes with a swipe down.
    .presentationDetents([.large])
    .presentationDragIndicator(.visible)
    .sheet(item: $outline, onDismiss: openPendingRoute) { sheet in
      if case .mockSchedule(let id) = sheet {
        MockScheduleSheet(planItemId: id, today: context.plan.today).zoonkSheet()
      } else if case .farTopic(let skillId, let title, let lessons, let start) = sheet {
        FarTopicSheet(
          goal: context.goal, skillId: skillId, title: title,
          line: planNotReadyLine(lessons: lessons, start: start, today: context.plan.today)
        )
        .environment(
          \.planSheetOpen,
          PlanSheetOpen { route in
            pendingRoute = route
            outline = nil
          }
        )
        .zoonkSheet()
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
