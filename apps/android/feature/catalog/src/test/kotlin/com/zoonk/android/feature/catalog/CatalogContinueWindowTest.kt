package com.zoonk.android.feature.catalog

import android.content.pm.ActivityInfo
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.SnackbarHost
import androidx.compose.ui.test.hasScrollToIndexAction
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToIndex
import androidx.lifecycle.ViewModelStore
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.rememberWindowSnackbars
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.summary
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.LearnerSummaryGoal
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class CatalogContinueWindowTest {
    @get:Rule val rule = createEmptyComposeRule()

    @Test fun courseResizeSuccess() = exercise(Page.Course, resize = true, saved = true)

    @Test fun courseResizeFailure() = exercise(Page.Course, resize = true, saved = false)

    @Test fun chapterResizeSuccess() = exercise(Page.Chapter, resize = true, saved = true)

    @Test fun chapterResizeFailure() = exercise(Page.Chapter, resize = true, saved = false)

    @Test fun lessonResizeSuccess() = exercise(Page.Lesson, resize = true, closing = true, saved = true)

    @Test fun lessonResizeFailure() = exercise(Page.Lesson, resize = true, closing = true, saved = false)

    @Test fun courseHeroScrollSuccess() = exercise(Page.Course, saved = true)

    @Test fun courseHeroScrollFailure() = exercise(Page.Course, saved = false)

    @Test fun courseClosingScrollSuccess() = exercise(Page.Course, closing = true, saved = true)

    @Test fun courseClosingScrollFailure() = exercise(Page.Course, closing = true, saved = false)

    @Test fun chapterHeroScrollSuccess() = exercise(Page.Chapter, saved = true)

    @Test fun chapterHeroScrollFailure() = exercise(Page.Chapter, saved = false)

    @Test fun chapterClosingScrollSuccess() = exercise(Page.Chapter, closing = true, saved = true)

    @Test fun chapterClosingScrollFailure() = exercise(Page.Chapter, closing = true, saved = false)

    @Test
    @Config(qualifiers = "w411dp-h400dp")
    fun lessonPlanScrollSuccess() = exercise(Page.Lesson, closing = true, saved = true)

    @Test
    @Config(qualifiers = "w411dp-h400dp")
    fun lessonPlanScrollFailure() = exercise(Page.Lesson, closing = true, saved = false)

    private fun exercise(
        page: Page,
        resize: Boolean = false,
        closing: Boolean = false,
        saved: Boolean,
    ) {
        val application = RuntimeEnvironment.getApplication()
        shadowOf(application.packageManager).addOrUpdateActivity(
            ActivityInfo().apply {
                name = CatalogContinueActivity::class.java.name
                packageName = application.packageName
            },
        )
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val gate = CompletableDeferred<Boolean>()
        var requests = 0
        CatalogContinueWindow.app = AppContainer.preview(application)
        CatalogContinueWindow.catalog = CatalogStore(FakeCatalogApi(), AppCache(FakeSession(null), scope))
        CatalogContinueWindow.page = page
        val goal =
            ApiJson.decodeFromString<LearnerSummaryGoal>(
                """{"courseChapterId":null,"courseId":"$COURSE","courseLevel":null,"dailyMinutes":20,
            "id":"77777777-7777-4777-8777-777777777777","isActive":false,"isSettingUp":false,"kind":"learn","language":"en","status":"active",
            "targetDate":null,"targetDateEstimated":false,"targetLanguage":null,"targetRegion":null,"regionChoices":[],"contentCountry":null,
            "countryDependent":false,"examCountry":null,"examplesCountry":null,"languageCountry":{"code":"US","name":"United States"},
            "suggested":[],"title":"Atoms","displayName":"Atoms"}""",
            )
        CatalogContinueWindow.app.learnerSummary.summary
            .replace(summary(0, Long.MAX_VALUE).copy(goals = listOf(goal)))
        val scenario = ActivityScenario.launch(CatalogContinueActivity::class.java)
        try {
            scenario.onActivity { it.compose() }
            rule.waitForIdle()
            if (closing) rule.onNode(hasScrollToIndexAction()).performScrollToIndex(if (page == Page.Lesson) 1 else 5)
            rule.waitForIdle()
            // Replace only the network capability, retaining the production composition's actual model keys.
            scenario.onActivity { activity ->
                val store: ViewModelStore = activity.viewModelStore
                val keys = store.keys().filter { store[it] is SwitchThenToday }
                assertTrue(keys.isNotEmpty())
                keys.forEach {
                    store.put(
                        it,
                        SwitchThenToday(scope) {
                            requests++
                            gate.await()
                        },
                    )
                }
            }
            rule.waitForIdle()
            scenario.recreate()
            scenario.onActivity { it.compose() }
            rule.waitForIdle()
            if (closing) rule.onNode(hasScrollToIndexAction()).performScrollToIndex(if (page == Page.Lesson) 1 else 5)
            rule.onAllNodesWithText("Continue your plan")[0].performScrollTo().performClick()
            rule.waitForIdle()
            assertEquals(1, requests)
            if (resize) {
                for (size in listOf("w1280dp-h900dp", "w411dp-h891dp", "w1280dp-h900dp")) {
                    RuntimeEnvironment.setQualifiers(size)
                    scenario.recreate()
                    scenario.onActivity { it.compose() }
                    rule.waitForIdle()
                }
            } else {
                rule.onNode(hasScrollToIndexAction()).performScrollToIndex(if (closing) 0 else 4)
                rule.waitForIdle()
            }
            gate.complete(saved)
            rule.waitForIdle()
            if (saved) {
                assertEquals(AppRoute.Today, CatalogContinueWindow.navigator.currentRoute)
            } else {
                rule.onNodeWithText(application.getString(com.zoonk.android.R.string.goal_switcher_failed)).assertExists()
            }
            if (resize) {
                RuntimeEnvironment.setQualifiers("w411dp-h891dp")
                scenario.recreate()
                scenario.onActivity { it.compose() }
                rule.waitForIdle()
                if (saved) assertEquals(AppRoute.Today, CatalogContinueWindow.navigator.currentRoute)
            }
        } finally {
            scenario.close()
            scope.cancel()
        }
    }
}

internal enum class Page { Course, Chapter, Lesson }

internal object CatalogContinueWindow {
    lateinit var app: AppContainer
    lateinit var catalog: CatalogStore
    lateinit var navigator: AppNavigator
    var page = Page.Course
}

class CatalogContinueActivity : ComponentActivity() {
    fun compose() {
        setContent {
            ZoonkTheme {
                val app = CatalogContinueWindow.app
                val navigator = rememberAppNavigator()
                CatalogContinueWindow.navigator = navigator
                val opened =
                    androidx.compose.runtime.saveable
                        .rememberSaveable { androidx.compose.runtime.mutableStateOf(false) }
                androidx.compose.runtime.LaunchedEffect(Unit) {
                    if (!opened.value) {
                        navigator.open(AppRoute.CatalogCourse(COURSE))
                        opened.value = true
                    }
                }
                Column {
                    SnackbarHost(rememberWindowSnackbars(app))
                    when (CatalogContinueWindow.page) {
                        Page.Course -> {
                            CourseScreen(AppRoute.CatalogCourse(COURSE), app, navigator, CatalogContinueWindow.catalog)
                        }

                        Page.Chapter -> {
                            ChapterScreen(
                                AppRoute.CatalogChapter(CHAPTER_ONE, COURSE),
                                app,
                                navigator,
                                CatalogContinueWindow.catalog,
                            )
                        }

                        Page.Lesson -> {
                            LessonScreen(
                                AppRoute.CatalogLesson(LESSON_TWO, CHAPTER_ONE, COURSE),
                                app,
                                navigator,
                                CatalogContinueWindow.catalog,
                            )
                        }
                    }
                }
            }
        }
    }
}
