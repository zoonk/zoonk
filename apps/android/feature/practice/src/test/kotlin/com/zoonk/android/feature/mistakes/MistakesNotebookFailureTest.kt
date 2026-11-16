package com.zoonk.android.feature.mistakes

import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.scaffold.PageScaffold
import com.zoonk.android.ui.scaffold.unfoldBook
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.GoalMistakePattern
import com.zoonk.api.models.MistakeList
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.io.IOException
import java.util.UUID

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w852dp-h883dp-xhdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class MistakesNotebookFailureTest {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val compose = createAndroidComposeRule<ComponentActivity>()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val goalId = UUID.fromString("00000000-0000-4000-8000-0000000000a1")
    private var openOffline = false
    private var fixedOffline = true
    private val requests = mutableMapOf(false to 0, true to 0)
    private val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
    private val api =
        object : NotebookApi {
            override suspend fun page(
                session: AuthenticatedSession,
                key: NotebookKey,
                cursor: String?,
                timeZone: String,
            ): MistakeList {
                requests[key.fixed] = requests.getValue(key.fixed) + 1
                if (if (key.fixed) fixedOffline else openOffline) throw IOException("offline")
                return ApiJson.decodeFromString(
                    MistakeList.serializer(),
                    """{"availability":{"ready":1,"tomorrow":0},"counts":{"byCause":{"gap":0,"guess":0,"misread":0,"time":0,"trap":0,"unsorted":0},"fixed":0,"open":1},"data":[],"pagination":{"hasMore":false,"nextCursor":null},"trueFalseLabels":"trueFalse"}""",
                )
            }

            override suspend fun pattern(
                session: AuthenticatedSession,
                goalId: UUID,
            ): GoalMistakePattern = ApiJson.decodeFromString(GoalMistakePattern.serializer(), """{"pattern":null}""")
        }

    @After fun stopScope() = scope.cancel()

    private fun show() {
        val store = MistakesNotebookStore(api, AppCache(session, scope), session) { "UTC" }
        compose.setContent {
            ZoonkTheme {
                PageScaffold(onBack = {}, title = { Text("Mistakes") }) { padding ->
                    Box(Modifier.fillMaxSize().padding(padding)) { Notebook(goalId, "Math", store, rememberAppNavigator()) }
                }
            }
        }
        compose.unfoldBook(folds)
        compose.waitForIdle()
    }

    private fun picture(name: String) {
        val folder = System.getProperty("zoonk.shots").orEmpty()
        if (folder.isNotEmpty()) writeRender(File(folder, "$name.png"), compose.onRoot().captureRender().asAndroidBitmap())
    }

    @Test
    fun aFailedFixedListKeepsRetryAboveTheNotebooksOwnPracticeBar() {
        show()
        picture("book-fixed-failed-practice-ready")
        val retry = compose.onNodeWithText("Try again")
        val practice = compose.onNodeWithText("Practice mistakes")
        assertTrue(retry.getUnclippedBoundsInRoot().bottom < practice.getUnclippedBoundsInRoot().top)
        val before = requests.getValue(true)
        fixedOffline = false
        retry.performClick()
        compose.waitForIdle()
        assertEquals(before + 1, requests[true])
        retry.assertDoesNotExist()
        practice.assertExists()
    }

    @Test
    fun twoFailedBookListsShareRetryAndTheRemainingFailureKeepsIt() {
        openOffline = true
        show()
        picture("book-both-lists-failed")
        compose.onAllNodesWithText("Try again").assertCountEquals(1)
        val before = requests.toMap()
        fixedOffline = false
        compose.onNodeWithText("Try again").performClick()
        compose.waitForIdle()
        picture("book-only-open-list-failed")
        assertEquals(before.getValue(false) + 1, requests[false])
        assertEquals(before.getValue(true) + 1, requests[true])
        compose.onAllNodesWithText("Try again").assertCountEquals(1)
        openOffline = false
        compose.onNodeWithText("Try again").performClick()
        compose.waitForIdle()
        assertEquals(before.getValue(false) + 2, requests[false])
        assertEquals(before.getValue(true) + 1, requests[true])
        compose.onNodeWithText("Try again").assertDoesNotExist()
    }
}
