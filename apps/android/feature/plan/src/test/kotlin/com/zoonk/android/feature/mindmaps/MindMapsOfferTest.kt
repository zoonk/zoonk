package com.zoonk.android.feature.mindmaps

import android.content.Context
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import coil3.ImageLoader
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.PrivateImages
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.components.LimitTier
import com.zoonk.android.ui.components.LocalClock
import com.zoonk.android.ui.components.PrivatePictures
import com.zoonk.android.ui.components.TestClock
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.GoalMindMaps
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import okhttp3.HttpUrl.Companion.toHttpUrl
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.time.Duration
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
    private val clock by lazy { TestClock(compose.mainClock) }
    private val chapters =
        listOf(mapJson(1, "Waves", "available"), mapJson(2, "Light", "available"), mapJson(3, "Optics", "available", lessonsToWrite = 2))
    private val fresh = goalMindMaps(chapters, offer = """{"eligible":2,"needLessons":2,"startable":2,"stop":null}""")

    @After
    fun stop() = scope.cancel()

    private fun stopped(at: Instant): GoalMindMaps =
        goalMindMaps(
            chapters,
            offer =
                """
                {"eligible":2,"needLessons":2,"startable":0,
                "stop":{"reason":"limitReached","resource":"mindMap","period":"rolling30Days","availableAt":"$at"}}
                """.trimIndent(),
        )

    private val store by lazy { MindMapStore(api, AppCache(FakeSession(session), scope), clock) }

    private fun show() {
        val images =
            PrivateImages("https://example.test/v1/".toHttpUrl(), ImageLoader(ApplicationProvider.getApplicationContext<Context>()))
        val host = MindMapsHost(store, session, PrivatePictures(images, session), { null }, { LimitTier.Free }, { session })
        compose.setContent {
            CompositionLocalProvider(LocalClock provides clock) {
                ZoonkTheme { MindMapsContent(UUID.fromString(GOAL), host, rememberAppNavigator()) }
            }
        }
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
        api.mindMaps = { if (api.lists == 1) stopped(clock.opening) else fresh }
        show()

        waitFor("You've used your mind maps")
        compose.onNodeWithText("Create all").assertDoesNotExist()
        val below = compose.onNodeWithText("Other chapters").getBoundsInRoot().top

        clock.passOpening()
        waitFor("Create all")
        compose.onNodeWithText("You've used your mind maps").assertDoesNotExist()
        compose.onNodeWithText("You can try again now.").assertDoesNotExist()
        assertEquals(2, api.lists)
        // The gate's slot holds its height for this visit, so nothing below it moves without a tap.
        assertEquals(below, compose.onNodeWithText("Other chapters").getBoundsInRoot().top)
    }

    /** The device's clock is ahead of the server's: Create all's own stop, already past here, keeps its gate through the list read after it. */
    @Test
    fun createAllsStopPastOnArrivalKeepsItsGate() {
        val past = Instant.parse("2020-01-01T00:00:00Z")
        api.mindMaps = { if (api.lists == 1) fresh else stopped(past) }
        api.createAll = {
            ApiJson.decodeFromString(
                """
                {"accepted":[],"joined":[],"unstarted":[],
                "stop":{"reason":"limitReached","resource":"mindMap","period":"rolling30Days","availableAt":"$past"}}
                """.trimIndent(),
            )
        }
        show()

        waitFor("Create all")
        compose.onNodeWithText("Create all").performClick()
        waitFor("You've used your mind maps")
        compose.onNodeWithText("You can try again now.").assertDoesNotExist()
        compose.onNodeWithText("Create all").assertDoesNotExist()
        compose.onAllNodesWithText("Create").assertCountEquals(0)
    }

    /** Create all's stop holds through its own read only: a later read that lets a map start brings the rows' Create back. */
    @Test
    fun aLaterReadThatLetsAMapStartRetiresCreateAllsStop() {
        val past = Instant.parse("2020-01-01T00:00:00Z")
        val oneMore = goalMindMaps(chapters, offer = """{"eligible":2,"needLessons":2,"startable":1,"stop":null}""")
        var allowanceBack = false
        api.mindMaps = {
            when {
                api.lists == 1 -> fresh
                allowanceBack -> oneMore
                else -> stopped(past)
            }
        }
        api.createAll = {
            ApiJson.decodeFromString(
                """
                {"accepted":[],"joined":[],"unstarted":[],
                "stop":{"reason":"limitReached","resource":"mindMap","period":"rolling30Days","availableAt":"$past"}}
                """.trimIndent(),
            )
        }
        show()
        waitFor("Create all")
        compose.onNodeWithText("Create all").performClick()
        waitFor("You've used your mind maps")

        allowanceBack = true
        scope.launch { store.list[UUID.fromString(GOAL)].refresh() }
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Create").fetchSemanticsNodes().size == 2 }
        compose.onNodeWithText("You've used your mind maps").assertDoesNotExist()
    }

    /** A row refused for the cap on maps stops the page's other Creates and Create all, until a later read lets a map start. */
    @Test
    fun aRowRefusedForTheCapStopsThePagesOtherCreates() {
        val opens = clock.start.plus(Duration.ofDays(3))
        var allowanceBack = false
        api.mindMaps = { if (api.lists == 1 || allowanceBack) fresh else stopped(opens) }
        api.create = {
            throw ApiException(
                ApiError.Unavailable,
                "USAGE_LIMIT_REACHED",
                402,
                Json.parseToJsonElement(
                    """{"limit":{"availableAt":"$opens","period":"rolling30Days","resource":"mindMap","tier":"free"}}""",
                ),
            )
        }
        show()
        waitFor("Create all")
        compose.onAllNodesWithText("Create")[0].performClick()

        waitFor("You've used your mind maps")
        compose.onAllNodesWithText("Create").assertCountEquals(0)
        compose.onNodeWithText("Create all").assertDoesNotExist()

        allowanceBack = true
        scope.launch { store.list[UUID.fromString(GOAL)].refresh() }
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Create").fetchSemanticsNodes().size == 2 }
        compose.onNodeWithText("Create all").assertExists()
    }
}
