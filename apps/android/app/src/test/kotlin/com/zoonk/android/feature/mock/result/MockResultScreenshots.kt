package com.zoonk.android.feature.mock.result

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.material3.Surface
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.isDialog
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
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
    @get:Rule
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
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun expanded() {
        show(enem())
        capture("result-expanded")
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
                Surface { MockScreen(AppRoute.Mock(RUN_BLOCK), app, rememberAppNavigator(), store) }
            }
        }
        compose.waitForIdle()
        return api
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
        const val STATEMENT =
            """{"area":"Mathematics","citation":null,"context":null,"correctAnswer":"false","explanation":"Zero is even.",
            "format":"trueFalse","itemId":"$ITEM_TWO","learnerAnswer":"true","number":2,"outcome":"wrong",
            "question":"Zero is an odd number.","set":null}"""
    }
}
