package com.zoonk.android.feature.session

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.StudyBlock
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID

@RunWith(AndroidJUnit4::class)
class NextStopTest {
    @get:Rule
    val rule = createComposeRule()

    private val ana = AuthenticatedSession("ana", "token-a", "local-a")
    private val api = FakeStudyApi()
    private val waits = mutableListOf<Long>()

    @Test
    fun aLessonWrittenWhileTheLearnerWaitedIsOfferedNotOpened() {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        val cache = AppCache(FakeSession(ana), scope)
        val viewModel =
            SessionViewModel(
                StudyOpener(api, api::writeLesson, cache, { "UTC" }, scope),
                StudySessionStore(api, cache) { "UTC" },
                { _, milliseconds -> waits += milliseconds },
                cache,
            )
        val waiting = step(0, screen = StudyBlock.Screen.LESSON, lessonId = null)
        var shown by mutableStateOf(waiting)

        rule.setContent {
            ZoonkTheme {
                NextStop(
                    viewModel = viewModel,
                    day = day(steps = listOf(shown)),
                    step = shown,
                    goalId = GOAL,
                    notWritten = null,
                    alternative = null,
                    refresh = { shown = waiting.copy(lessonId = UUID.fromString("5f0c1f7e-0d3a-4c55-9d1e-6f1b0a3c2f00")) },
                    onStop = null,
                    navigator = rememberAppNavigator(),
                )
            }
        }
        rule.mainClock.advanceTimeBy(6_000)
        rule.waitForIdle()

        assertEquals(emptyList<UUID>(), api.started)
        assertEquals(0, api.opened.size)
        rule.onNodeWithText("Your lesson is ready.").assertExists()
        assertEquals(1, waits.size)
    }
}
