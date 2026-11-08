package com.zoonk.android.feature.player

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.click
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performTouchInput
import androidx.compose.ui.test.swipeDown
import androidx.compose.ui.test.swipeUp
import androidx.lifecycle.SavedStateHandle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.DraftsChange
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.activities.code.CodeSandbox
import com.zoonk.android.feature.activities.code.LocalCodeSandbox
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.components.LocalPrivatePictures
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.runBlocking
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class LessonActivationTest {
    @get:Rule val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule val folder = TemporaryFolder()

    private val opening = """{"target":{"kind":"block","blockId":"00000000-0000-0000-0000-000000000001"}}"""
    private val lesson = playable(listOf(explanationStep("first"), explanationStep("next")))
    private val api = FakeLessonPlayerApi(LessonLoad.Ready(lesson))

    private fun show() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val session = FakeSession(AuthenticatedSession(ANA, "token-a", "local-a"))
        val cache = AppCache(session, scope)
        val drafts = DraftStore(folder.newFolder(), scope, io = Dispatchers.Main.immediate)
        runBlocking { drafts.follow { DraftsChange(ANA) } }
        val viewModel =
            LessonPlayerViewModel(
                lessonId = LESSON_ID,
                studySessionId = null,
                firstAnswer = null,
                opening = opening,
                tapped = false,
                store = LessonPlayerStore(api, cache),
                cache = cache,
                sessions = session,
                choices = TodayChoices(drafts),
                drafts = drafts,
                saved = SavedStateHandle(),
            )
        val exits =
            object : LessonPlayerExits {
                override fun close() = Unit

                override fun open(route: AppRoute) = Unit

                override fun replace(route: AppRoute) = Unit
            }
        rule.setContent {
            ZoonkTheme {
                CompositionLocalProvider(
                    LocalSnackbarHostState provides SnackbarHostState(),
                    LocalCodeSandbox provides CodeSandbox(openPage = { null }, scope = scope),
                    LocalPrivatePictures provides null,
                ) {
                    val state by viewModel.state.collectAsState()
                    val ending by viewModel.ending.collectAsState()
                    LaunchedEffect(Unit) { viewModel.open(lesson) }
                    val activation = Modifier.lessonActivation(viewModel::activate)
                    Box(activation.testTag("activation")) {
                        LessonPlayer(lesson, state, ending, viewModel, exits, rememberAppNavigator())
                    }
                }
            }
        }
        rule.waitForIdle()
    }

    @Test fun pullingDownFromTheTopBarDoesNotStartTheRun() {
        show()
        rule.onNodeWithTag("activation").performTouchInput { swipeDown(startY = 30f, endY = 300f) }
        rule.waitForIdle()
        org.junit.Assert.assertTrue("a drag must not start a run", api.startOpenings.isEmpty())
    }

    @Test fun draggingUpFromBelowNextDoesNotStartTheRun() {
        show()
        rule.onNodeWithTag("activation").performTouchInput { swipeUp(startY = bottom - 4f, endY = bottom - 120f) }
        rule.waitForIdle()
        org.junit.Assert.assertTrue("a drag must not start a run", api.startOpenings.isEmpty())
    }

    @Test fun aTapStartsTheRunOnce() {
        show()
        rule.onNodeWithTag("activation").performTouchInput {
            click(
                androidx.compose.ui.geometry
                    .Offset(200f, 30f),
            )
        }
        rule.waitForIdle()
        org.junit.Assert.assertEquals(1, api.startOpenings.size)
    }
}
