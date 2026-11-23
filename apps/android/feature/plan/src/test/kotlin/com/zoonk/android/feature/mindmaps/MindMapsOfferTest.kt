package com.zoonk.android.feature.mindmaps

import android.content.Context
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.input.InputMode
import androidx.compose.ui.input.InputModeManager
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.platform.LocalInputModeManager
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsFocused
import androidx.compose.ui.test.getBoundsInRoot
import androidx.compose.ui.test.junit4.ComposeContentTestRule
import androidx.compose.ui.test.junit4.v2.createComposeRule
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performKeyInput
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.pressKey
import androidx.compose.ui.test.requestFocus
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
import org.junit.Assert.assertTrue
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

    private lateinit var inputMode: InputModeManager

    private val api = FakeMindMapApi()
    private val session = AuthenticatedSession("ana", "token", "local")
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
    private val clock by lazy { TestClock(compose.mainClock) }
    private val chapters =
        listOf(mapJson(1, "Waves", "available"), mapJson(2, "Light", "available"), mapJson(3, "Optics", "available", lessonsToWrite = 2))
    private val fresh = goalMindMaps(chapters, offer = FRESH_OFFER)

    /** More chapters than No map yet shows: the first five, then a fold for the rest. */
    private fun many(subject: (Int) -> String? = { null }) = (1..8).map { mapJson(it, "Chapter $it", "available", subject = subject(it)) }

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
            inputMode = LocalInputModeManager.current
            CompositionLocalProvider(LocalClock provides clock) {
                ZoonkTheme { MindMapsContent(UUID.fromString(GOAL), host, rememberAppNavigator()) }
            }
        }
    }

    private fun waitFor(
        text: String,
        substring: Boolean = false,
    ) = compose.waitUntil(10_000) { compose.onAllNodesWithText(text, substring = substring).fetchSemanticsNodes().isNotEmpty() }

    /** A stop already past when the page opens still gates it, and asks for no read: only a day still to come arms one. */
    @Test
    fun aStopPastOnArrivalReadsNothingMore() {
        api.mindMaps = { stopped(clock.start.minusSeconds(60)) }
        show()
        waitFor("You've used your mind maps")
        compose.waitForIdle()
        assertEquals(1, api.lists)
    }

    /** With a correct clock, the instant passing makes one read of the list and nothing else; the read lifts the gate. */
    @Test
    fun aStopThatEndsWhileThePageIsOpenGoesAndCreateAllComes() {
        api.mindMaps = { if (api.lists == 1) stopped(clock.opening) else fresh }
        show()

        waitFor("You've used your mind maps")
        compose.onNodeWithText("Create all").assertDoesNotExist()
        val below = compose.onNodeWithText("No map yet").getBoundsInRoot().top

        clock.passOpening()
        waitFor("Create all")
        compose.onNodeWithText("You've used your mind maps").assertDoesNotExist()
        compose.onNodeWithText("You can try again now.").assertDoesNotExist()
        assertEquals(2, api.lists)
        assertEquals(emptyList<Any>(), api.created)
        assertEquals(0, api.createdAll)
        // The gate's slot holds its height for this visit, so nothing below it moves without a tap.
        assertEquals(below, compose.onNodeWithText("No map yet").getBoundsInRoot().top)
    }

    /**
     * The device's clock is ahead of the server's: the offer's stop, already past here, still gates the page with
     * no day printed, and only a read that lets a map start lifts it.
     */
    @Test
    fun aStopPastOnThisClockGatesUntilAReadLetsAMapStart() {
        var allowed = false
        api.mindMaps = { if (allowed) fresh else stopped(clock.start.minusSeconds(60)) }
        show()

        waitFor("You've used your mind maps")
        compose.onNodeWithText("You can try again now.").assertDoesNotExist()
        compose.onNodeWithText("More", substring = true).assertDoesNotExist()
        compose.onAllNodesWithText("Create").assertCountEquals(0)

        allowed = true
        scope.launch { store.list[UUID.fromString(GOAL)].refresh() }
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Create").fetchSemanticsNodes().size == 3 }
        compose.onNodeWithText("You've used your mind maps").assertDoesNotExist()
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
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Create").fetchSemanticsNodes().size == 3 }
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
        // The page's stop says it once; the tapped row doesn't repeat it.
        compose.onAllNodesWithText("You've used your mind maps").assertCountEquals(1)

        allowanceBack = true
        scope.launch { store.list[UUID.fromString(GOAL)].refresh() }
        compose.waitUntil(10_000) { compose.onAllNodesWithText("Create").fetchSemanticsNodes().size == 3 }
        compose.onNodeWithText("Create all").assertExists()
    }

    private fun refuseCreate(
        resource: String,
        period: String,
    ) {
        api.create = {
            throw ApiException(
                ApiError.Unavailable,
                "USAGE_LIMIT_REACHED",
                402,
                Json.parseToJsonElement("""{"limit":{"period":"$period","resource":"$resource","tier":"free"}}"""),
            )
        }
    }

    /** The day's AI help refuses every other map too, so the page offers none. */
    @Test
    fun aRowRefusedForTheDaysHelpStopsThePage() {
        val noHelp =
            goalMindMaps(
                chapters,
                offer =
                    """
                    {"eligible":2,"needLessons":2,"startable":0,
                    "stop":{"reason":"limitReached","resource":"aiSpend","period":"day","availableAt":null}}
                    """.trimIndent(),
            )
        api.mindMaps = { if (api.lists == 1) fresh else noHelp }
        refuseCreate("aiSpend", "day")
        show()
        waitFor("Create all")
        compose.onAllNodesWithText("Create")[0].performClick()

        compose.waitUntil(10_000) { compose.onAllNodesWithText("Create").fetchSemanticsNodes().isEmpty() }
        compose.onNodeWithText("Create all").assertDoesNotExist()
    }

    /** A map whose own lessons don't fit refuses only that map: the others keep their Create. */
    @Test
    fun aRowRefusedForItsOwnLessonsStopsOnlyThatRow() {
        api.mindMaps = { fresh }
        refuseCreate("chapterLessons", "total")
        show()
        waitFor("Create all")
        compose.onAllNodesWithText("Create")[0].performClick()

        waitFor("This map needs a subscription")
        compose.onAllNodesWithText("Create").assertCountEquals(2)
    }

    /** A finished chapter's map is claimed like any other, so while the maps are stopped the empty list promises none. */
    @Test
    fun theEmptyListPromisesNoMapWhileStopped() {
        api.mindMaps = {
            goalMindMaps(
                emptyList(),
                offer =
                    """
                    {"eligible":0,"needLessons":0,"startable":0,
                    "stop":{"reason":"limitReached","resource":"mindMap","period":"rolling30Days","availableAt":"${clock.start.plus(
                        Duration.ofDays(3),
                    )}"}}
                    """.trimIndent(),
            )
        }
        show()
        waitFor("No chapter maps yet.")
        compose.onNodeWithText("Every chapter you finish gets one.", substring = true).assertDoesNotExist()
    }

    /** On this page the offer owns a refusal that stops every map: once a read allows again, the refused row offers Create too. */
    @Test
    fun anAllowingReadAfterTheCapGivesTheRefusedRowItsCreate() {
        api.mindMaps = { fresh }
        refuseCreate("mindMap", "rolling30Days")
        show()
        waitFor("Create all")
        compose.onAllNodesWithText("Create")[0].performClick()

        compose.waitUntil(10_000) { compose.onAllNodesWithText("Create").fetchSemanticsNodes().size == 3 }
    }

    @Test
    fun aRefusalThatStopsEveryMapReadsOnce() {
        api.mindMaps = { if (api.lists == 1) fresh else stopped(clock.opening) }
        refuseCreate("mindMap", "rolling30Days")
        show()
        waitFor("Create all")
        compose.onAllNodesWithText("Create")[0].performClick()
        waitFor("You've used your mind maps")
        compose.waitForIdle()

        compose.onAllNodesWithText("You've used your mind maps").assertCountEquals(1)
    }

    /** The refused row's own day passing can't reopen it: the offer still stops every map until a read lifts it. */
    @Test
    fun theRowsOwnDayCantLiftTheOffersGate() {
        api.mindMaps = {
            when (api.lists) {
                1 -> fresh
                2 -> stopped(clock.opening)
                else -> throw ApiException(ApiError.Network)
            }
        }
        api.create = {
            throw ApiException(
                ApiError.Unavailable,
                "USAGE_LIMIT_REACHED",
                402,
                Json.parseToJsonElement(
                    """{"limit":{"availableAt":"${clock.opening}","period":"rolling30Days","resource":"mindMap","tier":"free"}}""",
                ),
            )
        }
        show()
        waitFor("Create all")
        compose.onAllNodesWithText("Create")[0].performClick()
        waitFor("You've used your mind maps")

        clock.passOpening()
        compose.waitForIdle()
        compose.onAllNodesWithText("Create").assertCountEquals(0)
    }

    /** What stops the learner outranks what is on its way: with a map being made and a stop, the line is the stop's. */
    @Test
    fun aStopOutranksAMapOnItsWay() {
        val writing = chapters + mapJson(4, "Lenses", "writingLessons", lessonsToWrite = 3)
        api.mindMaps = {
            goalMindMaps(
                writing,
                offer =
                    """
                    {"eligible":2,"needLessons":2,"startable":0,
                    "stop":{"reason":"limitReached","resource":"mindMap","period":"rolling30Days","availableAt":"${clock.start.plus(
                        Duration.ofDays(3),
                    )}"}}
                    """.trimIndent(),
            )
        }
        show()

        waitFor("You've used your mind maps")
        compose.onNodeWithText("on the way", substring = true).assertDoesNotExist()
    }

    /**
     * Main's rows for maps that didn't finish: one with its lessons written and one under No map yet each show their own Try
     * again on arrival, so the group opens for the second; no line counts them.
     */
    @Test
    fun everyMapThatDidntFinishShowsItsTryAgainOnArrival() {
        api.mindMaps = {
            goalMindMaps(
                listOf(mapJson(1, "Waves", "failed"), mapJson(2, "Light", "available"), mapJson(3, "Lenses", "failed", lessonsToWrite = 3)),
                offer = FRESH_OFFER,
            )
        }
        show()

        waitFor("Lenses")
        compose.onAllNodesWithText("Try again").assertCountEquals(2)
        compose.onNodeWithText("didn't finish", substring = true).assertDoesNotExist()
    }

    /** With a stop, the page line is the stop's notice, and a map under No map yet that didn't finish is still in view. */
    @Test
    fun aStopIsThePageLineWhileAMapDidntFinish() {
        api.mindMaps = {
            goalMindMaps(
                chapters + mapJson(4, "Lenses", "failed", lessonsToWrite = 3),
                offer =
                    """
                    {"eligible":2,"needLessons":2,"startable":0,
                    "stop":{"reason":"limitReached","resource":"mindMap","period":"rolling30Days","availableAt":"${clock.start.plus(
                        Duration.ofDays(3),
                    )}"}}
                    """.trimIndent(),
            )
        }
        show()

        waitFor("You've used your mind maps")
        compose.onNodeWithText("Lenses").assertExists()
        compose.onNodeWithText("didn't finish", substring = true).assertDoesNotExist()
    }

    /** As main: a map on its way leads No map yet, ahead of the chapters folded after the first five. */
    @Test
    fun aMapOnItsWayLeadsNoMapYet() {
        api.mindMaps =
            { goalMindMaps(many() + mapJson(9, "Lenses", "writingLessons", lessonsToWrite = 3, subject = null), offer = FRESH_OFFER) }
        show()

        waitFor("Lenses")
        compose.onNodeWithText("Chapter 4").assertExists()
        compose.onNodeWithText("Chapter 5").assertDoesNotExist()
        compose.onNodeWithText("4 more chapters").assertExists()
    }

    /** As main: the first five chapters show, and the heading counts every chapter without a map. */
    @Test
    fun theNextFiveShowAndTheRestFold() {
        api.mindMaps = { goalMindMaps(many(), offer = FRESH_OFFER) }
        show()

        waitFor("No map yet")
        compose.onNodeWithText("8").assertExists()
        compose.onNodeWithText("Chapter 5").assertExists()
        compose.onNodeWithText("Chapter 6").assertDoesNotExist()
        compose.onNodeWithText("3 more chapters").performClick()
        waitFor("Chapter 8")
        compose.onNodeWithText("Show fewer chapters").assertExists()
    }

    /** As main: past the first five, a goal's chapters fold by subject, each opening on its own. */
    @Test
    fun theRestFoldBySubject() {
        api.mindMaps = { goalMindMaps(many { if (it > 6) "mathematics" else "natural-sciences" }, offer = FRESH_OFFER) }
        show()

        waitFor("Mathematics")
        compose.onNodeWithText("Chapter 7").assertDoesNotExist()
        compose.onNodeWithText("Mathematics").performClick()
        waitFor("Chapter 7")
        compose.onNodeWithText("Chapter 6").assertDoesNotExist()
    }

    /** As main's fold: TalkBack hears whether it's open and can open or close it. */
    @Test
    fun theFoldTellsTalkBackWhetherItsOpen() {
        api.mindMaps = { goalMindMaps(many(), offer = FRESH_OFFER) }
        show()

        waitFor("3 more chapters")
        compose
            .onNodeWithText("3 more chapters")
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "Collapsed"))
            .assert(SemanticsMatcher.keyIsDefined(SemanticsActions.Expand))
            .performSemanticsAction(SemanticsActions.Expand)

        waitFor("Chapter 8")
        compose
            .onNodeWithText("Show fewer chapters")
            .assert(SemanticsMatcher.expectValue(SemanticsProperties.StateDescription, "Expanded"))
            .assert(SemanticsMatcher.keyIsDefined(SemanticsActions.Collapse))
    }

    /** A keyboard learner who opens the fold reaches the chapter it showed next, not Create all past it. */
    @OptIn(ExperimentalTestApi::class)
    @Test
    fun tabAfterOpeningTheFoldReachesTheChapterItShowed() {
        api.mindMaps = { goalMindMaps(many(), offer = FRESH_OFFER) }
        show()

        waitFor("3 more chapters")
        compose.runOnIdle { assertTrue(inputMode.requestInputMode(InputMode.Keyboard)) }
        compose
            .onNodeWithText("3 more chapters")
            .requestFocus()
            .assertIsFocused()
            .performKeyInput { pressKey(Key.Enter) }
        waitFor("Chapter 6")
        compose.onNodeWithText("Show fewer chapters").performKeyInput { pressKey(Key.Tab) }

        compose.onAllNodesWithText("Create")[5].assertIsFocused()
    }

    /** As main: with no chapter ready to make, the chapters that need their lessons first are listed, not folded. */
    @Test
    fun chaptersNeedingLessonsShowWhenNoneIsReadyToMake() {
        api.mindMaps = {
            goalMindMaps(
                listOf(mapJson(1, "Waves", "available", lessonsToWrite = 2), mapJson(2, "Optics", "available", lessonsToWrite = 3)),
                offer = FRESH_OFFER,
            )
        }
        show()

        waitFor("Optics")
        compose.onNodeWithText("Waves").assertExists()
    }

    /** The line counts every map on its way: a failed one has its own row with Try again, the one writing lessons is on its way. */
    @Test
    fun theLineCountsTheMapsOnTheirWay() {
        api.mindMaps = {
            goalMindMaps(
                listOf(mapJson(1, "Waves", "failed"), mapJson(2, "Optics", "writingLessons", lessonsToWrite = 2)),
                offer = """{"eligible":1,"needLessons":1,"startable":1,"stop":null}""",
            )
        }
        show()

        waitFor("1 on the way. You can leave while it's made.")
        compose.onNodeWithText("didn't finish", substring = true).assertDoesNotExist()
    }

    /** An empty list that keeps its stop still reads the list once at the stop's day, which lifts it. */
    @Test
    fun anEmptyStoppedListReadsAgainAtTheStopsDay() {
        val stopped =
            """
            {"eligible":0,"needLessons":0,"startable":0,
            "stop":{"reason":"limitReached","resource":"mindMap","period":"rolling30Days","availableAt":"${clock.opening}"}}
            """.trimIndent()
        api.mindMaps = { goalMindMaps(emptyList(), offer = if (api.lists == 1) stopped else FRESH_OFFER) }
        show()
        waitFor("No chapter maps yet.")
        assertEquals(1, api.lists)

        clock.passOpening()
        waitFor("No chapter maps yet. Every chapter you finish gets one.")
        assertEquals(2, api.lists)
    }
}

private const val FRESH_OFFER = """{"eligible":2,"needLessons":2,"startable":2,"stop":null}"""
