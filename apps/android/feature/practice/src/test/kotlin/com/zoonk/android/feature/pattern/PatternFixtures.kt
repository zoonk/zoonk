package com.zoonk.android.feature.pattern

import androidx.lifecycle.SavedStateHandle
import com.zoonk.android.data.ANA
import com.zoonk.android.data.ApiError
import com.zoonk.android.data.ApiException
import com.zoonk.android.data.AppCache
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.FakeSession
import com.zoonk.api.models.MistakePattern
import com.zoonk.api.models.MistakePatternContrastInner
import com.zoonk.api.models.MistakePatternDrillInner
import com.zoonk.api.models.MistakePatternExamplesInner
import com.zoonk.api.models.MistakePatternPracticeInput
import com.zoonk.api.models.MistakePatternPracticeResult
import com.zoonk.api.models.MistakePatternPracticeResultReached
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import java.util.UUID

private val PATTERN_ID: UUID = UUID.fromString("5b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b")

/** An Italian drill for a learner who reads the app in English; [translated] false is a drill written before translations. */
internal fun pattern(
    kind: MistakePattern.Kind = MistakePattern.Kind.PATTERN,
    firstAnswer: String = "partenza",
    translated: Boolean = true,
) = MistakePattern(
    contrast =
        listOf(
            MistakePatternContrastInner(example = "La partenza è alle nove.", label = "partenza + leaving"),
            MistakePatternContrastInner(example = "La salita è dalla porta anteriore.", label = "salita + getting on"),
            MistakePatternContrastInner(example = "La discesa è dalla porta posteriore.", label = "discesa + getting off"),
        ),
    drill =
        listOf(
            MistakePatternDrillInner(
                answer = firstAnswer,
                feedback = "“Partenza” is when the train leaves.",
                options = listOf("salita", "partenza", "discesa"),
                sentence = "Il treno per Torino è pronto; la ___ è alle 18:40.",
                translation = "The train to Turin is ready; the departure is at 6:40 PM.".takeIf { translated }.orEmpty(),
            ),
            MistakePatternDrillInner(
                answer = "salita",
                feedback = "“Salita” is getting on.",
                options = listOf("salita", "discesa", "partenza"),
                sentence = "A Palermo i passeggeri stanno entrando nell'autobus con le valigie: la ___ è appena iniziata.",
                translation =
                    "In Palermo the passengers are getting on the bus with their suitcases: boarding has just started."
                        .takeIf { translated }
                        .orEmpty(),
            ),
        ),
    examples =
        listOf(
            MistakePatternExamplesInner(
                answer = "La salita è alle 18:40.",
                correctAnswer = "La partenza è alle 18:40.",
                format = "writing",
            ),
            MistakePatternExamplesInner(
                answer = "La partenza è dalla porta centrale.",
                correctAnswer = "La discesa è dalla porta centrale.",
                format = "spokenAnswer",
            ),
        ),
    rule =
        if (kind ==
            MistakePattern.Kind.TYPOS
        ) {
            "Check the spelling of “partenza”: it ends in “-enza”."
        } else {
            "On a trip, “partenza” is when the vehicle leaves, “salita” is getting on and “discesa” is getting off."
        },
    id = PATTERN_ID,
    kind = kind,
    occurrences = 2,
    practiced = false,
    title = "“Partenza”, “salita” and “discesa”",
)

/** A [gate] holds each save until it's completed; [saved] counts the saves that got through. */
internal class FakePatternApi(
    private var failures: Int = 0,
    var gate: CompletableDeferred<Unit>? = null,
) : PatternApi {
    val practices = mutableListOf<MistakePatternPracticeInput>()
    var saved = 0

    override suspend fun pattern(
        session: AuthenticatedSession,
        patternId: UUID,
    ) = pattern()

    override suspend fun practice(
        session: AuthenticatedSession,
        patternId: UUID,
        input: MistakePatternPracticeInput,
    ): MistakePatternPracticeResult {
        practices += input
        gate?.await()
        if (failures > 0) {
            failures--
            throw ApiException(ApiError.Network)
        }
        val correct = input.answers.zip(pattern().drill).count { (answer, question) -> answer == question.answer }
        saved++
        return MistakePatternPracticeResult(
            ceremony = null,
            certificates = emptyList(),
            reached = MistakePatternPracticeResultReached(energy = null, level = null),
            brainPower = 6,
            correct = correct.toLong(),
            missionMoment = null,
            total = input.answers.size.toLong(),
        )
    }

    override suspend fun dismiss(
        session: AuthenticatedSession,
        patternId: UUID,
    ) = Unit
}

internal fun patternViewModel(
    api: FakePatternApi = FakePatternApi(),
    saved: SavedStateHandle = SavedStateHandle(),
): PatternViewModel {
    val cache =
        AppCache(
            FakeSession(AuthenticatedSession(ANA, "token", "local")),
            CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate),
        )
    return PatternViewModel(PATTERN_ID, PatternStore(api, cache) { "UTC" }, saved)
}
