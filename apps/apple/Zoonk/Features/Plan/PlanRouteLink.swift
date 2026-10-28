import SwiftUI

extension EnvironmentValues {
  /// A row in a sheet closes it first: a task can't cover the app while a sheet is up, and a push
  /// belongs on the tab's stack.
  @Entry var planSheetOpen: PlanSheetOpen?
}

/// Each sheet sets one for as long as it's up, so two compare equal and don't redraw the rows.
struct PlanSheetOpen: Equatable {
  let open: (AppRoute) -> Void

  static func == (lhs: Self, rhs: Self) -> Bool { true }
}

struct PlanRouteLink<Label: View>: View {
  @Environment(AppRouter.self) private var router
  @Environment(\.planSheetOpen) private var sheetOpen

  let route: AppRoute
  @ViewBuilder let label: Label

  var body: some View {
    if let sheetOpen {
      Button {
        sheetOpen.open(route)
      } label: {
        label
      }
      .foregroundStyle(.primary)
    } else if route.presentation == .push {
      NavigationLink(value: route) {
        label
      }
    } else {
      Button {
        router.open(route)
      } label: {
        label
      }
      .foregroundStyle(.primary)
    }
  }
}
