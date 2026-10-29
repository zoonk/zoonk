package com.zoonk.android.feature.player

import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import com.zoonk.android.app.LocalSnackbarHostState
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.DraftsChange
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.player.engine.LessonRun
import com.zoonk.android.feature.player.model.LessonLoad
import com.zoonk.android.feature.player.model.LessonStep
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.runBlocking
import java.io.File

/** Plays a lesson in the real player against [FakeLessonPlayerApi], recording where it leads. */
internal class LessonPlayerHarness(
    private val rule: ComposeContentTestRule,
    private val newFolder: () -> File,
) {
    private val ana = AuthenticatedSession(ANA, "token-a", "local-a")
    val session = FakeSession(ana)
    val opened = mutableListOf<AppRoute>()
    val replaced = mutableListOf<AppRoute>()
    var closed = 0
    lateinit var api: FakeLessonPlayerApi
    lateinit var openAgain: () -> LessonPlayerViewModel
    lateinit var viewModel: LessonPlayerViewModel

    val exits =
        object : LessonPlayerExits {
            override fun close() {
                closed++
            }

            override fun open(route: AppRoute) {
                opened += route
            }

            override fun replace(route: AppRoute) {
                replaced += route
            }
        }

    fun play(
        steps: List<LessonStep>,
        guest: Boolean = false,
        ceremony: LessonCeremony? = null,
        sessionId: String? = null,
        sessionSteps: SessionSteps? = null,
        configure: FakeLessonPlayerApi.() -> Unit = {},
    ) {
        val lesson = playable(steps)
        api = FakeLessonPlayerApi(LessonLoad.Ready(lesson)).apply(configure)
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val cache = AppCache(session, scope)
        val drafts = DraftStore(newFolder(), scope, io = Dispatchers.Main.immediate)
        runBlocking { drafts.follow { DraftsChange(ana.accountId) } }
        val newViewModel = {
            LessonPlayerViewModel(
                lessonId = LESSON_ID,
                studySessionId = sessionId,
                firstAnswer = null,
                store = LessonPlayerStore(api, cache),
                cache = cache,
                sessions = session,
                choices = TodayChoices(drafts),
                drafts = drafts,
                sessionSteps = sessionSteps,
                isGuest = { guest },
                activeGoalId = { GOAL_ID },
            )
        }
        viewModel = newViewModel()
        openAgain = { newViewModel().also { it.open(lesson) } }

        rule.setContent {
            ZoonkTheme {
                CompositionLocalProvider(LocalSnackbarHostState provides SnackbarHostState()) {
                    val state by viewModel.state.collectAsState()
                    val ending by viewModel.ending.collectAsState()
                    LaunchedEffect(Unit) { viewModel.open(lesson) }
                    LessonPlayer(lesson, state, ending, viewModel, exits, rememberAppNavigator(), ceremony = ceremony)
                }
            }
        }
        rule.waitUntil {
            viewModel.state.value
                ?.run
                .let { it is LessonRun.Started || it is LessonRun.Refused }
        }
    }

    fun tap(text: String) = rule.onNodeWithText(text).performClick()
}

private const val GOAL_ID = "00000000-0000-4000-8000-000000000011"
