package com.zoonk.android.feature.exam

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.data.WritingRuns
import com.zoonk.android.feature.mock.MockApi
import com.zoonk.api.ApiJson
import com.zoonk.api.models.ExamResult
import com.zoonk.api.models.ExamView
import com.zoonk.api.models.MockOptions
import com.zoonk.api.models.MockWriting
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonObject
import java.util.UUID
import kotlin.time.Clock

val GOAL: UUID = UUID.fromString("6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1a01")
const val BLOCK = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1a03"
const val PLAN_ITEM = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1a04"

/** An exam a few weeks away with nothing taken yet; [extra]'s top-level fields replace or add to it. */
fun exam(extra: String): ExamView {
    val base =
        ApiJson
            .parseToJsonElement(
                """
                {"calibration":null,"checklist":[],"cutoff":null,"dayBefore":"learn",
                 "days":[{"date":"2026-11-08","label":null,"startTime":"13:30"}],"daysEstimated":false,"daysLeft":10,
                 "estimate":null,"examDocument":"notice","examName":"ENEM","format":[],"goalId":"$GOAL","map":null,
                 "mocks":[],"mocksRequirePlus":false,"namedMonth":false,"nextMock":null,"noSitting":null,"noticeDay":null,
                 "passMarks":null,"prepared":false,"progress":null,"result":null,"runningMocks":[],
                 "scoring":{"method":"irt","note":null,"noticeScale":null,"rule":"irt","scale":null,"stated":true,"wrongPenalty":0},
                 "sessionsDone":12,"speaking":null,"speakingMock":null,"speakingMockPaused":false,"stage":"preparing",
                 "targetScore":null,"timeZone":"America/Sao_Paulo","tools":[]}
                """.trimIndent(),
            ).jsonObject
    val fields = if (extra.isEmpty()) emptyMap() else ApiJson.parseToJsonElement("{$extra}").jsonObject
    return ApiJson.decodeFromJsonElement<ExamView>(JsonObject(base + fields))
}

fun mockOptions(extra: String): MockOptions {
    val base =
        ApiJson
            .parseToJsonElement(
                """
                {"access":"open","examDocument":"notice","examName":"ENEM","goalId":"$GOAL","lastMock":null,
                 "options":[{"area":null,"day":1,"kind":"full","areas":[],"covers":null,"estimatedMinutes":300,"leftOut":[],
                  "minutes":330,"objectiveOnly":false,"questions":90,"written":[]}],
                 "placement":null,"requested":null,"running":null,"sizeSource":{"formats":null,"material":false,"pastEdition":null,"questions":"notice","subjects":null,"time":"notice"}}
                """.trimIndent(),
            ).jsonObject
    val fields = if (extra.isEmpty()) emptyMap() else ApiJson.parseToJsonElement("{$extra}").jsonObject
    return ApiJson.decodeFromJsonElement<MockOptions>(JsonObject(base + fields))
}

class FakeExamApi(
    private val exam: ExamView?,
) : ExamApi {
    override suspend fun exam(
        session: AuthenticatedSession,
        goalId: UUID,
        timeZone: String,
    ): ExamView? = exam

    override suspend fun report(
        session: AuthenticatedSession,
        goalId: UUID,
        report: ExamResultReport,
        timeZone: String,
    ): ExamResult = ExamResult(report.maxScore, report.passed, Clock.System.now(), report.scale, report.score)
}

/** [writing] is what the wait on a preparing mock finds, nothing by default; [runs] the runs it follows. */
class FakeMockApi(
    private val options: MockOptions?,
    private val writing: MockWriting = MockWriting(generationId = null, status = MockWriting.Status.NONE),
    private val runs: GenerationSource = WritingRuns(),
) : MockApi {
    override suspend fun options(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = options ?: throw ApiException(ApiError.NotFound)

    override suspend fun writing(
        session: AuthenticatedSession,
        goalId: UUID,
        planItemId: UUID?,
    ) = writing

    override fun generations(session: AuthenticatedSession?) = runs
}
