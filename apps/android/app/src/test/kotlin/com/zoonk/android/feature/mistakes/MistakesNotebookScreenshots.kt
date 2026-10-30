package com.zoonk.android.feature.mistakes

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.material3.Surface
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.GoalMistakePattern
import com.zoonk.api.models.MistakeList
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
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
 * Review screenshots of the mistakes notebook, written only on demand:
 * `./gradlew :app:testDebugUnitTest --tests '*MistakesNotebookScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class MistakesNotebookScreenshots {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()
    private val goalId = UUID.fromString("00000000-0000-4000-8000-0000000000a1")

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    private fun mistake(
        id: Int,
        cause: String?,
        skill: String?,
        question: String,
        answer: String,
        correct: String,
        explanation: String? = null,
    ) = """{"cause":${cause?.let { "\"$it\"" } ?: "null"},"createdAt":"2026-10-2${id}T12:00:00Z","fixedAt":null,
        "id":"00000000-0000-4000-8000-00000000000$id","itemId":null,
        "lesson":{"id":"00000000-0000-4000-8000-0000000000c$id","title":"Lesson"},"practiceAvailable":${id != 3},
        "practiceAvailableTomorrow":${id == 3},
        "skill":${skill?.let {
        """{"id":"00000000-0000-4000-8000-0000000000${if (it.startsWith(
                "P",
            )
        ) {
            "b1"
        } else {
            "b2"
        }}","name":"$it"}"""
    } ?: "null"},
        "snapshot":{"answer":"$answer","correctAnswer":"$correct","question":"$question"${explanation?.let {
        ""","explanation":"$it""""
    } ?: ""}},
        "status":"open"}"""

    private val notebook: MistakeList =
        ApiJson.decodeFromString(
            MistakeList.serializer(),
            """{"availability":{"ready":2,"tomorrow":1},"counts":{"byCause":{"gap":1,"guess":0,"misread":1,"time":0,"trap":1,"unsorted":0},
            "fixed":4,"open":3},"data":[
              ${mistake(
                1,
                "trap",
                "Porcentagem",
                "Uma camiseta de R$80 está com 25% de desconto. Quanto você paga?",
                "R$55",
                "R$60",
                "25% de 80 é 20, então você paga 80 − 20 = 60.",
            )},
              ${mistake(2, "misread", "Porcentagem", "Qual é 10% de 250?", "2,5", "25")},
              ${mistake(3, "gap", "Razão e proporção", "Se 3 cadernos custam R$12, quanto custam 5?", "R$15", "R$20")}],
            "pagination":{"hasMore":true,"nextCursor":"c1"},"trueFalseLabels":"trueFalse"}""",
        )

    private val pattern: GoalMistakePattern =
        ApiJson.decodeFromString(
            GoalMistakePattern.serializer(),
            """{"pattern":{"id":"00000000-0000-4000-8000-0000000000f1","kind":"pattern","title":"Ser and estar with places"}}""",
        )

    private fun show(name: String) {
        val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
        val api =
            object : NotebookApi {
                override suspend fun page(
                    session: AuthenticatedSession,
                    key: NotebookKey,
                    cursor: String?,
                    timeZone: String,
                ) = notebook

                override suspend fun pattern(
                    session: AuthenticatedSession,
                    goalId: UUID,
                ) = pattern
            }
        val store =
            MistakesNotebookStore(api, AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)), session) { "UTC" }
        rule.setContent { ZoonkTheme { Surface { Notebook(goalId, "ENEM 2026", store, rememberAppNavigator()) } } }
        rule.mainClock.advanceTimeBy(1_000)
        rule.waitForIdle()
        val bitmap = rule.onRoot().captureToImage().asAndroidBitmap()
        File(folder, "$name.png").apply { parentFile?.mkdirs() }.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phone() = show("phone")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneLargeFont() {
        RuntimeEnvironment.setFontScale(2f)
        show("phone-font200")
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tablet() = show("tablet")
}
