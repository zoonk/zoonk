package com.zoonk.android.feature.mindmaps

import android.content.Context
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import coil3.ImageLoader
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.PrivateImages
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.components.PrivatePictures
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.GoalMindMaps
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.time.Instant
import java.util.UUID

/** The page's offer is read again the day its stop gave comes, so its counts and Create all are today's. */
@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "w411dp-h891dp")
class MindMapsOfferTest {
    @get:Rule
    val compose: ComposeContentTestRule = createComposeRule()

    private val api = FakeMindMapApi()
    private val session = AuthenticatedSession("ana", "token", "local")
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val chapters = listOf(mapJson(1, "Waves", "available"), mapJson(2, "Light", "available"))
    private val fresh = goalMindMaps(chapters, offer = """{"eligible":2,"needLessons":0,"startable":2,"stop":null}""")

    @After
    fun stop() = scope.cancel()

    private fun stopped(at: Instant): GoalMindMaps =
        goalMindMaps(
            chapters,
            offer =
                """
                {"eligible":2,"needLessons":0,"startable":0,
                "stop":{"reason":"limitReached","resource":"mindMap","period":"rolling30Days","availableAt":"$at"}}
                """.trimIndent(),
        )

    private fun show() {
        val store = MindMapStore(api, AppCache(FakeSession(session), scope))
        val images =
            PrivateImages("https://example.test/v1/".toHttpUrl(), ImageLoader(ApplicationProvider.getApplicationContext<Context>()))
        val host = MindMapsHost(store, session, PrivatePictures(images, session), { null }, { LimitTier.Free }, { session })
        compose.setContent { ZoonkTheme { MindMapsContent(UUID.fromString(GOAL), host, rememberAppNavigator()) } }
    }

    private fun waitFor(text: String) = compose.waitUntil(10_000) { compose.onAllNodesWithText(text).fetchSemanticsNodes().isNotEmpty() }

    @Test
    fun aStopThatEndedBeforeThePageOpenedIsReadAgainAtOnce() {
        api.mindMaps = { if (api.lists == 1) stopped(Instant.parse("2020-01-01T00:00:00Z")) else fresh }
        show()

        waitFor("Create all")
        assertEquals(2, api.lists)
        compose.onNodeWithText("You've used your mind maps").assertDoesNotExist()
    }

    @Test
    fun aStopThatEndsWhileThePageIsOpenGoesAndCreateAllComes() {
        api.mindMaps = { if (api.lists == 1) stopped(Instant.now().plusSeconds(3)) else fresh }
        show()

        waitFor("You've used your mind maps")
        compose.onNodeWithText("Create all").assertDoesNotExist()

        waitFor("Create all")
        compose.onNodeWithText("You've used your mind maps").assertDoesNotExist()
        compose.onNodeWithText("You can try again now.").assertDoesNotExist()
        assertEquals(2, api.lists)
    }
}
