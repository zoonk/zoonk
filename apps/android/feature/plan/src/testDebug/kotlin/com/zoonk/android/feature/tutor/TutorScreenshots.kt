package com.zoonk.android.feature.tutor

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.material3.Surface
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.lifecycle.SavedStateHandle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.conversation.CallStart
import com.zoonk.android.feature.conversation.callStarter
import com.zoonk.android.feature.plan.effect
import com.zoonk.android.feature.plan.planChange
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.testing.captureRender
import com.zoonk.android.ui.testing.writeRender
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.TutorToolOffer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.flow
import kotlinx.serialization.json.Json
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

/**
 * Review screenshots of every tool offer and a memory update under the buddy's answers, written only
 * on demand: `-Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class TutorScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h5400dp-xhdpi")
    fun offers() = capture("tutor-offers", dark = false)

    @Test
    @Config(qualifiers = "w411dp-h5400dp-night-xhdpi")
    fun offersDark() = capture("tutor-offers-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h8000dp-xhdpi")
    fun offersAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("tutor-offers-font200", dark = false)
    }

    @Test
    @Config(qualifiers = "w411dp-h3800dp-xhdpi")
    fun planChanges() = capture("tutor-plan-changes", dark = false, turns = planChangeTurns())

    @Test
    @Config(qualifiers = "w411dp-h3800dp-night-xhdpi")
    fun planChangesDark() = capture("tutor-plan-changes-dark", dark = true, turns = planChangeTurns())

    /** A free learner's messages used up over the last 30 days: the notice in place of the composer, with the day more come back. */
    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun messagesUsed() = captureMessagesUsed("phone")

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun messagesUsedTablet() = captureMessagesUsed("tablet")

    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    fun messagesUsedAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        captureMessagesUsed("phone-font200")
    }

    /** The composer at rest, then focused with a question typed, as main draws it on the same page. */
    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun composer() = captureComposer("phone")

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun composerDark() = captureComposer("phone-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun composerMoreContrast() = captureComposer("phone-contrast", moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun composerDarkMoreContrast() = captureComposer("phone-dark-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h1400dp-xxhdpi")
    fun composerAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        captureComposer("phone-font200")
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun composerTablet() = captureComposer("tablet")

    private fun captureComposer(
        size: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
    ) {
        val vm = viewModel(listOf(turn("t0", TutorTurn.Status.Completed, "Black holes bend light around them.", "What do black holes do?")))
        compose.setContent {
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                Surface { TutorPanel(vm, TutorAccess.Ask, TutorIdentity("Zu", BuddyLook()), ROUTES) }
            }
        }
        write("tutor-composer-$size")
        compose.onNode(hasSetTextAction()).performClick()
        compose.onNode(hasSetTextAction()).performTextInput("Why can't light escape?")
        write("tutor-composer-$size-focused")
    }

    private fun write(name: String) {
        compose.waitForIdle()
        // Past the press ripple, so the send button shows at rest.
        compose.mainClock.advanceTimeBy(1_000)
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        writeRender(file, compose.onRoot().captureRender().asAndroidBitmap())
    }

    private fun captureMessagesUsed(size: String) {
        val opens = Instant.now().plus(9, ChronoUnit.DAYS)
        val limit = """{"availableAt":"$opens","limit":30,"period":"rolling30Days","resource":"tutorMessage","tier":"free"}"""
        capture(
            "tutor-messages-used-$size",
            dark = false,
            turns = listOf(turn("t0", TutorTurn.Status.Completed, "Black holes bend light around them.", "What do black holes do?")),
            refusal =
                ApiException(
                    ApiError.Unavailable,
                    "USAGE_LIMIT_REACHED",
                    status = 402,
                    details = Json.parseToJsonElement("""{"limit":$limit}"""),
                ),
        )
    }

    private fun planChangeTurns() =
        listOf(
            planChange(
                operations = """[{"kind":"focusAreas","areas":["Administrative law","Mathematics"]}]""",
                status = "proposed",
                effect =
                    effect(
                        """"areaStarts":[{"area":"Mathematics","after":"2026-11-20","before":"2026-11-17"}],
                        "areaEnds":[{"area":"Administrative law","after":"2026-11-28","before":"2026-11-27","lessonsGained":1},
                        {"area":"Mathematics","after":"2026-12-02","before":"2026-11-28","lessonsGained":1}]""",
                    ),
            ),
            planChange(
                operations = """[{"kind":"setDailyMinutes","minutes":40}]""",
                status = "proposed",
                effect = effect(""""lessonsAdded":4,"endDateBefore":"2027-01-31","endDateAfter":"2027-01-10""""),
            ),
            planChange(
                operations = """[{"kind":"addLightWeek","startDate":"2026-11-02"}]""",
                status = "proposed",
                effect = effect(""""lessonsRemoved":3,"lessonsLeftOut":["Sets","Tuples","Loops"]"""),
            ),
            planChange(
                operations = """[{"kind":"setTargetDate","targetDate":"2026-11-30"}]""",
                status = "proposed",
                extra = """"officialDate":{"date":"2026-11-08","source":null}""",
            ),
            planChange(operations = """[{"kind":"setDailyMinutes","minutes":40}]""", extra = """"todaySession":"changed""""),
            planChange(operations = """[{"kind":"setDailyMinutes","minutes":20}]""", status = "declined"),
            planChange(operations = """[{"kind":"setDailyMinutes","minutes":30}]""", status = "replaced"),
        ).mapIndexed { index, change ->
            // Each change its own, as the server's are, so only the newest proposal is the one still asked.
            turn("c$index", TutorTurn.Status.Completed, "Here.").copy(planChange = change.copy(id = java.util.UUID(0, index + 1L)))
        }

    private fun capture(
        name: String,
        dark: Boolean,
        turns: List<TutorTurn> =
            OFFERS.mapIndexed {
                index,
                json,
                ->
                turn("offer$index", TutorTurn.Status.Completed, "Here.", toolOffer = offer(json))
            },
        refusal: ApiException? = null,
    ) {
        val vm = viewModel(turns, refusal)
        compose.setContent {
            ZoonkTheme(darkTheme = dark) { Surface { TutorPanel(vm, TutorAccess.Ask, TutorIdentity("Zu", BuddyLook()), ROUTES) } }
        }
        compose.onNode(hasSetTextAction()).performTextInput("I like space")
        compose.onNodeWithContentDescription("Send").performClick()
        write(name)
    }

    private fun viewModel(
        turns: List<TutorTurn>,
        refusal: ApiException? = null,
    ): TutorViewModel {
        val api = FakeTutorApi()
        api.thread = TutorThread(turns, hasMore = false, nextCursor = null)
        api.refusal = refusal
        api.answers = {
            flow {
                emit(TutorAnswerEvent.Text("Noted: you like space."))
                emit(TutorAnswerEvent.Finish)
                emit(
                    TutorAnswerEvent.Remembered(listOf(remembered("Likes space", "Likes the ocean"), remembered("Studies at night", null))),
                )
            }
        }
        val session = FakeSession(AuthenticatedSession("ana", "token-a", "local-a"))
        val cache = AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main))
        return TutorViewModel(
            TutorScope.Plan("goal", "conversation"),
            TutorStore(api, cache, session, {
                MutationResult.Done(Unit)
            }, { _, _ ->
                MutationResult.Done(
                    Unit,
                )
            }, { _, _ -> MutationResult.Done(Unit) }, { true }) { _, _, _ -> MutationResult.Obsolete },
            SavedStateHandle(),
        ) { MutationResult.Obsolete }
    }

    private fun offer(json: String) = ApiJson.decodeFromString<TutorToolOffer>(json)

    private fun remembered(
        statement: String,
        previous: String?,
    ) = TutorMemoryChange(
        action = if (previous == null) TutorMemoryChange.Action.Added else TutorMemoryChange.Action.Replaced,
        fact = TutorMemoryChange.Fact(UUID.randomUUID(), statement),
        previous = previous?.let { TutorMemoryChange.Fact(UUID.randomUUID(), it) },
    )

    private companion object {
        val ROUTES =
            TutorRoutes(
                createAccount = {},
                signIn = {},
                subscribe = {},
                open = {},
                startCall = callStarter { CallStart.Failed },
            )

        const val ID = "6a1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f"

        val OFFERS =
            listOf(
                """{"kind":"startGoal","access":"open","goal":"Learn Spanish for a trip to Mexico","course":""" +
                    """{"id":"$ID","brandSlug":"zoonk","slug":"spanish","title":"Spanish basics",""" +
                    """"description":"Greetings, numbers and ordering food, for your first trip.","imageUrl":null}}""",
                """{"kind":"startGoal","access":"plusRequired","goal":"Pass the ENEM","course":null}""",
                """{"kind":"chapterTest","chapterId":"$ID","chapterTitle":"Cell biology","goalId":"$ID","lessonsLeft":6}""",
                """{"kind":"chooseFocus","goalId":"$ID"}""",
                """{"kind":"conversationCall","chapterId":"$ID","goalId":"$ID","unitTitle":"At the café",""" +
                    """"call":{"character":{"name":"Lucía","role":"a barista"},"defaultMinutes":3,"limit":null,""" +
                    """"minutes":[3],"paused":false,"plusMinutes":[5,10]}}""",
                """{"kind":"mockExam","access":"open","goalId":"$ID","subjects":["Math"]}""",
                """{"kind":"mockExam","access":"plusRequired","goalId":"$ID","subjects":[]}""",
                """{"kind":"essay","access":"open","cadence":"weekly","goalId":"$ID","subject":"Essay","subjectKey":"essay"}""",
                """{"kind":"essay","access":"plusRequired","cadence":"finalWeeks","goalId":"$ID","subject":"Essay","subjectKey":"essay"}""",
                """{"kind":"mistakes","goalId":"$ID","open":4}""",
                """{"kind":"pronunciation","count":3,"goalId":"$ID","words":["perro","ferrocarril","arroz"]}""",
                """{"kind":"stats"}""",
                """{"kind":"logbook"}""",
                """{"kind":"memory"}""",
                """{"kind":"plus","subscribed":false}""",
            )
    }
}
