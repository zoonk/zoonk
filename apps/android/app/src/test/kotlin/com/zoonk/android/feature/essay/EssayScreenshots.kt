package com.zoonk.android.feature.essay

import android.graphics.Bitmap
import androidx.activity.ComponentActivity
import androidx.compose.runtime.getValue
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.test.performClick
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.data.ANA
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.practice.UnusedSessionSteps
import com.zoonk.android.navigation.rememberAppNavigator
import com.zoonk.android.ui.theme.ZoonkTheme
import com.zoonk.api.ApiJson
import com.zoonk.api.models.Essay
import com.zoonk.api.models.EssayGrade
import com.zoonk.api.models.EssaySubmissionInput
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.awaitCancellation
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.builtins.serializer
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
import java.util.UUID

/**
 * Review screenshots of the essay, written only on demand:
 * `./gradlew :app:testDebugUnitTest --tests '*EssayScreenshots*' --rerun -Pzoonk.shots=<folder>`.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class EssayScreenshots {
    @get:Rule
    val rule = createAndroidComposeRule<ComponentActivity>()

    @get:Rule
    val drafts = TemporaryFolder()

    private val folder = System.getProperty("zoonk.shots").orEmpty()

    @Before
    fun onlyOnDemand() = assumeTrue("Pass -Pzoonk.shots=<folder> to write them", folder.isNotEmpty())

    private val texts =
        "Texto I\n\nA mobilidade urbana no Brasil enfrenta desafios históricos: o crescimento desordenado das cidades, " +
            "a prioridade dada ao transporte individual e a falta de integração entre os modais. Em muitas capitais, o tempo " +
            "médio de deslocamento ultrapassa uma hora por dia.\n\nTexto II\n\nSegundo o IBGE, mais de 80% da população vive " +
            "em áreas urbanas, o que pressiona o transporte público, a infraestrutura viária e a qualidade do ar."

    private fun grade(tooShort: Boolean = false): String =
        """{"criteria":[
          {"comment":"Few slips in agreement.","example":null,"id":"c1","maxScore":200,"name":"c1","quote":null,"score":160},
          {"comment":"On topic, with one outside reference.","example":null,"id":"c2","maxScore":200,"name":"c2","quote":null,"score":160},
          {"comment":"The claims stand without support.","example":"Cite a figure from the IBGE.","id":"c3","maxScore":200,"name":"c3",
           "quote":"Isso acontece porque as cidades cresceram.","score":120},
          {"comment":"Good connectives.","example":null,"id":"c4","maxScore":200,"name":"c4","quote":null,"score":160},
          {"comment":"The proposal lacks its means and detail.","example":null,"id":"c5","maxScore":200,"name":"c5","quote":null,"score":120}],
        "enemInterventionElements":{"action":true,"agent":true,"detail":false,"effect":true,"means":false},
        "nextStep":{"criterionId":"c3","text":"Back each claim with a fact or a figure, then say why it matters."},
        "range":{"high":760,"low":680},"total":{"maxScore":1000,"score":720},"zeroReason":${if (tooShort) "\"tooShort\"" else "null"}}"""

    private fun essay(
        drafted: Boolean,
        tooShort: Boolean,
    ): Essay {
        val drafts =
            if (drafted) {
                """[{"grade":${grade(
                    tooShort,
                )},"submittedAt":"2026-10-30T10:00:00Z","text":"As cidades brasileiras cresceram sem planejamento."}]"""
            } else {
                "[]"
            }
        return ApiJson.decodeFromString(
            Essay.serializer(),
            """{"blockId":"00000000-0000-4000-8000-0000000000b1","context":${ApiJson.encodeToString(String.serializer(), texts)},
            "drafts":$drafts,"gradesLeft":3,"question":"Escreva uma redação sobre os desafios da mobilidade urbana no Brasil.",
            "rubric":"enem","sessionId":"00000000-0000-4000-8000-0000000000e1","status":"active"}""",
        )
    }

    private fun show(
        name: String,
        drafted: Boolean = false,
        tooShort: Boolean = false,
        text: String = "",
        grading: Boolean = false,
        rewrite: Boolean = false,
        secondStep: Boolean = false,
    ) {
        val read = essay(drafted, tooShort)
        val api =
            object : EssayApi {
                override suspend fun essay(
                    session: AuthenticatedSession,
                    blockId: UUID,
                    timeZone: String,
                ) = read

                override suspend fun submit(
                    session: AuthenticatedSession,
                    blockId: UUID,
                    input: EssaySubmissionInput,
                ): EssayGrade = awaitCancellation()

                override suspend fun finish(
                    session: AuthenticatedSession,
                    sessionId: UUID,
                    blockId: UUID,
                    timeZone: String,
                ) = error("Not used")
            }
        val cache =
            AppCache(
                FakeSession(AuthenticatedSession(ANA, "token", "local")),
                CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
            )
        val store = EssayStore(api, cache, DraftStore(drafts.root, CoroutineScope(SupervisorJob()))) { "UTC" }
        val viewModel = EssayViewModel(read.blockId, read.sessionId, store, null, UnusedSessionSteps)
        runBlocking { viewModel.essay.refresh() }
        viewModel.arrive((viewModel.essay.state.value as LoadState.Loaded<*>).value as Essay)
        rule.waitForIdle()
        if (rewrite) viewModel.rewrite()
        if (text.isNotEmpty()) viewModel.write(text)
        if (grading) viewModel.send()

        rule.setContent {
            ZoonkTheme {
                val ui by viewModel.ui.collectAsStateWithLifecycle()
                val navigator = rememberAppNavigator()
                val grade = ui.grade
                if (ui.mode == EssayMode.Grade && grade != null) {
                    EssayGradeSteps(
                        read,
                        grade,
                        finished = false,
                        announce = false,
                        finishing = false,
                        finishFailed = false,
                        viewModel,
                        navigator,
                    )
                } else {
                    EssayWrite(read, ui, finishing = false, finishFailed = false, viewModel, navigator)
                }
            }
        }
        rule.mainClock.advanceTimeBy(1_000)
        if (secondStep) rule.onNodeWithText("Continue").performClick()
        write(name)
    }

    private fun write(name: String) {
        rule.waitForIdle()
        val bitmap = rule.onRoot().captureToImage().asAndroidBitmap()
        File(folder, "$name.png").apply { parentFile?.mkdirs() }.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneWrite() = show("phone-write", text = "A mobilidade urbana é um dos maiores desafios das cidades brasileiras.")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneGrading() = show("phone-grading", text = "A mobilidade urbana é um desafio.", grading = true)

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletWrite() = show("tablet-write", text = "A mobilidade urbana é um dos maiores desafios das cidades brasileiras.")

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneGrade() = show("phone-grade", drafted = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneNextStep() = show("phone-next-step", drafted = true, secondStep = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneNextStepLargeFont() {
        RuntimeEnvironment.setFontScale(2f)
        show("phone-next-step-font200", drafted = true, secondStep = true)
    }

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletGrade() = show("tablet-grade", drafted = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneRewrite() = show("phone-rewrite", drafted = true, rewrite = true)

    @Test
    @Config(qualifiers = "w1280dp-h800dp-land-xhdpi")
    fun tabletRewrite() = show("tablet-rewrite", drafted = true, rewrite = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneTooShort() = show("phone-too-short", drafted = true, tooShort = true)

    @Test
    @Config(qualifiers = "w411dp-h891dp-xxhdpi")
    fun phoneRewriteTooShort() = show("phone-rewrite-too-short", drafted = true, tooShort = true, rewrite = true)
}
