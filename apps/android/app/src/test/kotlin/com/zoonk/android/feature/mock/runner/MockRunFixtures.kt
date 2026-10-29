package com.zoonk.android.feature.mock.runner

import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.api.ApiJson
import com.zoonk.api.models.MockExam
import com.zoonk.api.models.MockPlanOfferInput
import com.zoonk.api.models.MockPlanOfferResult
import kotlinx.coroutines.CompletableDeferred
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.jsonObject
import kotlin.time.Clock
import kotlin.time.Duration.Companion.hours

internal const val RUN_BLOCK = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1b01"
internal const val ITEM_ONE = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1b11"
internal const val ITEM_TWO = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1b12"
internal const val ITEM_THREE = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1b13"
private const val SKILL = "6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1b21"

internal fun question(
    item: String,
    number: Int,
    text: String,
    options: List<String> = listOf("2", "3", "4"),
    format: String = "multipleChoice",
) = """{"area":"Mathematics","context":null,"entry":null,"format":"$format","image":null,"itemId":"$item","number":$number,
    "options":[${options.joinToString(
    ",",
) { "\"$it\"" }}],"question":"$text","select":null,"set":null,"skillId":"$SKILL","unit":null,"visual":null}"""

/** A running mock of two sections; [current] and [extra]'s top-level fields replace the defaults. */
internal fun runningMock(
    current: String = currentSection(),
    extra: String = "",
): MockExam {
    val base =
        ApiJson
            .parseToJsonElement(
                """
                {"adapt":null,"blockId":"$RUN_BLOCK","brainPower":0,"breakUntil":null,"canMove":false,"ceremony":null,"checklist":[],
                 "current":$current,
                 "date":"2026-10-29","day":null,"essayRubric":null,"essays":[],"examDocument":"notice","examName":"ENEM","examQuestions":null,
                 "fullLength":true,"goalId":"6f1c2c1e-1b8a-4d8e-9a77-2d8f4b0f1a01","leftOut":[],"minutes":60,"missionMoment":null,"mistakes":[],
                 "number":3,"passMarks":null,"planItemId":null,"purpose":"practice","questions":3,"reached":{"energy":null,"level":null},
                 "result":null,"reusedQuestions":0,"review":[],"scoreNotes":{"noticeScoring":null,"relative":false,"scale":null},
                 "scoring":"raw","scoringNote":null,
                 "sections":[{"breakAfterMinutes":null,"essays":0,"index":0,"minutes":30,"name":"Mathematics","navigation":null,"questions":2,"status":"current","tools":null},
                  {"breakAfterMinutes":null,"essays":0,"index":1,"minutes":30,"name":"Languages","navigation":null,"questions":1,"status":"upcoming","tools":null}],
                 "sessionId":null,"shape":{"area":null,"day":1,"kind":"full"},
                 "sizeSource":{"formats":null,"material":false,"pastEdition":null,"questions":"notice","subjects":null,"time":"notice"},
                 "speaking":null,"startTime":null,"status":"running","timeZone":"UTC","trueFalseLabels":"trueFalse"}
                """.trimIndent(),
            ).jsonObject
    val fields = if (extra.isEmpty()) emptyMap() else ApiJson.parseToJsonElement("{$extra}").jsonObject
    return ApiJson.decodeFromJsonElement<MockExam>(JsonObject(base + fields))
}

internal fun currentSection(
    section: Int = 0,
    questions: String = "${question(ITEM_ONE, 1, "What is 1 + 1?")},${question(ITEM_TWO, 2, "What is 1 + 2?")}",
    drafts: String = "",
    deadline: String = "${Clock.System.now() + 1.hours}",
    kind: String = "null",
) =
    """{"changesLeft":null,"deadline":"$deadline","drafts":[$drafts],"kind":$kind,"plays":[],"questions":[$questions],"resume":0,"section":$section}"""

/** A running mock whose first section moves by [navigation], main's section rules. */
internal fun navigatedMock(navigation: String) =
    runningMock(
        extra =
            """"sections":[{"breakAfterMinutes":null,"essays":0,"index":0,"minutes":30,"name":"Mathematics","navigation":$navigation,"questions":2,"status":"current","tools":null},
            {"breakAfterMinutes":null,"essays":0,"index":1,"minutes":30,"name":"Languages","navigation":null,"questions":1,"status":"upcoming","tools":null}]""",
    )

internal const val FORWARD_ONLY = """{"answerChanges":null,"forwardOnly":true,"itemSeconds":null,"mustAnswer":false}"""
internal const val A_MINUTE_EACH = """{"answerChanges":null,"forwardOnly":true,"itemSeconds":60,"mustAnswer":false}"""

/** The second section, as the mock reads once the first is handed in. */
internal fun secondSection() =
    runningMock(
        current = currentSection(section = 1, questions = question(ITEM_THREE, 3, "Which word is a noun?", listOf("run", "house"))),
        extra =
            """"sections":[{"breakAfterMinutes":null,"essays":0,"index":0,"minutes":30,"name":"Mathematics","navigation":null,"questions":2,"status":"done","tools":null},
            {"breakAfterMinutes":null,"essays":0,"index":1,"minutes":30,"name":"Languages","navigation":null,"questions":1,"status":"current","tools":null}]""",
    )

internal class FakeMockRunApi(
    var mock: MockExam = runningMock(),
) : MockRunApi {
    val saved = mutableListOf<MockDraft>()
    val submitted = mutableListOf<Int>()
    var afterSubmit: MockExam? = null
    var afterFinish: MockExam? = null
    var saveFailure: ApiException? = null

    /** Holds a hand-in until completed, then fails it with [stepFailure] if set. */
    var stepGate: CompletableDeferred<Unit>? = null
    var stepFailure: ApiException? = null
    var plays = 0

    /** The mock as read once its essays are graded; [gradeGate] holds grading until completed. */
    var afterGrade: MockExam? = null
    var gradeOutcome = EssayGradeOutcome.Graded
    var gradeFailure: ApiException? = null
    var gradeGate: CompletableDeferred<Unit>? = null
    var grades = 0
    val offers = mutableListOf<MockPlanOfferInput.Offer>()
    var offerResult = MockPlanOfferResult(changeId = null, lessonsSkipped = 3, reason = null, status = MockPlanOfferResult.Status.APPLIED)
    var offerFailure: ApiException? = null

    override suspend fun mock(
        session: AuthenticatedSession,
        blockId: String,
    ) = mock

    override suspend fun save(
        session: AuthenticatedSession,
        blockId: String,
        draft: MockDraft,
    ): SaveOutcome {
        saveFailure?.let { throw it }
        saved += draft
        return SaveOutcome.Stored
    }

    override suspend fun submitSection(
        session: AuthenticatedSession,
        blockId: String,
        section: Int,
        timeZone: String,
    ) {
        stepGate?.await()
        stepFailure?.let { throw it }
        submitted += section
        afterSubmit?.let { mock = it }
    }

    override suspend fun endBreak(
        session: AuthenticatedSession,
        blockId: String,
    ) = Unit

    override suspend fun play(
        session: AuthenticatedSession,
        blockId: String,
        setId: String,
    ): PlayOutcome = PlayOutcome.Counted(++plays)

    override suspend fun startSpeaking(
        session: AuthenticatedSession,
        blockId: String,
    ) = Unit

    override suspend fun finish(
        session: AuthenticatedSession,
        blockId: String,
        timeZone: String,
    ) {
        afterFinish?.let { mock = it }
    }

    override suspend fun gradeEssays(
        session: AuthenticatedSession,
        blockId: String,
        timeZone: String,
    ): EssayGradeOutcome {
        grades++
        gradeGate?.await()
        gradeFailure?.let { throw it }
        afterGrade?.let { mock = it }
        return gradeOutcome
    }

    override suspend fun adapt(
        session: AuthenticatedSession,
        blockId: String,
        offer: MockPlanOfferInput.Offer,
        timeZone: String,
    ): MockPlanOfferResult {
        offerFailure?.let { throw it }
        offers += offer
        return offerResult
    }
}

internal val UNREACHABLE = ApiException(ApiError.Network)
