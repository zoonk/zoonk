package com.zoonk.android.navigation

import androidx.compose.runtime.mutableStateOf
import androidx.navigation3.runtime.NavBackStack
import androidx.navigation3.runtime.NavKey
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AppNavigatorTest {
    private val webPages = mutableListOf<AppRoute.WebPage>()
    private val navigator =
        AppNavigator(
            stacks = AppTab.entries.associateWith { NavBackStack<NavKey>(it.root) },
            selected = mutableStateOf(AppTab.Today),
            tasks = NavBackStack(),
            openWebPage = { webPages += it },
        )

    private fun stack(tab: AppTab) = navigator.stack(tab).toList()

    @Test
    fun pagesStackOnTheCurrentTabAndTabsKeepTheirStacks() {
        navigator.open(AppRoute.Mistakes)
        navigator.select(AppTab.Plan)
        navigator.open(AppRoute.Subject("biology"))
        navigator.open(AppRoute.Chapter("chapter-1"))
        navigator.select(AppTab.Today)

        assertEquals(listOf(AppRoute.Today, AppRoute.Mistakes), stack(AppTab.Today))
        assertEquals(listOf(AppRoute.Plan(), AppRoute.Subject("biology"), AppRoute.Chapter("chapter-1")), stack(AppTab.Plan))
        assertEquals(AppRoute.Mistakes, navigator.currentRoute)
    }

    @Test
    fun reselectingATabPopsItToItsRoot() {
        navigator.open(AppRoute.Exam)
        navigator.open(AppRoute.MockChooser)
        navigator.select(AppTab.Today)

        assertEquals(listOf(AppRoute.Today), stack(AppTab.Today))
    }

    @Test
    fun anOpenRouteIsGoneBackToNotStackedAgain() {
        navigator.open(AppRoute.Chapter("chapter-1"))
        navigator.open(AppRoute.Subject("biology"))
        navigator.open(AppRoute.Chapter("chapter-1"))
        navigator.open(AppRoute.Chapter("chapter-1"))

        assertEquals(listOf(AppRoute.Today, AppRoute.Chapter("chapter-1")), stack(AppTab.Today))
    }

    @Test
    fun backPopsTasksThenPagesThenGoesHomeThenLeaves() {
        navigator.select(AppTab.Plan)
        navigator.open(AppRoute.Subject("biology"))
        navigator.open(AppRoute.Session())
        navigator.open(AppRoute.Lesson("lesson-1"))

        assertTrue(navigator.back())
        assertEquals(AppRoute.Session(), navigator.currentRoute)
        assertTrue(navigator.back())
        assertEquals(AppRoute.Subject("biology"), navigator.currentRoute)
        assertTrue(navigator.back())
        assertEquals(AppRoute.Plan(), navigator.currentRoute)
        assertTrue(navigator.back())
        assertEquals(AppTab.Today, navigator.selectedTab)
        assertFalse(navigator.back())
    }

    @Test
    fun tasksCoverThePageAndOpeningAPageClosesThem() {
        navigator.open(AppRoute.Chapter("chapter-1"))
        navigator.open(AppRoute.Lesson("lesson-1"))

        assertTrue(navigator.isTaskOpen)
        assertEquals(AppRoute.Lesson("lesson-1"), navigator.currentRoute)

        // A lesson's "See the plan" lands on the stack with the lesson closed.
        navigator.open(AppRoute.Subject("biology"))

        assertFalse(navigator.isTaskOpen)
        assertEquals(listOf(AppRoute.Today, AppRoute.Chapter("chapter-1"), AppRoute.Subject("biology")), stack(AppTab.Today))
    }

    @Test
    fun openOverPutsTheTaskBeneathUnderIt() {
        navigator.openOver(AppRoute.Lesson("lesson-1"), beneath = AppRoute.Session(blockId = "block-1"))

        assertEquals(listOf(AppRoute.Session(blockId = "block-1"), AppRoute.Lesson("lesson-1")), navigator.tasks.toList())

        navigator.closeTask()
        assertEquals(AppRoute.Session(blockId = "block-1"), navigator.currentRoute)
    }

    @Test
    fun sectionsCloseAsAWholeToWhereTheyOpened() {
        navigator.select(AppTab.Plan)
        navigator.open(AppRoute.Chapter("chapter-1"))
        navigator.open(AppRoute.Settings)
        navigator.open(AppRoute.Profile)
        navigator.open(AppRoute.Memory)

        navigator.back()
        assertEquals(AppRoute.Profile, navigator.currentRoute)

        navigator.closeSection()
        assertEquals(listOf(AppRoute.Plan(), AppRoute.Chapter("chapter-1")), stack(AppTab.Plan))
    }

    @Test
    fun aSectionOpenedFromAnotherClosesBackToIt() {
        navigator.open(AppRoute.Settings)
        navigator.open(AppRoute.Subscription)
        navigator.open(AppRoute.Statistics)
        navigator.open(AppRoute.StatsLevel)
        navigator.closeSection()

        assertEquals(listOf(AppRoute.Today, AppRoute.Settings, AppRoute.Subscription), stack(AppTab.Today))

        navigator.closeSection()
        assertEquals(listOf(AppRoute.Today), stack(AppTab.Today))

        navigator.closeSection()
        assertEquals(listOf(AppRoute.Today), stack(AppTab.Today))
    }

    @Test
    fun openingATabRouteShowsItsRootWithItsParameters() {
        navigator.select(AppTab.Buddy)
        navigator.open(AppRoute.EarlierQuestions)
        navigator.select(AppTab.Today)
        navigator.open(AppRoute.Lesson("lesson-1"))
        navigator.open(AppRoute.Buddy(ask = "Why?"))

        assertFalse(navigator.isTaskOpen)
        assertEquals(AppTab.Buddy, navigator.selectedTab)
        assertEquals(listOf(AppRoute.Buddy(ask = "Why?")), stack(AppTab.Buddy))

        navigator.showRoot(AppTab.Buddy)
        assertEquals(listOf(AppRoute.Buddy()), stack(AppTab.Buddy))
    }

    @Test
    fun linksOpenPagesOnAFreshStackOfTheirTab() {
        navigator.select(AppTab.Plan)
        navigator.open(AppRoute.Subject("biology"))
        navigator.select(AppTab.Buddy)
        navigator.openLink(AppRoute.Chapter("chapter-1"))

        assertEquals(AppTab.Plan, navigator.selectedTab)
        assertEquals(listOf(AppRoute.Plan(), AppRoute.Chapter("chapter-1")), stack(AppTab.Plan))

        navigator.openLink(AppRoute.Settings)
        assertEquals(AppTab.Today, navigator.selectedTab)
        assertEquals(listOf(AppRoute.Today, AppRoute.Settings), stack(AppTab.Today))
    }

    @Test
    fun linksOpenTasksOverWhereTheLearnerIs() {
        navigator.select(AppTab.Plan)
        navigator.open(AppRoute.Subject("biology"))
        navigator.openLink(AppRoute.PlanLink("plan-1"))

        assertEquals(AppRoute.PlanLink("plan-1"), navigator.currentRoute)

        navigator.back()
        assertEquals(AppRoute.Subject("biology"), navigator.currentRoute)
    }

    @Test
    fun webPagesOpenOutsideTheStacks() {
        navigator.open(AppRoute.Privacy)

        assertEquals(listOf(AppRoute.Privacy), webPages)
        assertEquals(listOf(AppRoute.Today), stack(AppTab.Today))
    }

    @Test
    fun popToRootsDropsEveryPageAndTask() {
        navigator.open(AppRoute.Mistakes)
        navigator.select(AppTab.Plan)
        navigator.open(AppRoute.Exam)
        navigator.open(AppRoute.Mock("block-1"))
        navigator.popToRoots()

        assertFalse(navigator.isTaskOpen)
        AppTab.entries.forEach { tab -> assertEquals(listOf(tab.root), stack(tab)) }
        assertEquals(AppTab.Plan, navigator.selectedTab)
    }

    @Test
    fun onlyATabSwitchSkipsTheTransition() {
        navigator.select(AppTab.Plan)
        assertTrue(navigator.isSwitchingTabs)

        navigator.open(AppRoute.Exam)
        assertFalse(navigator.isSwitchingTabs)

        navigator.select(AppTab.Plan)
        assertTrue(navigator.isSwitchingTabs)

        navigator.back()
        assertFalse(navigator.isSwitchingTabs)
    }
}
