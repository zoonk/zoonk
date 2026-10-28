import SwiftUI

/// The learner's statistics, opened from the level button or the sidebar's Study places.
struct StatisticsScreen: View {
  @Environment(AppRouter.self) private var router

  var body: some View {
    ProgressOverviewView {
      router.present(.account)
    }
    .navigationTitle(Text(AppTab.statistics.title))
  }
}
