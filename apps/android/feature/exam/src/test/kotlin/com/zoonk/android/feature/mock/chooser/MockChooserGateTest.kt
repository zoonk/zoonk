package com.zoonk.android.feature.mock.chooser

import androidx.activity.ComponentActivity
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.isSelectable
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.test.requestFocus
import androidx.navigation3.runtime.NavBackStack
import androidx.navigation3.runtime.NavKey
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.exam.GOAL
import com.zoonk.android.feature.exam.mockOptions
import com.zoonk.android.feature.mock.MockApi
import com.zoonk.android.feature.mock.MockStore
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.AppTab
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.MockOptions
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.util.UUID

/**
 * A free learner's Start turns into Subscribe; Enter does what the bar's button says. The gate reads the
 * options' access in [MockStore], which a server refusal writes and a successful read replaces.
 */
@RunWith(AndroidJUnit4::class)
@OptIn(ExperimentalTestApi::class)
class MockChooserGateTest {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val navigator =
        AppNavigator(
            stacks = AppTab.entries.associateWith { NavBackStack<NavKey>(it.root) },
            selected = mutableStateOf(AppTab.Today),
            tasks = NavBackStack(),
            openWebPage = {},
        )

    private val starts = FakeMockStartApi()
    private val session = FakeSession(AuthenticatedSession("ana", "token", "local"))
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val cache = AppCache(session, scope)

    /** What the server answers the next read of the options with; it throws when the read fails. */
    private var answer: () -> MockOptions = { LOCKED }
    private val store =
        MockStore(
            object : MockApi {
                override suspend fun options(
                    session: AuthenticatedSession,
                    goalId: UUID,
                ) = answer()
            },
            cache,
        )

    private fun show() {
        val viewModel = MockChooserViewModel(GOAL, MockStarter(starts, cache), session, { ReadyRuns() }) { store.refused(GOAL) }
        rule.setContent {
            ZoonkTheme {
                val state by store.options[GOAL].collectShown()
                state.value?.let { PracticeChooser(it, viewModel, navigator, rememberLazyListState()) }
            }
        }
        rule.onAllNodes(isSelectable()).onFirst().performClick()
    }

    private fun start() = rule.onNodeWithText("Start").performClick()

    /** A read of the options after the server [answer]s, as a purchase or a pull to refresh starts one. */
    private fun readAgain(next: () -> MockOptions) {
        answer = next
        rule.runOnIdle { scope.launch { store.options[GOAL].refresh() } }
        rule.waitForIdle()
    }

    private fun assertGate() {
        rule.onNodeWithText("Subscribe").assertExists()
        rule.onNodeWithText("Start").assertDoesNotExist()
    }

    private fun assertStart() {
        rule.onNodeWithText("Subscribe").assertDoesNotExist()
        rule.onNodeWithText("Start").assertIsEnabled()
    }

    @Test
    fun enterOnTheGateOpensTheSubscription() {
        show()
        start()

        rule.onNodeWithText("Subscribe").requestFocus().performKeyInput { pressKey(Key.Enter) }

        rule.runOnIdle { assertEquals(AppRoute.Subscription, navigator.currentRoute) }
    }

    /** Enter on a focused control is that control's: the last mock opens, and no timed mock starts. */
    @Test
    @Config(qualifiers = "w1280dp-h800dp-land")
    fun enterOnTheLastMockOpensItAndStartsNothing() {
        answer = { WITH_LAST }
        show()

        rule.onNodeWithText("Mock exam 2").requestFocus().performKeyInput { pressKey(Key.Enter) }

        rule.runOnIdle {
            assertEquals(AppRoute.Mock(LAST_BLOCK), navigator.currentRoute)
            assertEquals(0, starts.started.size)
        }
    }

    /** From the picks, Enter is the page's Start, as a radio passes Enter to main's screen. */
    @Test
    fun enterOnThePickStarts() {
        answer = { OPEN }
        show()

        rule
            .onAllNodes(isSelectable())
            .onFirst()
            .requestFocus()
            .performKeyInput { pressKey(Key.Enter) }

        rule.runOnIdle { assertEquals(1, starts.started.size) }
    }

    /** The bar's Start takes its own Enter, and the page doesn't start a second mock on top of it. */
    @Test
    fun enterOnTheFocusedStartStartsOnce() {
        answer = { OPEN }
        show()

        rule.onNodeWithText("Start").requestFocus().performKeyInput { pressKey(Key.Enter) }

        rule.runOnIdle { assertEquals(1, starts.started.size) }
    }

    @Test
    fun aPurchaseLiftsTheGateAndKeepsThePick() {
        show()
        start()
        assertGate()

        readAgain { OPEN }

        assertStart()
    }

    /** The options read open, then the subscription lapsed: the server's refusal is the gate. */
    @Test
    fun aStartTheServerRefusesShowsTheGate() {
        answer = { OPEN }
        starts.starts = listOf { throw refusal("PLUS_REQUIRED") }
        show()
        answer = { LOCKED }

        start()

        assertGate()
    }

    /** Offline after the refusal: the options can't be read again, and opening Subscribe and coming back changes nothing. */
    @Test
    fun aRefusalKeepsTheGateThroughAFailedReadAndALeftSubscription() {
        answer = { OPEN }
        starts.starts = listOf { throw refusal("PLUS_REQUIRED") }
        show()
        answer = { throw ApiException(ApiError.Network) }

        start()
        assertGate()
        rule.onNodeWithText("Subscribe").performClick()
        rule.runOnIdle { navigator.back() }
        readAgain { throw ApiException(ApiError.Network) }

        assertGate()
        assertEquals(1, starts.started.size)
    }

    /** A purchase made elsewhere: the options read open again, the same answer as before the refusal, and Start is back. */
    @Test
    fun aSuccessfulOpenReadAfterARefusalLiftsTheGate() {
        answer = { OPEN }
        starts.starts = listOf { throw refusal("PLUS_REQUIRED") }
        show()
        answer = { throw ApiException(ApiError.Network) }
        start()
        assertGate()

        readAgain { OPEN }

        assertStart()
    }

    @Test
    fun aWritingRequestTheServerRefusesShowsTheGate() {
        answer = { OPEN }
        starts.starts = listOf { NEEDS_QUESTIONS }
        starts.writes = listOf { throw refusal("PLUS_REQUIRED") }
        show()
        answer = { LOCKED }

        start()

        assertGate()
    }

    private companion object {
        val OPEN = mockOptions("")
        val LOCKED = mockOptions(""""access":"plusRequired"""")
        const val LAST_BLOCK = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1a03"
        val WITH_LAST =
            mockOptions(
                """"lastMock":{"blockId":"$LAST_BLOCK","correct":52,"examQuestions":180,"finishedAt":"2026-10-20T15:00:00Z",
                "measure":52,"number":2,"purpose":"practice","scoring":"raw","shape":{"area":null,"day":1,"kind":"full"},"total":90}""",
            )
    }
}
