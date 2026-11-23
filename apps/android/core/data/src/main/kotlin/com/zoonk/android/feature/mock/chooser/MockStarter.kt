package com.zoonk.android.feature.mock.chooser

import com.zoonk.android.data.ApiClients
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.DataDomain
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.perform
import com.zoonk.android.feature.mock.MockStore
import com.zoonk.api.models.AnytimeMock
import com.zoonk.api.models.AnytimeMockInput
import com.zoonk.api.models.AnytimeMockInputShape
import com.zoonk.api.models.AnytimeMockInputShapeAnyOf
import com.zoonk.api.models.MockShape
import com.zoonk.api.models.WrittenTestShape
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import java.time.LocalDate
import java.util.UUID

sealed interface MockStartOutcome {
    /** Started now, or the one already running: either way the learner goes on in it. */
    data class Opened(
        val id: String,
    ) : MockStartOutcome

    /** Its questions are still being written: the server saved the request, and no clock runs. */
    data object Preparing : MockStartOutcome

    data object PlusRequired : MockStartOutcome

    data object SignUpRequired : MockStartOutcome

    data class GradesUsed(
        val returnsOn: LocalDate?,
    ) : MockStartOutcome

    data class NeedsChoice(
        val choiceGroups: List<String>,
    ) : MockStartOutcome
}

fun interface MockStartApi {
    suspend fun start(
        session: AuthenticatedSession,
        goalId: UUID,
        shape: MockShape,
    ): AnytimeMock
}

class LiveMockStartApi(
    private val api: ApiClients,
) : MockStartApi {
    override suspend fun start(
        session: AuthenticatedSession,
        goalId: UUID,
        shape: MockShape,
    ) = perform { api.clients(session).exams.startAnytimeMock(goalId, AnytimeMockInput(shape = shape.input())) }
}

/** Starts a mock taken any time, as main's chooser does: only from the learner's tap. */
class MockStarter(
    private val api: MockStartApi,
    private val cache: AppCache,
    private val mocks: MockStore,
) {
    suspend fun start(
        goalId: UUID,
        shape: MockShape,
    ): MutationResult<MockStartOutcome> {
        val result =
            cache.mutate { session ->
                try {
                    outcome(api.start(session, goalId, shape))
                } catch (e: ApiException) {
                    when {
                        e.code == "PLUS_REQUIRED" -> MockStartOutcome.PlusRequired
                        e.code == "SIGN_UP_REQUIRED" -> MockStartOutcome.SignUpRequired
                        e.code == "EXAM_CHOICE_REQUIRED" -> MockStartOutcome.NeedsChoice(e.details.examChoiceGroups())
                        e.code == "USAGE_LIMIT_REACHED" && e.status == 429 -> MockStartOutcome.GradesUsed(e.details.returnsOn())
                        else -> throw e
                    }
                }
            }
        when ((result as? MutationResult.Done)?.value) {
            is MockStartOutcome.Opened -> {
                cache.invalidate(setOf(DataDomain.LearnerModel))
            }

            MockStartOutcome.Preparing -> {
                mocks.requested(goalId, shape)
            }

            MockStartOutcome.PlusRequired -> {
                cache.invalidate(setOf(DataDomain.UserSubscription))
            }

            is MockStartOutcome.GradesUsed, is MockStartOutcome.NeedsChoice, MockStartOutcome.SignUpRequired, null -> {}
        }
        return result
    }

    private fun outcome(mock: AnytimeMock): MockStartOutcome =
        when (mock.status) {
            AnytimeMock.Status.STARTED, AnytimeMock.Status.RUNNING -> MockStartOutcome.Opened(checkNotNull(mock.id).toString())
            AnytimeMock.Status.PREPARING -> MockStartOutcome.Preparing
        }
}

/** The day's extra writing allowance, rather than a plan's usage cap, says when it returns. */
private fun JsonElement?.returnsOn(): LocalDate? =
    ((this as? JsonObject)?.get("returnsOn") as? JsonPrimitive)?.contentOrNull?.let { runCatching { LocalDate.parse(it) }.getOrNull() }

/** The exam choices a written test waits for, as `EXAM_CHOICE_REQUIRED` names them. */
fun JsonElement?.examChoiceGroups(): List<String> =
    ((this as? JsonObject)?.get("choiceGroups") as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull }.orEmpty()

/** The written test is a shape of its own on the wire; every other option names its kind, day and subject. */
private fun MockShape.input(): AnytimeMockInputShape =
    if (kind == MockShape.Kind.WRITTEN) {
        AnytimeMockInputShape.WrittenTestShapeValue(WrittenTestShape(area = null, day = day, kind = WrittenTestShape.Kind.WRITTEN))
    } else {
        AnytimeMockInputShape.AnytimeMockInputShapeAnyOfValue(
            AnytimeMockInputShapeAnyOf(area, day, AnytimeMockInputShapeAnyOf.Kind.entries.first { it.value == kind.value }),
        )
    }
