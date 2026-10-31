package com.zoonk.android.feature.checkpoint

import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.android.feature.session.fixture
import com.zoonk.api.models.Checkpoint
import com.zoonk.api.models.StudyBlockCompletion
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

internal const val Q1 = "3b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"
internal const val Q2 = "4b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"
internal const val Q3 = "5b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"
internal const val REMOVED = "6b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"

internal fun duelQuestion(
    itemId: String,
    answered: Boolean? = null,
) = fixture(
    "checkpoint-question",
    "itemId" to itemId,
    "answered" to answered?.let { JsonObject(mapOf("blank" to JsonPrimitive(false), "isCorrect" to JsonPrimitive(it))) },
)

/** A won boss's end: 50 Brain Power, 20 of them the day's bonus it paid. */
internal fun wonCompletion(): StudyBlockCompletion =
    decodeFixture(
        "study-block-completion",
        "checkpoint" to
            JsonObject(
                mapOf(
                    "answers" to JsonArray(emptyList()),
                    "correct" to JsonPrimitive(2),
                    "kind" to JsonPrimitive("boss"),
                    "passMark" to JsonPrimitive(2),
                    "passed" to JsonPrimitive(true),
                    "total" to JsonPrimitive(3),
                ),
            ),
    )

internal fun checkpoint(
    vararg questions: JsonObject = arrayOf(duelQuestion(Q1), duelQuestion(Q2), duelQuestion(Q3)),
    kind: String = "boss",
    passMark: Int = 2,
    fields: Array<Pair<String, Any?>> = emptyArray(),
): Checkpoint = decodeFixture("checkpoint", "questions" to JsonArray(questions.toList()), "kind" to kind, "passMark" to passMark, *fields)
