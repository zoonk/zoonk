package com.zoonk.android.ui.components

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.scaffold.TaskScaffold
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class LoadFailedMessageTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun aPageFailureRetriesFromTheBottomBarAndRemovesTheActionWhenLoaded() {
        var failed by mutableStateOf(true)
        compose.setContent {
            ZoonkTheme {
                PageScaffold(onBack = {}) { padding ->
                    Column(Modifier.padding(padding).verticalScroll(rememberScrollState())) {
                        if (failed) LoadFailedMessage(onRetry = { failed = false }) else Text("Loaded")
                    }
                }
            }
        }
        val retry = compose.onNodeWithText("Try again")
        assertTrue(retry.getUnclippedBoundsInRoot().top > compose.onRoot().getUnclippedBoundsInRoot().bottom / 2)
        retry.performClick()
        retry.assertDoesNotExist()
    }

    @Test
    fun anEmbeddedFailureKeepsItsRetryByTheMessageAndPreservesTheMainAction() {
        var retried = false
        compose.setContent {
            ZoonkTheme {
                PageScaffold(
                    onBack = {},
                    bottomBar = { TaskActions { main -> Button(onClick = {}, modifier = main) { Text("Continue") } } },
                ) { padding ->
                    Column(Modifier.padding(padding)) { LoadFailedMessage(onRetry = { retried = true }) }
                }
            }
        }
        val retry = compose.onNodeWithText("Try again")
        assertTrue(retry.getUnclippedBoundsInRoot().bottom < compose.onNodeWithText("Continue").getUnclippedBoundsInRoot().top)
        retry.performClick()
        assertTrue(retried)
    }

    @Test
    fun aTaskFailureRetriesFromItsBottomBar() {
        var retried = false
        compose.setContent {
            ZoonkTheme {
                TaskScaffold(onClose = {}) { padding ->
                    Column(Modifier.padding(padding)) { LoadFailedMessage(onRetry = { retried = true }) }
                }
            }
        }
        assertTrue(
            compose.onNodeWithText("Try again").getUnclippedBoundsInRoot().top > compose.onRoot().getUnclippedBoundsInRoot().bottom / 2,
        )
        compose.onNodeWithText("Try again").performClick()
        assertTrue(retried)
    }

    @Test
    fun aListInsideAPageKeepsItsRetryInPlaceWithoutCreatingAMainAction() {
        compose.setContent {
            ZoonkTheme {
                PageScaffold(onBack = {}) { padding ->
                    Column(Modifier.padding(padding)) { LoadFailedMessage(onRetry = {}, inBar = false) }
                }
            }
        }
        assertTrue(
            compose.onNodeWithText("Try again").getUnclippedBoundsInRoot().bottom < compose.onRoot().getUnclippedBoundsInRoot().bottom / 2,
        )
    }

    @Test
    fun oneBarRetriesEveryFailureAndKeepsTheRemainingFailureRegistered() {
        var secondFailed by mutableStateOf(true)
        var firstRetries = 0
        var secondRetries = 0
        compose.setContent {
            ZoonkTheme {
                PageScaffold(onBack = {}) { padding ->
                    Column(Modifier.padding(padding)) {
                        LoadFailedMessage(onRetry = { firstRetries++ })
                        if (secondFailed) LoadFailedMessage(onRetry = { secondRetries++ })
                    }
                }
            }
        }
        compose.onAllNodesWithText("Try again").assertCountEquals(1)
        compose.onNodeWithText("Try again").performClick()
        assertTrue(firstRetries == 1 && secondRetries == 1)
        compose.runOnIdle { secondFailed = false }
        compose.onAllNodesWithText("Try again").assertCountEquals(1)
        compose.onNodeWithText("Try again").performClick()
        assertTrue(firstRetries == 2 && secondRetries == 1)
    }
}
