package com.zoonk.android.feature.search

import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.R
import com.zoonk.android.app.AppContainer
import com.zoonk.android.app.rememberWindowSnackbars
import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSessionApi
import com.zoonk.android.data.LearningProfileApi
import com.zoonk.android.data.SignInResult
import com.zoonk.android.feature.plan.learnerSummary
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.LearningProfile
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.cancel
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.util.ReflectionHelpers
import java.util.UUID

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class SearchSwitchWindowTest {
    @get:Rule
    val rule = createEmptyComposeRule()

    @Test
    fun aFailedSwitchFromSearchOverAPageShowsItsFailure() {
        val app = signedInApp()
        var saves = 0
        // A refused save is an external API failure, with the real switch and visit ownership intact.
        ReflectionHelpers.setField(
            app.learningProfile,
            "api",
            object : LearningProfileApi {
                override suspend fun profile(session: AuthenticatedSession): LearningProfile = error("Unused")

                override suspend fun update(
                    session: AuthenticatedSession,
                    change: JsonObject,
                ): LearningProfile {
                    saves++
                    throw ApiException(ApiError.Network)
                }
            },
        )
        addOtherGoal(app)
        SearchSwitchWindow.app = app
        SearchSwitchWindow.switching = null
        val scenario = launch()
        try {
            scenario.onActivity { it.compose() }
            rule.runOnIdle { SearchSwitchWindow.navigator.open(AppRoute.Catalog()) }
            rule.onNodeWithContentDescription("Search or ask").performClick()
            rule.onNodeWithText("Switch to Learn French").assertExists()
            rule.onNodeWithText("Switch to Learn French").performClick()
            rule.waitForIdle()
            assertEquals(1, saves)
            rule.onNodeWithText(failure()).assertExists()
        } finally {
            scenario.close()
            app.scope.cancel()
        }
    }

    @Test
    fun aSuccessfulSwitchKeepsThePageAfterRecreation() = pending(saved = true, leave = false)

    @Test
    fun aFailedSwitchShowsItsFailureOnceAfterRecreation() = pending(saved = false, leave = false)

    @Test
    fun aSuccessfulSwitchAfterLeavingSearchOpensNothingOnReturn() = pending(saved = true, leave = true)

    @Test
    fun aFailedSwitchAfterLeavingSearchSaysNothingOnReturn() = pending(saved = false, leave = true)

    @Test
    fun aSwitchSavedAfterOpeningALessonLeavesTheLessonOpen() = pending(saved = true, leave = false, lesson = true)

    private fun pending(
        saved: Boolean,
        leave: Boolean,
        lesson: Boolean = false,
    ) {
        val app = signedInApp()
        val other = addOtherGoal(app)
        val gate = CompletableDeferred<Boolean>()
        val asked = mutableListOf<UUID>()
        val switching =
            SearchGoalSwitch(app.scope) {
                asked += it
                gate.await()
            }
        SearchSwitchWindow.app = app
        SearchSwitchWindow.switching = switching
        SearchSwitchWindow.visible = true
        val scenario = launch()
        try {
            scenario.onActivity { it.compose() }
            rule.runOnIdle { SearchSwitchWindow.navigator.open(AppRoute.Catalog()) }
            rule.onNodeWithContentDescription("Search or ask").performClick()
            rule.onNodeWithText("Switch to Learn French").performClick()
            rule.waitForIdle()
            assertEquals(listOf(other), asked)
            val visit = switching.visit.number
            if (leave) {
                SearchSwitchWindow.visible = false
                rule.waitForIdle()
            } else if (lesson) {
                rule.runOnIdle { SearchSwitchWindow.navigator.open(AppRoute.Lesson("lesson-1")) }
                rule.waitForIdle()
            } else {
                RuntimeEnvironment.setQualifiers("w1280dp-h900dp")
                scenario.recreate()
            }
            gate.complete(saved)
            shadowOf(android.os.Looper.getMainLooper()).idle()
            if (leave) {
                assertNull(switching.failed.value)
                SearchSwitchWindow.visible = true
            } else if (!lesson) {
                assertEquals(visit, switching.visit.number)
                assertEquals(if (saved) null else Unit, switching.failed.value)
                scenario.onActivity { it.compose() }
            }
            rule.waitForIdle()
            assertEquals(if (lesson) AppRoute.Lesson("lesson-1") else AppRoute.Catalog(), SearchSwitchWindow.navigator.currentRoute)
            assertNull(switching.failed.value)
            if (!saved && !leave) rule.onNodeWithText(failure()).assertExists() else rule.onNodeWithText(failure()).assertDoesNotExist()
            rule.runOnIdle { SearchSwitchWindow.navigator.open(AppRoute.Catalog()) }
            RuntimeEnvironment.setQualifiers("w411dp-h891dp")
            scenario.recreate()
            scenario.onActivity { it.compose() }
            rule.waitForIdle()
            assertEquals(AppRoute.Catalog(), SearchSwitchWindow.navigator.currentRoute)
            assertEquals(listOf(other), asked)
            assertNull(switching.failed.value)
        } finally {
            scenario.close()
            app.scope.cancel()
        }
    }

    private fun signedInApp(): AppContainer {
        val app = AppContainer.preview(RuntimeEnvironment.getApplication())
        // The container wires live APIs; replace only the external boundary to avoid network calls.
        val sessionApi = FakeSessionApi().apply { accounts += "token" to ANA }
        ReflectionHelpers.setField(app.sessions, "api", sessionApi)
        assertEquals(SignInResult.SignedIn, runBlocking { app.sessions.signIn { "token" } })
        return app
    }

    private fun addOtherGoal(app: AppContainer): UUID {
        val summary = learnerSummary().copy(nextChangeAt = Long.MAX_VALUE)
        val other = summary.goals.single().copy(id = UUID.randomUUID(), displayName = "Learn French", isActive = false)
        app.learnerSummary.summary.replace(summary.copy(goals = summary.goals + other))
        return other.id
    }

    private fun launch(): ActivityScenario<SearchSwitchTestActivity> {
        val application = RuntimeEnvironment.getApplication()
        shadowOf(application.packageManager).addOrUpdateActivity(
            ActivityInfo().apply {
                name = SearchSwitchTestActivity::class.java.name
                packageName = application.packageName
            },
        )
        return ActivityScenario.launch(SearchSwitchTestActivity::class.java)
    }

    private fun failure() = RuntimeEnvironment.getApplication().getString(R.string.goal_switcher_failed)
}

internal object SearchSwitchWindow {
    lateinit var app: AppContainer
    lateinit var navigator: AppNavigator
    var switching: SearchGoalSwitch? = null
    var visible by mutableStateOf(true)
}

class SearchSwitchTestActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (savedInstanceState == null) SearchSwitchWindow.switching?.let { viewModelStore.put("search-goal-switch", it) }
    }

    fun compose() {
        setContent {
            ZoonkTheme {
                val app = SearchSwitchWindow.app
                val navigator = rememberAppNavigator()
                SearchSwitchWindow.navigator = navigator
                val snackbars = rememberWindowSnackbars(app)
                Column {
                    if (SearchSwitchWindow.visible) SearchHost(app, navigator, signedIn = true) { SearchAction() }
                    snackbars.currentSnackbarData?.let { Text(it.visuals.message) }
                }
            }
        }
    }
}
