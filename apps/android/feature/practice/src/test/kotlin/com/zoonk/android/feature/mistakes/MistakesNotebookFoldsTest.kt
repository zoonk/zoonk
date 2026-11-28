package com.zoonk.android.feature.mistakes

import androidx.activity.ComponentActivity
import androidx.compose.material3.Surface
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.GoalMistakePattern
import com.zoonk.api.models.MistakeList
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.withContext
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.io.IOException
import java.util.UUID

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp-xxhdpi")
class MistakesNotebookFoldsTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val goalId = UUID.fromString("00000000-0000-4000-8000-0000000000a1")

    private val requestedLessons = mutableListOf<UUID>()
    private val openedLesson = CompletableDeferred<UUID>()

    @After fun stopScope() = scope.cancel()

    private fun mistake(
        id: Int,
        skill: Int,
        question: String,
    ): String {
        val lesson = if (id == 1) "null" else """{"id":"00000000-0000-4000-8000-0000000000c$id","title":"Lesson"}"""
        return """{"cause":"trap","createdAt":"2026-10-2${id}T12:00:00Z","fixedAt":null,"id":"00000000-0000-4000-8000-00000000000$id",
        "itemId":null,"lesson":$lesson,"practiceAvailable":true,
        "skill":{"id":"00000000-0000-4000-8000-0000000000b$skill","name":"Skill $skill"},
        "snapshot":{"answer":"R$55","correctAnswer":"R$60","question":"$question"},"status":"open"}"""
    }

    private var page: MistakeList =
        ApiJson.decodeFromString(
            MistakeList.serializer(),
            """{"availability":{"ready":3},"counts":{"byCause":{"gap":0,"guess":0,"misread":0,"time":0,"trap":3,"unsorted":0},
            "fixed":0,"open":3},"data":[${mistake(1, 1, "First question")},${mistake(2, 1, "Second question")},
            ${mistake(3, 2, "Third question")}],"pagination":{"hasMore":false,"nextCursor":null},"trueFalseLabels":"trueFalse"}""",
        )

    private val api =
        object : NotebookApi {
            override suspend fun page(
                session: AuthenticatedSession,
                key: NotebookKey,
                cursor: String?,
                timeZone: String,
            ) = page

            override suspend fun openLesson(
                session: AuthenticatedSession,
                mistakeId: UUID,
            ): UUID {
                requestedLessons += mistakeId
                return withContext(NonCancellable) { openedLesson.await() }
            }

            override suspend fun pattern(
                session: AuthenticatedSession,
                goalId: UUID,
            ): GoalMistakePattern = ApiJson.decodeFromString(GoalMistakePattern.serializer(), """{"pattern":null}""")
        }

    @Test
    fun aLateLessonCannotReplaceTheLessonOpenedAfterIt() {
        val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
        val unlinked = page.`data`.first()
        val direct = requireNotNull(page.`data`[1].lesson)
        val store = MistakesNotebookStore(api, AppCache(session, scope), session) { "UTC" }
        lateinit var navigator: AppNavigator
        compose.setContent {
            ZoonkTheme {
                navigator = rememberAppNavigator()
                Surface { Notebook(goalId, store, navigator) }
            }
        }
        compose.waitForIdle()
        assertEquals(emptyList<UUID>(), requestedLessons)

        val buttons = compose.onAllNodesWithText("Open the lesson")
        buttons[0].performScrollTo().performClick()
        compose.waitForIdle()
        buttons[1].performScrollTo().performClick()
        compose.waitForIdle()
        openedLesson.complete(UUID.randomUUID())
        compose.waitForIdle()

        assertEquals(listOf(unlinked.id), requestedLessons)
        assertEquals(AppRoute.Lesson(direct.id.toString()), navigator.currentRoute)
    }

    @Test
    fun openingAnotherQuestionKeepsTheFirstQuestionsFailure() {
        page = page.copy(`data` = page.`data`.map { it.copy(lesson = null) })
        openedLesson.completeExceptionally(IOException("Offline"))
        val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
        val store = MistakesNotebookStore(api, AppCache(session, scope), session) { "UTC" }
        compose.setContent { ZoonkTheme { Surface { Notebook(goalId, store, rememberAppNavigator()) } } }
        compose.waitForIdle()

        val buttons = compose.onAllNodesWithText("Open the lesson")
        val failures = compose.onAllNodesWithText("We couldn't open this step. Try again.")
        buttons[0].performScrollTo().performClick()
        compose.waitForIdle()
        failures.assertCountEquals(1)
        buttons[1].performScrollTo().performClick()
        compose.waitForIdle()
        failures.assertCountEquals(2)
    }

    /** On a phone a skill opens where it's tapped: the one above stays open, so nothing moves the row under the finger. */
    @Test
    fun openingASkillLeavesTheOneAboveOpen() {
        val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
        val store = MistakesNotebookStore(api, AppCache(session, scope), session) { "UTC" }
        compose.setContent { ZoonkTheme { Surface { Notebook(goalId, store, rememberAppNavigator()) } } }
        compose.waitForIdle()

        compose.onNodeWithText("First question").assertExists()
        val second = compose.onNodeWithText("Skill 2").performScrollTo()
        val before = second.getUnclippedBoundsInRoot().top

        second.performClick()
        compose.waitForIdle()

        compose.onNodeWithText("Third question").assertExists()
        compose.onNodeWithText("First question").assertExists()
        assertEquals(before.value, second.getUnclippedBoundsInRoot().top.value, 2.dp.value)
    }
}
