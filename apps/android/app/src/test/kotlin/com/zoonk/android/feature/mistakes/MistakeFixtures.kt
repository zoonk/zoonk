package com.zoonk.android.feature.mistakes

import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.LoadState
import com.zoonk.android.feature.session.decodeFixture
import com.zoonk.android.feature.session.fixture
import com.zoonk.api.ApiJson
import com.zoonk.api.models.MistakePractice
import com.zoonk.api.models.MistakePracticeAnswerInput
import com.zoonk.api.models.MistakePracticeCompletion
import com.zoonk.api.models.MistakePracticeFeedback
import com.zoonk.api.models.MistakePracticeFinishInput
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.decodeFromJsonElement
import java.util.UUID

internal const val FIRST_MISTAKE = "7b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"
internal const val SECOND_MISTAKE = "9b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"
internal const val OTHER_MISTAKE = "ab4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b"

internal fun practiceQuestion(
    itemId: String,
    vararg fields: Pair<String, Any?>,
) = fixture("mistake-practice-question", "itemId" to itemId, *fields)

internal fun drill(
    kind: String,
    seconds: Int? = null,
    lesson: JsonObject? = null,
) = JsonObject(mapOf("kind" to JsonPrimitive(kind), "lesson" to (lesson ?: JsonNull), "timeLimitSeconds" to JsonPrimitive(seconds)))

internal fun practiceEntry(
    mistakeId: String,
    vararg questions: JsonObject,
    drill: JsonObject = drill("retry"),
    snapshot: Pair<String, String> = "Which is a planet?" to "Moon",
) = fixture(
    "mistake-practice-entry",
    "mistakeId" to mistakeId,
    "questions" to JsonArray(questions.toList()),
    "drill" to drill,
    "snapshot" to JsonObject(mapOf("question" to JsonPrimitive(snapshot.first), "answer" to JsonPrimitive(snapshot.second))),
)

internal fun practice(vararg entries: JsonObject): MistakePractice =
    ApiJson.decodeFromJsonElement(
        JsonObject(
            mapOf(
                "practice" to JsonArray(entries.toList()),
                "trueFalseLabels" to JsonPrimitive("trueFalse"),
            ),
        ),
    )

internal fun practiceFeedback(
    isCorrect: Boolean = true,
    fixed: Boolean = false,
    fixedMistakeIds: List<String> = emptyList(),
    status: String = if (fixed) "fixed" else "open",
    answerId: String = UUID.randomUUID().toString(),
): MistakePracticeFeedback =
    decodeFixture(
        "mistake-practice-feedback",
        "answerId" to answerId,
        "isCorrect" to isCorrect,
        "fixed" to fixed,
        "fixedMistakeIds" to JsonArray(fixedMistakeIds.map(::JsonPrimitive)),
        "mistakeStatus" to status,
    )

internal fun completion(
    correct: Int = 1,
    total: Int = 2,
): MistakePracticeCompletion = decodeFixture("mistake-practice-completion", "correct" to correct, "total" to total)

internal class FakeMistakesApi(
    var read: MistakePractice,
    var answer: (MistakePracticeAnswerInput) -> MistakePracticeFeedback = { practiceFeedback() },
    var finish: suspend (MistakePracticeFinishInput) -> MistakePracticeCompletion = { completion() },
) : MistakesApi {
    val answers = mutableListOf<MistakePracticeAnswerInput>()
    val finishes = mutableListOf<MistakePracticeFinishInput>()

    override suspend fun practice(
        session: AuthenticatedSession,
        key: PracticeKey,
        timeZone: String,
    ) = read

    override suspend fun answer(
        session: AuthenticatedSession,
        mistakeId: UUID,
        input: MistakePracticeAnswerInput,
    ) = input.also(answers::add).let(answer)

    override suspend fun finish(
        session: AuthenticatedSession,
        input: MistakePracticeFinishInput,
    ): MistakePracticeCompletion {
        finishes += input
        return finish(input)
    }
}

internal fun practiceViewModel(
    cache: AppCache,
    api: FakeMistakesApi,
    clock: () -> Long = { 0L },
) = MistakePracticeViewModel(PracticeKey(goalId = null, skillId = null), MistakesStore(api, cache) { "UTC" }, clock)

internal fun MistakePracticeViewModel.started() =
    runBlocking { practice.load() }.let {
        begin((practice.state.value as LoadState.Loaded).value)
        requireNotNull(state.value)
    }
