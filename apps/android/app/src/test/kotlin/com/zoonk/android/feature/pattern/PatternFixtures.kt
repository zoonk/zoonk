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

internal val PATTERN_ID: UUID = UUID.fromString("5b4c3e1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b")

internal fun pattern(
    kind: MistakePattern.Kind = MistakePattern.Kind.PATTERN,
    firstAnswer: String = "agree",
) = MistakePattern(
    contrast =
        listOf(
            MistakePatternContrastInner(example = "I agree with you", label = "agree + with"),
            MistakePatternContrastInner(example = "I am happy", label = "be + adjective"),
        ),
    drill =
        listOf(
            MistakePatternDrillInner(
                answer = firstAnswer,
                feedback = "“Agree” is already a verb.",
                options = listOf("am agree", "agree"),
                sentence = "I ___ with your plan.",
            ),
            MistakePatternDrillInner(
                answer = "agree",
                feedback = "No “are” before a verb.",
                options = listOf("agree", "are agree"),
                sentence = "They ___ that it's late.",
            ),
        ),
    examples =
        listOf(
            MistakePatternExamplesInner(answer = "I am agree with you.", correctAnswer = "I agree with you.", format = "writing"),
            MistakePatternExamplesInner(answer = "She is agree.", correctAnswer = "She agrees.", format = "spokenAnswer"),
        ),
    rule = "“Agree” is a verb, so it needs no “am”.",
    id = PATTERN_ID,
    kind = kind,
    occurrences = 2,
    practiced = false,
    title = "Saying you agree",
)

/** A [gate] holds each save until it's completed; [saved] counts the saves that got through. */
internal class FakePatternApi(
    private var failures: Int = 0,
    var gate: CompletableDeferred<Unit>? = null,
) : PatternApi {
    val practices = mutableListOf<MistakePatternPracticeInput>()
    var saved = 0
    var dismissals = 0

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
    ) {
        dismissals++
    }
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
