package com.zoonk.android.feature.exam

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.feature.mock.MockApi
import com.zoonk.api.ApiJson
import com.zoonk.api.models.ExamResult
import com.zoonk.api.models.ExamView
import com.zoonk.api.models.MockOptions
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonObject
import java.util.UUID
import kotlin.time.Clock

internal val GOAL: UUID = UUID.fromString("6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1a01")
internal const val BLOCK = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1a03"
internal const val PLAN_ITEM = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1a04"

/** An exam a few weeks away with nothing taken yet; [extra]'s top-level fields replace or add to it. */
internal fun exam(extra: String = ""): ExamView {
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

internal fun mockOptions(extra: String = ""): MockOptions {
    val base =
        ApiJson
            .parseToJsonElement(
                """
                {"access":"open","examDocument":"notice","examName":"ENEM","goalId":"$GOAL","lastMock":null,
                 "options":[{"area":null,"day":1,"kind":"full","areas":[],"covers":null,"estimatedMinutes":300,"leftOut":[],
                  "minutes":330,"objectiveOnly":false,"questions":90,"written":[]}],
                 "placement":null,"running":null,"sizeSource":{"formats":null,"material":false,"pastEdition":null,"questions":"notice","subjects":null,"time":"notice"}}
                """.trimIndent(),
            ).jsonObject
    val fields = if (extra.isEmpty()) emptyMap() else ApiJson.parseToJsonElement("{$extra}").jsonObject
    return ApiJson.decodeFromJsonElement<MockOptions>(JsonObject(base + fields))
}

internal class FakeExamApi(
    var exam: ExamView? = exam(),
) : ExamApi {
    var reads = 0
    val reports = mutableListOf<ExamResultReport>()
    var reportFailure: ApiException? = null

    override suspend fun exam(
        session: AuthenticatedSession,
        goalId: UUID,
        timeZone: String,
    ): ExamView? {
        reads++
        return exam
    }

    override suspend fun report(
        session: AuthenticatedSession,
        goalId: UUID,
        report: ExamResultReport,
        timeZone: String,
    ): ExamResult {
        reportFailure?.let { throw it }
        reports += report
        return ExamResult(report.maxScore, report.passed, Clock.System.now(), report.scale, report.score)
    }
}

internal class FakeMockApi(
    var options: MockOptions? = mockOptions(),
) : MockApi {
    override suspend fun options(
        session: AuthenticatedSession,
        goalId: UUID,
    ) = options ?: throw ApiException(ApiError.NotFound)
}
