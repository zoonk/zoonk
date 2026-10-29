package com.zoonk.android.feature.exam

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.material3.Surface
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.app.AppContainer
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.android.feature.mock.MockStore
import com.zoonk.android.feature.plan.FakePlanApi
import com.zoonk.android.feature.plan.PlanStore
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
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
import kotlin.time.Clock
import kotlin.time.Duration.Companion.minutes

/** Review screenshots of the exam page, written only with `-Pzoonk.shots=<folder>`. No goldens. */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class ExamScreenshots {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    @Test
    @Config(qualifiers = "w411dp-h2600dp-xxhdpi")
    fun phone() = capture("exam-phone")

    @Test
    @Config(qualifiers = "w411dp-h2600dp-night-xxhdpi")
    fun phoneDarkMoreContrast() = capture("exam-phone-dark-more-contrast", dark = true, moreContrast = true)

    @Test
    @Config(qualifiers = "w411dp-h5200dp-xhdpi")
    fun phoneAtTwiceTheFontSize() {
        RuntimeEnvironment.setFontScale(2f)
        capture("exam-phone-font200")
    }

    @Test
    @Config(qualifiers = "de-w411dp-h2800dp-xxhdpi")
    fun phoneInGerman() = capture("exam-phone-de")

    @Test
    @Config(qualifiers = "w411dp-h1800dp-xxhdpi")
    fun afterTheExamOnFree() = capture("exam-phone-after-free", exam = AFTER_EXAM_FREE)

    @Test
    @Config(qualifiers = "w411dp-h1800dp-xxhdpi")
    fun theDayBefore() = capture("exam-phone-day-before", exam = DAY_BEFORE)

    @Test
    @Config(qualifiers = "w700dp-h2400dp-xhdpi")
    fun medium() = capture("exam-medium")

    @Test
    @Config(qualifiers = "w1280dp-h1400dp-land-xhdpi")
    fun expanded() = capture("exam-expanded")

    @Test
    @Config(qualifiers = "w1280dp-h1400dp-land-night-xhdpi")
    fun expandedDark() = capture("exam-expanded-dark", dark = true)

    private fun capture(
        name: String,
        dark: Boolean = false,
        moreContrast: Boolean = false,
        exam: String = PREPARING,
    ) {
        val api = FakeExamApi(exam(exam))
        val mocks =
            FakeMockApi(
                mockOptions(
                    when (exam) {
                        AFTER_EXAM_FREE -> """"access":"plusRequired""""
                        PREPARING -> """"running":{"id":"$BLOCK","purpose":"practice","shape":$MATHEMATICS}"""
                        else -> ""
                    },
                ),
            )
        compose.setContent {
            val context = LocalContext.current
            val app = remember { AppContainer.preview(context) }
            val cache =
                remember {
                    AppCache(
                        FakeSession(AuthenticatedSession("ana", "token", "local")),
                        CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
                    )
                }
            ZoonkTheme(darkTheme = dark, moreContrast = moreContrast) {
                Surface {
                    GoalExam(
                        goalId = GOAL,
                        app = app,
                        navigator = rememberAppNavigator(),
                        exams = remember { ExamStore(api, cache) { "UTC" } },
                        mockStore = remember { MockStore(mocks, cache) },
                        plans = remember { PlanStore(FakePlanApi(), cache) },
                    )
                }
            }
        }
        compose.waitForIdle()
        write(name, compose.onRoot().captureToImage().asAndroidBitmap())
    }

    private fun write(
        name: String,
        bitmap: Bitmap,
    ) {
        val file = File(folder, "$name.png").apply { parentFile?.mkdirs() }
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private companion object {
        val PREPARING =
            """
            "stage":"finalStretch","daysEstimated":true,"daysLeft":24,
            "days":[{"date":"2026-11-08","label":null,"startTime":"13:30"},{"date":"2026-11-15","label":null,"startTime":"13:30"}],
            "noticeDay":{"date":"2026-11-15","estimated":true},
            "nextMock":{"date":"2026-11-01","fullLength":true,"planItemId":"$PLAN_ITEM","questions":90},
            "runningMocks":[{"answered":12,"deadline":"${Clock.System.now() + 80.minutes}","id":"$BLOCK","number":3,"purpose":"practice","questions":45,
             "shape":{"area":"Mathematics","day":null,"kind":"area"}}],
            "mocks":[{"blockId":"$BLOCK","correct":52,"examQuestions":180,"finishedAt":"2026-10-20T15:00:00Z","measure":52,"number":2,
              "purpose":"practice","scoring":"irt","shape":{"area":null,"day":1,"kind":"full"},"total":90},
             {"blockId":null,"correct":36.5,"examQuestions":null,"finishedAt":"2026-10-01T15:00:00Z","measure":36.5,"number":1,
              "purpose":"placement","scoring":"irt","shape":null,"total":90}],
            "progress":{"improved":["Mathematics"],"needsWork":["Languages"],
             "subjects":[{"change":12,"name":"Mathematics","percents":[40,52]},{"change":-3,"name":"Languages","percents":[48,45]},
              {"change":null,"name":"Natural Sciences","percents":[38]}],
             "mocks":[{"finishedAt":"2026-10-01T15:00:00Z","number":1,"percent":41,"purpose":"placement","shape":null},
              {"finishedAt":"2026-10-20T15:00:00Z","number":2,"percent":58,"purpose":"practice","shape":{"area":null,"day":1,"kind":"full"}}]},
            "format":[{"date":"2026-11-08","day":1,"minutes":330,"parts":[{"name":"Languages","questions":45,"written":false},
              {"name":"Human Sciences","questions":45,"written":false},{"name":"Essay","questions":null,"written":true}]},
             {"date":"2026-11-15","day":2,"minutes":300,"parts":[{"name":"Mathematics","questions":45,"written":false},
              {"name":"Natural Sciences","questions":45,"written":false}]}],
            "cutoff":{"course":"Medicine","edition":"2025","institution":"USP","maxScore":1000,"position":null,"quota":null,"score":812.4,
             "source":{"title":"SISU","url":"https://www.sisu.mec.gov.br/cutoffs"}},
            "targetScore":"Medicine at USP"
            """.trimIndent()

        const val MATHEMATICS = """{"area":"Mathematics","day":null,"kind":"area"}"""

        val DAY_BEFORE =
            """
            "stage":"dayBefore","daysLeft":1,"dayBefore":"review","sessionsDone":42,"prepared":true,
            "checklist":["documents","blackPen","route","sleep"],"tools":["A basic calculator"]
            """.trimIndent()

        val AFTER_EXAM_FREE =
            """
            "stage":"afterExam","daysLeft":-2,"mocksRequirePlus":true,
            "scoring":{"method":"net","note":null,"noticeScale":{"max":120,"min":-120,"name":null,"passScore":60},"rule":"net",
             "scale":null,"stated":true,"wrongPenalty":1},
            "calibration":{"advice":"blankUnsure","blankingGain":2,"sure":{"answered":40,"right":34},"unsure":{"answered":12,"right":5}},
            "passMarks":{"language":"pt","texts":["Pelo menos 60 pontos líquidos."]}
            """.trimIndent()
    }
}
