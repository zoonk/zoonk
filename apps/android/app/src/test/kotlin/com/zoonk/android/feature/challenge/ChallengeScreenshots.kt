package com.zoonk.android.feature.challenge

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.GenerationEvent
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.Challenge
import com.zoonk.api.models.ChallengeGeneration
import com.zoonk.api.models.ChallengeMove
import com.zoonk.api.models.ChallengeMoveUndo
import com.zoonk.api.models.ChallengeStart
import com.zoonk.api.models.Generation
import com.zoonk.api.models.StudyBlockStart
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.emptyFlow
import kotlinx.datetime.LocalDate
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File
import java.util.UUID

/**
 * Review screenshots of the challenge intro, written only on demand:
 * `./gradlew :app:testDebugUnitTest --tests '*ChallengeScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ChallengeScreenshots {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    private fun show(
        name: String,
        vararg fields: Pair<String, Any?>,
        moved: Boolean = false,
    ) {
        val challenge: Challenge = decodeFixture("challenge", *fields)
        val api =
            object : ChallengeApi {
                override suspend fun challenge(
                    session: AuthenticatedSession,
                    planItemId: UUID,
                    timeZone: String,
                ) = challenge

                override suspend fun start(
                    session: AuthenticatedSession,
                    planItemId: UUID,
                    input: StudyBlockStart,
                ): ChallengeStart = error("Not used")

                override suspend fun writeQuestions(
                    session: AuthenticatedSession,
                    planItemId: UUID,
                ): ChallengeGeneration = error("Not used")

                override suspend fun move(
                    session: AuthenticatedSession,
                    planItemId: UUID,
                    timeZone: String,
                ) = ChallengeMove(UUID.randomUUID(), LocalDate(2026, 11, 2), leftOutEffect, null)

                override suspend fun undoMove(
                    session: AuthenticatedSession,
                    planItemId: UUID,
                    changeId: UUID,
                    timeZone: String,
                ) = ChallengeMoveUndo(planItemId)
            }
        val source =
            object : GenerationSource {
                override fun events(id: String) = emptyFlow<GenerationEvent>()

                override suspend fun status(id: String) = Generation.Status.RUNNING
            }
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession(ANA, "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val viewModel = ChallengeViewModel(challenge.planItemId, null, ChallengeStore(api, cache) { "UTC" }, source)
        if (moved) viewModel.moveToMonday()

        rule.setContent {
            ZoonkTheme {
                val ui by viewModel.ui.collectAsStateWithLifecycle()
                ChallengeView(challenge, ui, viewModel, rememberAppNavigator(), null)
            }
        }
        rule.waitForIdle()
        val bitmap = rule.onRoot().captureToImage().asAndroidBitmap()
        File(folder, "$name.png").apply { parentFile?.mkdirs() }.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private val leftOutEffect =
        com.zoonk.api.ApiJson.decodeFromString(
            com.zoonk.api.models.PlanEffect
                .serializer(),
            """{"endDateAfter":"2026-12-04","endDateBefore":"2026-12-04","lessonsAdded":0,"lessonsRemoved":2,"lessonsLeftOut":["Cell respiration","Photosynthesis"]}""",
        )

    private val sections =
        JsonArray(
            listOf(
                JsonObject(
                    mapOf(
                        "index" to JsonPrimitive(0),
                        "minutes" to JsonPrimitive(150),
                        "name" to JsonPrimitive("Linguagens"),
                        "questions" to JsonPrimitive(45),
                        "tools" to JsonNull,
                    ),
                ),
                JsonObject(
                    mapOf(
                        "index" to JsonPrimitive(1),
                        "minutes" to JsonPrimitive(150),
                        "name" to JsonPrimitive("Humanas"),
                        "questions" to JsonPrimitive(45),
                        "tools" to JsonNull,
                    ),
                ),
            ),
        )

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneTrickster() = show("phone-trickster")

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletTrickster() = show("tablet-trickster")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneWeekly() = show("phone-weekly", "kind" to "weekly", "startTime" to "09:00", "date" to "2026-10-31", "passMark" to null)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneMock() =
        show(
            "phone-mock",
            "mock" to true,
            "number" to 3,
            "examName" to "ENEM",
            "minutes" to 300,
            "questions" to 90,
            "netScored" to false,
            "sections" to sections,
            "topics" to JsonArray(emptyList()),
            "passMark" to null,
            "date" to "2026-11-01",
        )

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phonePlusRequired() = show("phone-plus", "status" to "plusRequired")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneTried() =
        show(
            "phone-tried",
            "status" to "tried",
            "reinforcementLessons" to 2,
            "blockId" to "7b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
        )

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneUpcoming() = show("phone-upcoming", "status" to "upcoming", "date" to "2026-11-04")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneUsedUp() = show("phone-used-up", "dailyLimitReached" to true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneMoved() = show("phone-moved", moved = true)
}
