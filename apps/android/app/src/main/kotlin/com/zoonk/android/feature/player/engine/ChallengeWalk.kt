package com.zoonk.android.feature.player.engine

import com.zoonk.android.feature.player.model.ChallengeChoice
import com.zoonk.android.feature.player.model.ChallengeEnding
import com.zoonk.android.feature.player.model.ChallengeMeter
import com.zoonk.android.feature.player.model.ChallengeNode
import com.zoonk.android.feature.player.model.ChallengeNote
import com.zoonk.android.feature.player.model.ChallengeSkill
import com.zoonk.android.feature.player.model.ChallengeSlot
import com.zoonk.android.feature.player.model.ChallengeStepContent
import com.zoonk.android.feature.player.model.LessonAnswer
import com.zoonk.api.models.PlayableLibraryStepAnyOf1ContentNodesInnerChoicesInner.Quality
import com.zoonk.api.models.PlayableLibraryStepAnyOf1ContentNodesInnerChoicesInnerNotesInner.Kind as NoteKind

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

private const val METER_MAX = 100L

/** A meter after the moves so far, and how the last move changed it. */
data class ChallengeMeterState(
    val meter: ChallengeMeter,
    val value: Long,
    val change: Long,
)

/** Core's `getChallengeMeters`: each meter from its start through every move, kept within 0 to 100. */
fun challengeMeters(
    content: ChallengeStepContent,
    moves: List<ChallengeMove>,
): List<ChallengeMeterState> =
    content.meters.map { meter ->
        val value = moves.fold(meter.start) { current, move -> (current + move.change(meter.id)).coerceIn(0, METER_MAX) }
        ChallengeMeterState(meter, value, moves.lastOrNull()?.change(meter.id) ?: 0)
    }

private fun ChallengeMove.change(meterId: String): Long = choice.effects.firstOrNull { it.meter == meterId }?.change ?: 0

data class ChallengeDebrief(
    val good: List<ChallengeNote>,
    val improve: List<ChallengeNote>,
    /** The skill most notes said to improve, offered as practice. */
    val practice: ChallengeSkill?,
)

/** Core's `getChallengeDebrief`. */
fun challengeDebrief(
    content: ChallengeStepContent,
    moves: List<ChallengeMove>,
): ChallengeDebrief {
    val notes = moves.flatMap { it.choice.notes }
    val improve = notes.filter { it.kind == NoteKind.IMPROVE }
    val counts = improve.groupingBy { it.skill }.eachCount()
    val practice =
        content.skills.fold<ChallengeSkill, ChallengeSkill?>(null) { weakest, skill ->
            if ((counts[skill.id] ?: 0) > (weakest?.let { counts[it.id] } ?: 0)) skill else weakest
        }

    return ChallengeDebrief(notes.filter { it.kind == NoteKind.GOOD }, improve, practice)
}

private val CHALLENGE_NAME = Regex("\\{\\{([\\w-]+)\\}\\}")

/** Core's `getChallengeNames`: each colleague takes the team's next name in order; an AI or a missing team keeps its role. */
fun challengeNames(
    slots: List<ChallengeSlot>,
    team: List<String>?,
): Map<String, String> {
    val people = slots.filterNot { it.ai }
    return slots.associate { slot ->
        val name = if (slot.ai) null else team?.getOrNull(people.indexOf(slot))
        slot.id to (name ?: slot.role)
    }
}

/** Core's `fillChallengeNames`: `{{slot}}` becomes that colleague's name. */
fun fillChallengeNames(
    text: String,
    names: Map<String, String>,
): String = CHALLENGE_NAME.replace(text) { match -> names[match.groupValues[1]] ?: match.value }
