package com.zoonk.android.feature.mock.result

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.material3.Surface
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.isDialog
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.compose.ui.unit.LayoutDirection
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.window.layout.FoldingFeature
import androidx.window.testing.layout.FoldingFeature
import androidx.window.testing.layout.TestWindowLayoutInfo
import androidx.window.testing.layout.WindowLayoutInfoPublisherRule
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.mock.runner.EssayGradeOutcome
import com.zoonk.android.feature.mock.runner.FakeMockRunApi
import com.zoonk.android.feature.mock.runner.ITEM_TWO
import com.zoonk.android.feature.mock.runner.MockRunStore
import com.zoonk.android.feature.mock.runner.MockScreen
import com.zoonk.android.feature.mock.runner.RUN_BLOCK
import com.zoonk.android.feature.mock.runner.runningMock
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.models.MockExam
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Review screenshots of a mock's result, written only with `-Pzoonk.shots=<folder>`. No goldens. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class MockResultScreenshots {
    @get:Rule(order = 0)
    val folds = WindowLayoutInfoPublisherRule()

    @get:Rule(order = 1)
    val compose = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val folder = TemporaryFolder()

    private val shots = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", shots.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneScore() {
        show(enem())
        capture("result-phone-1-score")
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phonePlan() {
        show(enem())
        capture("result-phone-2-plan", continues = 1)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneNext() {
        show(enem())
        capture("result-phone-3-next", continues = 2)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneReview() {
        show(enem())
        compose.onNodeWithText("See the 2 questions").performClick()
        compose.waitForIdle()
        write("result-phone-review-sheet", compose.onNode(isDialog()).captureToImage().asAndroidBitmap())
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneNet() {
        show(cebraspe())
        capture("result-phone-net")
    }

    @Test
    @Config(qualifiers = "w411dp-h1600dp-xxhdpi")
    fun phonePoints() {
        show(finishedMock(result = result(scoring = "net", extra = "$NET,$FULL_POINTS")))
        capture("result-phone-points")
    }

    @Test
    @Config(qualifiers = "w411dp-h1600dp-night-xxhdpi")
    fun phonePointsDark() {
        show(finishedMock(result = result(scoring = "net", extra = "$NET,$FULL_POINTS")), dark = true)
        capture("result-phone-points-dark")
    }

    @Test
    @Config(qualifiers = "w411dp-h1600dp-xxhdpi")
    fun phoneHalfPoints() {
        show(finishedMock(result = result(extra = HALF_POINTS), extra = HALF_SHAPE))
        capture("result-phone-points-half")
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-night-xxhdpi")
    fun phoneDarkMoreContrast() {
        show(enem(), dark = true, moreContrast = true)
        capture("result-phone-dark-more-contrast")
    }

    @Test
    @Config(qualifiers = "w411dp-h2400dp-xhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        show(enem())
        capture("result-phone-font200")
    }

    @Test
    @Config(qualifiers = "w411dp-h2400dp-xhdpi")
    fun phoneLastStepAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        show(enem())
        capture("result-phone-font200-last", continues = 2)
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun expanded() {
        show(enem())
        capture("result-expanded")
    }

    /** A placement mock that moved nothing in the plan has no aside of its own: the questions to review take the page after the fold. */
    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun openBookWithoutAside() {
        show(finishedMock(extra = """"purpose":"placement","review":[$MISSED,$STATEMENT]"""))
        unfold()
        capture("result-open-book-without-aside")
    }

    /** Nothing to review: the areas and what the mock showed stay with the score before the fold, the notes after it. */
    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun openBookPerfect() {
        show(finishedMock(result = result(extra = """"correct":3,"blank":0"""), extra = """"purpose":"placement","review":[]"""))
        unfold()
        capture("result-open-book-perfect")
    }

    @Test
    @Config(qualifiers = "w852dp-h883dp-xhdpi")
    fun openBookWithAside() {
        show(enem())
        unfold()
        capture("result-open-book-with-aside")
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun essaysGrading() {
        val api =
            show(
                runningMock(current = "null"),
                afterFinish = essaysOnly(pendingEssay()),
            )
        api.gradeGate = CompletableDeferred()
        compose.onNodeWithText("See how it went").performClick()
        capture("result-essay-grading")
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun essayLimitReached() {
        val api = show(runningMock(current = "null"), afterFinish = essaysOnly(pendingEssay()))
        api.gradeOutcome = EssayGradeOutcome.LimitReached
        compose.onNodeWithText("See how it went").performClick()
        capture("result-essay-limit")
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun essayGraded() {
        show(essaysOnly(gradedEssay()))
        capture("result-essay-graded")
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun essayNextStep() {
        show(essaysOnly(gradedEssay()))
        capture("result-essay-next-step", continues = 1)
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun speakingEstimate() {
        show(finishedMock(result = result(extra = """"total":0,"correct":0,"areas":[],"topics":[]"""), extra = """"speaking":$SPEAKING"""))
        capture("result-speaking")
    }

    @Test
    @Config(qualifiers = BOOK)
    fun bookEssayGraded() {
        show(essaysOnly(gradedEssay()))
        unfold()
        capture("result-book-essay-graded")
    }

    @Test
    @Config(qualifiers = BOOK)
    fun bookEssayNextStep() {
        show(essaysOnly(gradedEssay()))
        unfold()
        capture("result-book-essay-next-step", continues = 1)
    }

    @Test
    @Config(qualifiers = GALAXY)
    fun galaxyEssayGraded() {
        show(essaysOnly(gradedEssay()))
        unfold()
        capture("result-galaxy-essay-graded")
    }

    @Test
    @Config(qualifiers = GALAXY)
    fun galaxyEssayNextStep() {
        show(essaysOnly(gradedEssay()))
        unfold()
        capture("result-galaxy-essay-next-step", continues = 1)
    }

    @Test
    @Config(qualifiers = BOOK)
    fun bookEssayUngraded() {
        show(essaysOnly(pendingEssay()))
        unfold()
        capture("result-book-essay-ungraded")
    }

    @Test
    @Config(qualifiers = BOOK)
    fun bookSpeaking() {
        show(speakingOnly())
        unfold()
        capture("result-book-speaking")
    }

    @Test
    @Config(qualifiers = GALAXY)
    fun galaxySpeaking() {
        show(speakingOnly())
        unfold()
        capture("result-galaxy-speaking")
    }

    @Test
    @Config(qualifiers = "w852dp-h883dp-night-xhdpi")
    fun bookEssayGradedDarkMoreContrast() {
        show(essaysOnly(gradedEssay()), dark = true, moreContrast = true)
        unfold()
        capture("result-book-essay-graded-dark-more-contrast")
    }

    @Test
    @Config(qualifiers = BOOK)
    fun bookEssayGradedAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        show(essaysOnly(gradedEssay()))
        unfold()
        capture("result-book-essay-graded-font200")
    }

    @Test
    @Config(qualifiers = BOOK)
    fun bookEssayGradedRightToLeft() {
        show(essaysOnly(gradedEssay()), layoutDirection = LayoutDirection.Rtl)
        unfold()
        capture("result-book-essay-graded-rtl")
    }

    @Test
    @Config(qualifiers = MEDIUM)
    fun mediumEssayGraded() {
        show(essaysOnly(gradedEssay()))
        capture("result-medium-essay-graded")
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun expandedEssayGraded() {
        show(essaysOnly(gradedEssay()))
        capture("result-expanded-essay-graded")
    }

    @Test
    @Config(qualifiers = MEDIUM)
    fun mediumSpeaking() {
        show(speakingOnly())
        capture("result-medium-speaking")
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun expandedSpeaking() {
        show(speakingOnly())
        capture("result-expanded-speaking")
    }

    @Test
    @Config(qualifiers = BOOK)
    fun bookWithAsideRightToLeft() {
        show(enem(), layoutDirection = LayoutDirection.Rtl)
        unfold()
        capture("result-open-book-with-aside-rtl")
    }

    private fun speakingOnly() =
        finishedMock(result = result(extra = """"total":0,"correct":0,"areas":[],"topics":[]"""), extra = """"speaking":$SPEAKING""")

    private fun enem() =
        finishedMock(
            result =
                result(
                    scoring = "irt",
                    extra =
                        """$IRT,"blank":1,"coherence":{"easyWrong":2,"hardRight":1,"isCoherent":false},
                        "preparation":{"after":0.48,"before":0.41}""",
                ),
            extra =
                """"review":[$MISSED,$STATEMENT],"adapt":{"focus":{"area":"Languages","correct":0,"total":1},"skip":{"lessons":3,"topics":["Addition","Fractions"]}},
                "scoreNotes":{"noticeScoring":null,"relative":false,"scale":{"max":1000,"min":0,"name":"ENEM","passScore":null,"score":null}}""",
        )

    private fun cebraspe() =
        finishedMock(
            result =
                result(
                    scoring = "net",
                    extra =
                        """$NET,"calibration":{"advice":"blankUnsure","blankingGain":2.5,
                        "sure":{"answered":80,"right":60},"unsure":{"answered":20,"right":8}}""",
                ),
            extra =
                """"examName":"Cebraspe","scoring":"net","trueFalseLabels":"rightWrong","review":[$STATEMENT],
                "passMarks":{"language":"pt","texts":["Será eliminado o candidato que obtiver nota inferior a 10 pontos."]}""",
        )

    private fun essaysOnly(vararg essays: String) =
        finishedMock(
            result = result(extra = """"total":0,"correct":0,"areas":[],"topics":[]"""),
            extra = """"essayRubric":"enem","essays":[${essays.joinToString(",")}]""",
        )

    private fun show(
        mock: MockExam,
        afterFinish: MockExam? = null,
        dark: Boolean = false,
        moreContrast: Boolean = false,
        layoutDirection: LayoutDirection = LayoutDirection.Ltr,
    ): FakeMockRunApi {
        val api = FakeMockRunApi(mock).also { it.afterFinish = afterFinish }
        compose.setContent {
            val context = LocalContext.current
            val app = remember { AppContainer.preview(context) }
            val scope = remember { CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate) }
            val store =
                remember {
                    MockRunStore(
                        api,
                        AppCache(FakeSession(AuthenticatedSession("ana", "token", "local")), scope),
                        DraftStore(folder.root, scope),
                    ) {
                        "UTC"
                    }
                }
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                CompositionLocalProvider(LocalLayoutDirection provides layoutDirection) {
                    Surface { MockScreen(AppRoute.Mock(RUN_BLOCK), app, rememberAppNavigator(), store) }
                }
            }
        }
        compose.waitForIdle()
        return api
    }

    private fun unfold() {
        val fold = FoldingFeature(compose.activity, state = FoldingFeature.State.FLAT, orientation = FoldingFeature.Orientation.VERTICAL)
        folds.overrideWindowLayoutInfo(TestWindowLayoutInfo(listOf(fold)))
        compose.waitForIdle()
    }

    private fun capture(
        name: String,
        continues: Int = 0,
    ) {
        repeat(continues) {
            compose.onNodeWithText("Continue").performClick()
            compose.waitForIdle()
        }
        compose.waitForIdle()
        write(name, compose.onRoot().captureToImage().asAndroidBitmap())
    }

    private fun write(
        name: String,
        bitmap: Bitmap,
    ) {
        val file = File(shots, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private companion object {
        const val BOOK = "w852dp-h883dp-xhdpi"
        const val GALAXY = "w707dp-h823dp-xhdpi"
        const val MEDIUM = "w700dp-h840dp-xhdpi"
        const val STATEMENT =
            """{"area":"Mathematics","citation":null,"context":null,"correctAnswer":"false","explanation":"Zero is even.",
            "format":"trueFalse","itemId":"$ITEM_TWO","learnerAnswer":"true","number":2,"outcome":"wrong",
            "question":"Zero is an odd number.","set":null}"""
    }
}
