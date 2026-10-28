package com.zoonk.android.navigation

import androidx.compose.runtime.mutableStateOf
import androidx.navigation3.runtime.NavBackStack
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.AppContainer
import org.junit.Assert.assertEquals
import org.junit.Test

class AppRouteTest {
    @Test
    fun everyRouteHasAScreen() {
        val navigator =
            AppNavigator(
                stacks = AppTab.entries.associateWith { NavBackStack<NavKey>(it.root) },
                selected = mutableStateOf(AppTab.Today),
                tasks = NavBackStack(),
                openWebPage = {},
            )
        val entries = appEntries(AppContainer(), navigator)

        // Throws for a route no lane registered.
        routeSamples.filter { it.presentation != Presentation.Web }.forEach { route -> entries(route) }
    }

    @Test
    fun tabRootsAreTheirTabsRoutes() {
        AppTab.entries.forEach { tab -> assertEquals(Presentation.Tab(tab), tab.root.presentation) }
    }

    @Test
    fun studyPlacesArePagesOrSections() {
        StudyPlace.entries.forEach { place ->
            val presentation = place.route.presentation
            assert(presentation == Presentation.Push || presentation is Presentation.Section) { place }
        }
    }

    @Test
    fun drawerMarksAPlaceForItsPages() {
        assertEquals(StudyPlace.Exam, StudyPlace.entries.first { it.isShowing(AppRoute.MockChooser) })
        assertEquals(StudyPlace.Statistics, StudyPlace.entries.first { it.isShowing(AppRoute.StatsEnergy) })
        assertEquals(null, StudyPlace.entries.firstOrNull { it.isShowing(AppRoute.Chapter("chapter-1")) })
    }
}
