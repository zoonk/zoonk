package com.zoonk.android.feature.essay

import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DraftStore
import com.zoonk.android.data.FakeSession
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.practice.UnusedSessionSteps
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
import java.io.File
import java.util.UUID

private const val TEXTS =
    "Texto I\n\nA mobilidade urbana no Brasil enfrenta desafios históricos: o crescimento desordenado das cidades, " +
        "a prioridade dada ao transporte individual e a falta de integração entre os modais. Em muitas capitais, o tempo " +
        "médio de deslocamento ultrapassa uma hora por dia.\n\nTexto II\n\nSegundo o IBGE, mais de 80% da população vive " +
        "em áreas urbanas, o que pressiona o transporte público, a infraestrutura viária e a qualidade do ar."

private fun grade(tooShort: Boolean): String =
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

/** An ENEM essay, with its motivating texts when [withTexts] and one graded draft when [drafted]. */
internal fun essay(
    drafted: Boolean = false,
    tooShort: Boolean = false,
    status: String = "active",
    withTexts: Boolean = true,
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
        """{"blockId":"00000000-0000-4000-8000-0000000000b1",
        "context":${if (withTexts) ApiJson.encodeToString(String.serializer(), TEXTS) else "null"},
        "drafts":$drafts,"gradesLeft":3,"question":"Escreva uma redação sobre os desafios da mobilidade urbana no Brasil.",
        "rubric":"enem","sessionId":"00000000-0000-4000-8000-0000000000e1","status":"$status"}""",
    )
}

/** [read] arrived, over an API whose grading never answers, or refuses with [refusal]; drafts kept in [drafts]. */
internal fun essayViewModel(
    read: Essay,
    drafts: File,
    refusal: String? = null,
): EssayViewModel {
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
            ): EssayGrade = refusal?.let { throw ApiException(ApiError.Unavailable, it, status = 403) } ?: awaitCancellation()

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
    val store = EssayStore(api, cache, DraftStore(drafts, CoroutineScope(SupervisorJob()))) { "UTC" }
    val viewModel = EssayViewModel(read.blockId, read.sessionId, store, null, UnusedSessionSteps)
    runBlocking { viewModel.essay.refresh() }
    viewModel.arrive((viewModel.essay.state.value as LoadState.Loaded<*>).value as Essay)
    return viewModel
}
