package com.zoonk.android.navigation

import androidx.annotation.StringRes
import com.zoonk.android.R

enum class AppTab(
    val root: AppRoute,
    @param:StringRes val label: Int,
    val icon: PlaceIcon,
) {
    Today(AppRoute.Today, R.string.navigation_today, PlaceIcon.Today),
    Plan(AppRoute.Plan(), R.string.navigation_plan, PlaceIcon.Plan),
    Buddy(AppRoute.Buddy(), R.string.navigation_buddy, PlaceIcon.Buddy),
}

/** Only the drawer lists them; narrower windows reach them from the pages that lead to them, as main does under `lg`. */
enum class StudyPlace(
    val route: AppRoute,
    @param:StringRes val label: Int,
    val icon: PlaceIcon,
) {
    Mistakes(AppRoute.Mistakes, R.string.navigation_mistakes, PlaceIcon.Mistakes),
    Exam(AppRoute.Exam, R.string.navigation_exam, PlaceIcon.Exam),
    Speaking(AppRoute.Speaking(), R.string.navigation_speaking, PlaceIcon.Speaking),
    MindMaps(AppRoute.MindMaps(), R.string.navigation_mind_maps, PlaceIcon.MindMaps),
    Statistics(AppRoute.Statistics, R.string.navigation_statistics, PlaceIcon.Statistics),
    ;

    fun isShowing(route: AppRoute): Boolean =
        when (this) {
            Exam -> route == AppRoute.Exam || route == AppRoute.MockChooser
            Statistics -> route.section == AppSection.Statistics
            Speaking -> route is AppRoute.Speaking
            MindMaps -> route is AppRoute.MindMaps
            else -> route == this.route
        }
}
