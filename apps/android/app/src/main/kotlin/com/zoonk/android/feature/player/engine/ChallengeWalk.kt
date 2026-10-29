package com.zoonk.android.feature.player.engine

import com.zoonk.android.feature.player.model.ChallengeChoice
import com.zoonk.android.feature.player.model.ChallengeEnding
import com.zoonk.android.feature.player.model.ChallengeNode
import com.zoonk.android.feature.player.model.ChallengeStepContent
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.api.models.PlayableLibraryStepAnyOf1ContentNodesInnerChoicesInner.Quality

data class ChallengeMove(
    val node: ChallengeNode,
    val choice: ChallengeChoice,
)

/** Core's `walkChallenge`: the decisions a path of picks went through, and where it stands. */
sealed interface ChallengeWalk {
    data class Deciding(
        val node: ChallengeNode,
        val moves: List<ChallengeMove>,
    ) : ChallengeWalk

    data class Ended(
        val ending: ChallengeEnding,
        val moves: List<ChallengeMove>,
    ) : ChallengeWalk

    data object Invalid : ChallengeWalk
}

fun walkChallenge(
    content: ChallengeStepContent,
    choiceIds: List<String>,
): ChallengeWalk {
    var at = content.startNodeId
    val moves = mutableListOf<ChallengeMove>()

    for (choiceId in choiceIds) {
        val node = content.nodes.find { it.id == at } ?: return ChallengeWalk.Invalid
        val choice = node.choices.find { it.id == choiceId } ?: return ChallengeWalk.Invalid
        moves += ChallengeMove(node, choice)
        at = choice.next
    }

    content.nodes.find { it.id == at }?.let { return ChallengeWalk.Deciding(it, moves) }
    return content.endings.find { it.id == at }?.let { ChallengeWalk.Ended(it, moves) } ?: ChallengeWalk.Invalid
}

/** Where a challenge screen stands: its intro, a decision (with the pick not yet confirmed), or its end. */
sealed interface ChallengeProgress {
    data object Intro : ChallengeProgress

    data class Deciding(
        val confirmed: List<String>,
        val pendingChoiceId: String?,
        val walk: ChallengeWalk.Deciding,
    ) : ChallengeProgress

    data class Ended(
        val confirmed: List<String>,
        val walk: ChallengeWalk.Ended,
    ) : ChallengeProgress
}

/** [shown] counts the intro and each confirmed decision. */
fun challengeProgress(
    content: ChallengeStepContent,
    answer: LessonAnswer?,
    shown: Int,
): ChallengeProgress {
    if (shown == 0) return ChallengeProgress.Intro

    val picks = (answer as? LessonAnswer.Challenge)?.choiceIds.orEmpty()
    val confirmed = picks.take(shown - 1)

    return when (val walk = walkChallenge(content, confirmed)) {
        is ChallengeWalk.Ended -> {
            ChallengeProgress.Ended(confirmed, walk)
        }

        ChallengeWalk.Invalid -> {
            ChallengeProgress.Intro
        }

        is ChallengeWalk.Deciding -> {
            val pending = picks.getOrNull(shown - 1)?.takeIf { id -> walk.node.choices.any { it.id == id } }
            ChallengeProgress.Deciding(confirmed, pending, walk)
        }
    }
}

/** The answer after picking [choiceId] (or clearing the pick) at the decision in view. */
fun pickChallengeChoice(
    choiceId: String?,
    confirmed: List<String>,
): LessonAnswer? {
    val choiceIds = if (choiceId == null) confirmed else confirmed + choiceId
    return if (choiceIds.isEmpty()) null else LessonAnswer.Challenge(choiceIds)
}

private const val PASS_SCORE = 0.5

private val Quality.score: Double
    get() =
        when (this) {
            Quality.STRONG -> 1.0
            Quality.FAIR -> 0.5
            Quality.WEAK -> 0.0
        }

data class ChallengeGrade(
    val ending: ChallengeEnding,
    val isCorrect: Boolean,
    val score: Double,
    val moves: List<ChallengeMove>,
)

/** Core's `gradeChallengePath`: the mean quality of the decisions; half or more passes. */
fun gradeChallengePath(
    content: ChallengeStepContent,
    choiceIds: List<String>,
): ChallengeGrade? {
    val walk = walkChallenge(content, choiceIds) as? ChallengeWalk.Ended ?: return null
    val score = if (walk.moves.isEmpty()) 0.0 else walk.moves.sumOf { it.choice.quality.score } / walk.moves.size

    return ChallengeGrade(walk.ending, score >= PASS_SCORE, score, walk.moves)
}
