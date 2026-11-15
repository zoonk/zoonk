package com.zoonk.android.feature.mock.runner

import android.content.pm.ActivityInfo
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.compose.ui.test.junit4.v2.createEmptyComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.AppNavigator
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

/**
 * Closing a mock closes it, once, though the window changes width, both ways, while its answers go out; a close
 * whose answers go out after the learner left the mock closes nothing.
 */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class MockLeaveWindowTest {
    @get:Rule
    val rule: ComposeTestRule = createEmptyComposeRule()

    @get:Rule
    val folder = TemporaryFolder()

    private lateinit var scenario: ActivityScenario<MockLeaveTestActivity>

    @After
    fun close() = scenario.close()

    @Test
    fun closingWhileAnswersGoOutAndTheWindowWidensAndNarrowsClosesTheMockOnce() {
        val held = launchAMock()

        scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
        RuntimeEnvironment.setQualifiers("w1280dp-h900dp")
        scenario.recreate()
        RuntimeEnvironment.setQualifiers("w411dp-h891dp")
        scenario.recreate()
        held.complete(Unit)
        rule.waitForIdle()

        assertFalse(MockLeaveTest.navigator.isTaskOpen)
        assertEquals(AppRoute.Today, MockLeaveTest.navigator.currentRoute)
    }

    @Test
    fun aCloseWhoseAnswersWentOutAfterTheLearnerLeftTheMockLeavesItOpenAndClosableOnReturn() {
        val held = launchAMock()

        scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
        MockLeaveTest.visible = false
        rule.waitForIdle()
        held.complete(Unit)
        rule.waitForIdle()
        MockLeaveTest.visible = true
        rule.waitForIdle()

        assertEquals(AppRoute.Mock(RUN_BLOCK), MockLeaveTest.navigator.currentRoute)
        scenario.onActivity { it.onBackPressedDispatcher.onBackPressed() }
        rule.waitForIdle()
        assertFalse(MockLeaveTest.navigator.isTaskOpen)
    }

    /** A running mock on its first question, its answers held until the returned call completes. */
    private fun launchAMock(): CompletableDeferred<Unit> {
        val application = RuntimeEnvironment.getApplication()
        shadowOf(application.packageManager).addOrUpdateActivity(
            ActivityInfo().apply {
                name = MockLeaveTestActivity::class.java.name
                packageName = application.packageName
            },
        )
        val held = CompletableDeferred<Unit>()
        val api = FakeMockRunApi().apply { saveGate = held }
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
        MockLeaveTest.visible = true
        MockLeaveTest.app = AppContainer.preview(application)
        MockLeaveTest.store =
            MockRunStore(api, AppCache(FakeSession(AuthenticatedSession("ana", "token", "local")), scope), DraftStore(folder.root, scope)) {
                "UTC"
            }
        scenario = ActivityScenario.launch(MockLeaveTestActivity::class.java)
        rule.onNodeWithText("What is 1 + 1?").assertExists()
        return held
    }
}

/** What outlives [MockLeaveTestActivity]'s recreations, as the app's container does. */
object MockLeaveTest {
    /** False while the learner is away from the mock, its entry and view models kept, as a task over it keeps them. */
    var visible by mutableStateOf(true)
    lateinit var app: AppContainer
    lateinit var store: MockRunStore
    lateinit var navigator: AppNavigator
}

class MockLeaveTestActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val first = savedInstanceState == null
        setContent {
            ZoonkTheme {
                val navigator = rememberAppNavigator()
                MockLeaveTest.navigator = navigator
                LaunchedEffect(Unit) { if (first) navigator.open(AppRoute.Mock(RUN_BLOCK)) }
                if (navigator.isTaskOpen &&
                    MockLeaveTest.visible
                ) {
                    MockScreen(AppRoute.Mock(RUN_BLOCK), MockLeaveTest.app, navigator, MockLeaveTest.store)
                }
            }
        }
    }
}
