package com.zoonk.android.feature.tutor

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.material3.Surface
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.ui.characters.BuddyLook
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.TutorToolOffer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.flow
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
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
    @Config(qualifiers = "w411dp-h4200dp-xhdpi")
    fun offers() = capture("tutor-offers", dark = false)

    @Test
    @Config(qualifiers = "w411dp-h4200dp-night-xhdpi")
    fun offersDark() = capture("tutor-offers-dark", dark = true)

    @Test
    @Config(qualifiers = "w411dp-h8000dp-xhdpi")
    fun offersAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("tutor-offers-font200", dark = false)
    }

    private fun capture(
        name: String,
        dark: Boolean,
    ) {
        val api = FakeTutorApi()
        val turns = OFFERS.mapIndexed { index, json -> turn("q$index", TutorTurn.Status.Completed, "Here.", toolOffer = offer(json)) }
        api.thread = TutorThread(turns, hasMore = false, nextCursor = null)
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
        val vm = TutorViewModel(TutorScope.Plan("goal"), TutorStore(api, cache, session) { true })
        val routes = TutorRoutes(createAccount = {}, signIn = {}, seePlus = {}, open = {})

        compose.setContent {
            ZoonkTheme(darkTheme = dark) { Surface { TutorPanel(vm, TutorAccess.Ask, TutorIdentity("Zu", BuddyLook()), routes) } }
        }
        compose.onNode(hasSetTextAction()).performTextInput("I like space")
        compose.onNodeWithContentDescription("Send").performClick()
        compose.waitForIdle()

        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use {
            compose
                .onRoot()
                .captureToImage()
                .asAndroidBitmap()
                .compress(Bitmap.CompressFormat.PNG, 100, it)
        }
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
