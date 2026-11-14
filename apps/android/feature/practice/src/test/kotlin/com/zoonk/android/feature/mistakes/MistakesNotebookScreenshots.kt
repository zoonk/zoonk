package com.zoonk.android.feature.mistakes

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.material3.Surface
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.testing.captureRender
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
 * `./gradlew :feature:practice:testDebugUnitTest --tests '*MistakesNotebookScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class MistakesNotebookScreenshots {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
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
        format: String? = null,
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
        "snapshot":{"answer":"$answer","correctAnswer":"$correct",${format?.let {
        "\"format\":\"$it\","
    } ?: ""}"question":"$question"${explanation?.let {
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

    /** Math, a long formula, a number, a typed name and a true/false answer, as #2770 draws them. */
    private val mathNotebook: MistakeList =
        ApiJson.decodeFromString(
            MistakeList.serializer(),
            """{"availability":{"ready":5,"tomorrow":0},"counts":{"byCause":{"gap":2,"guess":0,"misread":1,"time":0,"trap":2,"unsorted":0},
            "fixed":0,"open":5},"data":[
              ${mistake(
                1,
                "trap",
                "Equações",
                "Quais são as raízes de \$x^2 - 5x + 6 = 0\$?",
                "\$x = 1\$ e \$x = 6\$",
                "\$x = 2\$ e \$x = 3\$",
                "Fatorando, \$(x - 2)(x - 3) = 0\$.",
                format = "multipleChoice",
            )},
              ${mistake(
                2,
                "gap",
                "Equações",
                "Qual é a fórmula de Bhaskara?",
                "\$x = \\\\frac{-b \\\\pm \\\\sqrt{b^2 + 4ac}}{2a}\$",
                "\$x = \\\\frac{-b \\\\pm \\\\sqrt{b^2 - 4ac}}{2a} \\\\text{, com } a \\\\neq 0 \\\\text{ e } \\\\Delta = b^2 - 4ac \\\\geq 0\$",
                format = "multipleChoice",
            )},
              ${mistake(4, "misread", "Porcentagem", "Qual é 10% de \$250\$?", "2,5", "25", format = "numeric")},
              ${mistake(5, "gap", "Python", "Que método inicia um objeto em Python?", "init", "__init__", format = "typed")},
              ${mistake(6, "trap", "Porcentagem", "\$25\\\\%\$ de \$80\$ é \$25\$.", "true", "false", format = "trueFalse")}],
            "pagination":{"hasMore":false,"nextCursor":null},"trueFalseLabels":"trueFalse"}""",
        )

    private val pattern: GoalMistakePattern =
        ApiJson.decodeFromString(
            GoalMistakePattern.serializer(),
            """{"pattern":{"id":"00000000-0000-4000-8000-0000000000f1","kind":"pattern","title":"Ser and estar with places"}}""",
        )

    private fun show(
        name: String,
        dark: Boolean = false,
        fold: Boolean = false,
        page: MistakeList = notebook,
        expand: String? = null,
    ) {
        val session = FakeSession(AuthenticatedSession(ANA, "token", "local"))
        val api =
            object : NotebookApi {
                override suspend fun page(
                    session: AuthenticatedSession,
                    key: NotebookKey,
                    cursor: String?,
                    timeZone: String,
                ) = page

                override suspend fun pattern(
                    session: AuthenticatedSession,
                    goalId: UUID,
                ) = pattern
            }
        val store =
            MistakesNotebookStore(api, AppCache(session, CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)), session) { "UTC" }
        rule.setContent { ZoonkTheme(darkTheme = dark) { Surface { Notebook(goalId, "ENEM 2026", store, rememberAppNavigator()) } } }
        if (fold) unfold()
        rule.mainClock.advanceTimeBy(1_000)
        rule.waitForIdle()
        expand?.let {
            rule.onNodeWithText(it).performClick()
            rule.mainClock.advanceTimeBy(1_000)
            rule.waitForIdle()
        }
        val bitmap = rule.onRoot().captureRender().asAndroidBitmap()
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
    @Config(qualifiers = "w700dp-h1000dp-xhdpi")
    fun medium() = show("medium")

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun book() = show("book", fold = true)

    @Test
    @Config(qualifiers = "w707dp-h823dp-xhdpi")
    fun smallBook() = show("small-book", fold = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-night-xhdpi")
    fun bookDark() = show("book-dark", dark = true, fold = true)

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun bookLargeFont() {
        RuntimeEnvironment.setFontScale(2f)
        show("book-font200", fold = true)
    }

    @Test
    @Config(qualifiers = "w707dp-h823dp-xhdpi")
    fun smallBookLargeFont() {
        RuntimeEnvironment.setFontScale(2f)
        show("small-book-font200", fold = true)
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tablet() = show("tablet")

    @Test
    @Config(qualifiers = "w411dp-h2600dp-xxhdpi")
    fun phoneMath() = show("notebook-math-phone", page = mathNotebook, expand = "Porcentagem")

    @Test
    @Config(qualifiers = "w411dp-h2600dp-night-xxhdpi")
    fun phoneMathDark() = show("notebook-math-phone-dark", dark = true, page = mathNotebook, expand = "Porcentagem")

    @Test
    @Config(qualifiers = "w360dp-h2800dp-xxhdpi")
    fun narrowPhoneMath() = show("notebook-math-narrow", page = mathNotebook, expand = "Porcentagem")

    @Test
    @Config(qualifiers = "w1280dp-h1800dp-night-xhdpi")
    fun tabletMathDark() = show("notebook-math-tablet-dark", dark = true, page = mathNotebook, expand = "Porcentagem")

    /** Opens the book flat, telling again what the fold composed, as a device tells every new reader. */
    private fun unfold() =
        repeat(2) {
            rule.waitForIdle()
            folds.overrideWindowLayoutInfo(
                TestWindowLayoutInfo(
                    listOf(
                        FoldingFeature(rule.activity, state = FoldingFeature.State.FLAT, orientation = FoldingFeature.Orientation.VERTICAL),
                    ),
                ),
            )
        }
}
