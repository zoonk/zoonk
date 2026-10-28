import SwiftUI

extension EnvironmentValues {
  /// Set inside one of the Plan's sheets: a row there closes the sheet, then opens its route, since
  /// a task can't cover the app while a sheet is up and a push belongs on the tab's stack.
  @Entry var planSheetOpen: PlanSheetOpen?
}

/// How a row inside a sheet opens its route. Each sheet sets one for as long as it's up, so two
/// compare equal and don't redraw the rows.
struct PlanSheetOpen: Equatable {
  let open: (AppRoute) -> Void

  static func == (lhs: Self, rhs: Self) -> Bool { true }
}

/// A row that opens a route: a push as a `NavigationLink`, a task through the router, and from
/// inside a sheet through `planSheetOpen`.
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
