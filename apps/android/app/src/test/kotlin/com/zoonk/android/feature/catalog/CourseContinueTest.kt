package com.zoonk.android.feature.catalog

import androidx.compose.runtime.mutableStateOf
import androidx.navigation3.runtime.NavBackStack
import androidx.navigation3.runtime.NavKey
import com.zoonk.android.app.shell.GoalSwitch
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.UUID

@OptIn(ExperimentalCoroutinesApi::class)
class CourseContinueTest {
    private val saves = mutableListOf<CompletableDeferred<Boolean>>()
    private val goals = GoalSwitch { CompletableDeferred<Boolean>().also { saves += it }.await() }
    private var failures = 0
    private val navigator =
        AppNavigator(
            stacks = AppTab.entries.associateWith { NavBackStack<NavKey>(it.root) },
            selected = mutableStateOf(AppTab.Plan),
            tasks = NavBackStack(),
            openWebPage = {},
        ).apply {
            open(AppRoute.Catalog())
            open(COURSE)
        }

    private fun TestScope.tap() {
        backgroundScope.switchThenOpenToday(navigator, onFailed = { failures++ }) { goals.select(GOAL, emptyList()) { true } }
        runCurrent()
    }

    @Test
    fun aSecondTapWaitsForTheGoalToSave() =
        runTest {
            tap()
            tap()

            assertEquals(COURSE, navigator.currentRoute)
            saves.single().complete(true)
            runCurrent()
            assertEquals(AppRoute.Today, navigator.currentRoute)
        }

    @Test
    fun aSwitchThatSavesAfterTheLearnerWentBackOpensNothing() =
        runTest {
            tap()
            navigator.back()

            saves.single().complete(true)
            runCurrent()

            assertEquals(AppRoute.Catalog(), navigator.currentRoute)
        }

    @Test
    fun aTapOnAnotherPageWhileTheSwitchSavesDoesntOpenTodayEarly() =
        runTest {
            tap()
            navigator.open(CHAPTER)
            tap()

            assertEquals(CHAPTER, navigator.currentRoute)
        }

    @Test
    fun aSwitchThatCouldntSaveSaysSo() =
        runTest {
            tap()
            saves.single().complete(false)
            runCurrent()

            assertEquals(1, failures)
            assertEquals(COURSE, navigator.currentRoute)
        }

    private companion object {
        val GOAL: UUID = UUID.fromString("7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d")
        val COURSE = AppRoute.CatalogCourse("11111111-1111-4111-8111-111111111111")
        val CHAPTER = AppRoute.CatalogChapter("22222222-2222-4222-8222-222222222201", COURSE.courseId)
    }
}
