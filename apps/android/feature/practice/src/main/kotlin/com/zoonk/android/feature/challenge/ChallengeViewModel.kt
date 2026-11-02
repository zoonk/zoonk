package com.zoonk.android.feature.challenge

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.GenerationFailure
import com.zoonk.android.data.GenerationFollower
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.value
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.Limit
import com.zoonk.api.ApiJson
import com.zoonk.api.models.ChallengeGeneration
import com.zoonk.api.models.ChallengeStart
import com.zoonk.api.models.PlanEffect
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.datetime.LocalDate
import kotlinx.serialization.Contextual
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.util.UUID

enum class StartProblem { Failed, PlusRequired }

sealed interface MoveRefusal {
    data object BeforeNextMonday : MoveRefusal

    data object MockCollision : MoveRefusal

    data object NoRoom : MoveRefusal

    data class Unfunded(
        val date: LocalDate,
        val minutes: Int,
    ) : MoveRefusal
}

@Serializable
data class Moved(
    @Contextual val changeId: UUID,
    @Contextual val date: LocalDate,
    val effect: PlanEffect?,
)

/** Where starting, writing and moving stand; the challenge itself is the store's read. */
data class ChallengeUi(
    val planItemId: UUID,
    val starting: Boolean = false,
    val slow: Boolean = false,
    val problem: StartProblem? = null,
    val writing: Boolean = false,
    val refused: Limit? = null,
    val moving: Boolean = false,
    val moveFailed: Boolean = false,
    val refusal: MoveRefusal? = null,
    val moved: Moved? = null,
    val opening: AppRoute? = null,
)

/** Plays main's `ChallengeClient`: starting opens the block, writing its questions first when it has none. */
class ChallengeViewModel(
    planItemId: UUID,
    private val sessionId: String?,
    private val store: ChallengeStore,
    generations: GenerationSource,
    private val saved: SavedStateHandle,
) : ViewModel() {
    // A move replaces the route's plan item, so the one it became and its Undo outlive the process.
    private val mutableUi =
        MutableStateFlow(
            ChallengeUi(
                planItemId = saved.get<String>(PLAN_ITEM)?.let(UUID::fromString) ?: planItemId,
                moved = saved.get<String>(MOVED)?.let { ApiJson.decodeFromString(Moved.serializer(), it) },
            ),
        )
    val ui: StateFlow<ChallengeUi> = mutableUi.asStateFlow()

    val challenge get() = store.challenges[mutableUi.value.planItemId]

    private val follower =
        GenerationFollower(
            kind = GenerationKind.ChallengeQuestions,
            scope = viewModelScope,
            source = generations,
            restart = { (writeQuestions() as? Written.Following)?.generationId },
        )
    val run: StateFlow<GenerationRun> = follower.run
    val canRestart: Boolean get() = follower.canRestart

    private var starting: Job? = null

    fun start() {
        if (starting?.isActive == true || mutableUi.value.moving) return
        mutableUi.update { it.copy(starting = true, slow = false, problem = null) }
        starting =
            viewModelScope.launch {
                val slow = launch { delay(SLOW_MILLIS).also { mutableUi.update { it.copy(slow = true) } } }
                // A retry after the timeout is safe: a started block resumes.
                val outcome = withTimeoutOrNull(TIMEOUT_MILLIS) { startOnce(afterWriting = false) } ?: Outcome.Failed
                slow.cancel()
                settle(outcome)
            }
    }

    fun retryWriting() = follower.retry()

    /** Opened once: the screen navigates and clears it, so returning never opens it twice. */
    fun opened() = mutableUi.update { it.copy(opening = null) }

    fun moveToMonday() {
        val ui = mutableUi.value
        if (ui.moving || ui.starting) return
        mutableUi.update { it.copy(moving = true, moveFailed = false, refusal = null) }
        viewModelScope.launch {
            when (val result = store.move(ui.planItemId)) {
                is MutationResult.Done -> {
                    val move = result.value
                    mutableUi.update {
                        it.copy(
                            moving = false,
                            planItemId = move.planItemId ?: it.planItemId,
                            moved = move.changeId?.let { changeId -> Moved(changeId, move.date, move.effect) },
                        )
                    }
                    keep()
                }

                is MutationResult.Failed -> {
                    val refusal = refusal(result)
                    mutableUi.update { it.copy(moving = false, refusal = refusal, moveFailed = refusal == null) }
                }

                MutationResult.Obsolete -> {}
            }
        }
    }

    fun undoMove() {
        val ui = mutableUi.value
        val moved = ui.moved ?: return
        if (ui.moving) return
        mutableUi.update { it.copy(moving = true, moveFailed = false) }
        viewModelScope.launch {
            when (val result = store.undoMove(ui.planItemId, moved.changeId)) {
                is MutationResult.Done -> {
                    mutableUi.update { it.copy(moving = false, moved = null, planItemId = result.value.planItemId ?: it.planItemId) }
                    keep()
                }

                is MutationResult.Failed -> {
                    mutableUi.update { it.copy(moving = false, moveFailed = true) }
                }

                MutationResult.Obsolete -> {}
            }
        }
    }

    private fun keep() {
        val ui = mutableUi.value
        saved[PLAN_ITEM] = ui.planItemId.toString()
        saved[MOVED] = ui.moved?.let { ApiJson.encodeToString(Moved.serializer(), it) }
    }

    private sealed interface Outcome {
        data object Started : Outcome

        data object Writing : Outcome

        /** The day changed (not today, the day's time used up, earlier steps first): the intro is read again. */
        data object Reread : Outcome

        data object PlusRequired : Outcome

        data object Failed : Outcome
    }

    private suspend fun startOnce(afterWriting: Boolean): Outcome =
        when (val result = store.start(mutableUi.value.planItemId, afterWriting)) {
            is MutationResult.Done -> open(result.value)
            is MutationResult.Failed -> failedStart(result, afterWriting)
            MutationResult.Obsolete -> Outcome.Failed
        }

    private suspend fun failedStart(
        failed: MutationResult.Failed,
        afterWriting: Boolean,
    ): Outcome =
        when {
            failed.code in REREAD_CODES -> {
                Outcome.Reread
            }

            // A kept intro can say Start after another device already finished this block.
            failed.code == "BLOCK_FINISHED" -> {
                challenge.state.value.value
                    ?.let { read -> read.blockId?.let { openBlock(it, read.mock) } }
                    ?: Outcome.Failed
            }

            failed.code == "PLUS_REQUIRED" -> {
                Outcome.PlusRequired
            }

            failed.code == "QUESTIONS_NEEDED" && !afterWriting -> {
                write()
            }

            else -> {
                Outcome.Failed
            }
        }

    private sealed interface Written {
        data class Following(
            val generationId: String,
        ) : Written

        data object Ready : Written

        data class Refused(
            val limit: Limit,
        ) : Written

        data object Failed : Written
    }

    private suspend fun writeQuestions(): Written =
        when (val result = store.writeQuestions(mutableUi.value.planItemId)) {
            is MutationResult.Done -> {
                val generationId = result.value.generationId
                if (result.value.status == ChallengeGeneration.Status.GENERATING && generationId != null) {
                    Written.Following(generationId)
                } else {
                    Written.Ready
                }
            }

            is MutationResult.Failed -> {
                Limit.of(result)?.let(Written::Refused) ?: Written.Failed
            }

            MutationResult.Obsolete -> {
                Written.Failed
            }
        }

    private suspend fun write(): Outcome =
        when (val written = writeQuestions()) {
            is Written.Following -> {
                mutableUi.update { it.copy(writing = true) }
                follower.follow(written.generationId)
                followWriting()
                Outcome.Writing
            }

            Written.Ready -> {
                startOnce(afterWriting = true)
            }

            is Written.Refused -> {
                mutableUi.update { it.copy(refused = written.limit) }
                Outcome.Writing
            }

            Written.Failed -> {
                Outcome.Failed
            }
        }

    /** Ready, or failed while writing: either way the challenge starts with the questions it has. */
    private fun followWriting() {
        viewModelScope.launch {
            follower.run.first { it.status == GenerationRun.Status.Ready || it.failure == GenerationFailure.Generation }
            val outcome = startOnce(afterWriting = true)
            if (outcome != Outcome.Started) mutableUi.update { it.copy(writing = false) }
            settle(outcome)
        }
    }

    private fun settle(outcome: Outcome) {
        when (outcome) {
            Outcome.Started -> {}

            Outcome.Writing -> {
                mutableUi.update { it.copy(starting = false, slow = false) }
            }

            Outcome.Reread -> {
                reread()
            }

            Outcome.PlusRequired -> {
                reread(StartProblem.PlusRequired)
            }

            Outcome.Failed -> {
                mutableUi.update { it.copy(starting = false, slow = false, problem = StartProblem.Failed) }
            }
        }
    }

    private fun reread(problem: StartProblem? = null) {
        viewModelScope.launch {
            challenge.refresh()
            mutableUi.update { it.copy(starting = false, slow = false, problem = problem) }
        }
    }

    private fun open(start: ChallengeStart): Outcome =
        openBlock(start.blockId, mock = start.kind == ChallengeStart.Kind.MOCK, start.sessionId.toString())

    private fun openBlock(
        blockId: UUID,
        mock: Boolean,
        session: String? = sessionId,
    ): Outcome {
        val route = if (mock) AppRoute.Mock(blockId.toString(), session) else AppRoute.Checkpoint(blockId.toString(), session)
        mutableUi.update { it.copy(opening = route) }
        return Outcome.Started
    }

    private companion object {
        const val SLOW_MILLIS = 10_000L
        const val TIMEOUT_MILLIS = 45_000L
        const val PLAN_ITEM = "planItemId"
        const val MOVED = "moved"

        // The API says "not in today's session" as a plain conflict.
        val REREAD_CODES = setOf("DAILY_LIMIT_REACHED", "EARLIER_FIRST", "CONFLICT")
    }
}

/** A plan change the plan refused: why, and for a mock with no room, the day and its length. */
private fun refusal(failed: MutationResult.Failed): MoveRefusal? {
    if (failed.code != "PLAN_CHANGE_INVALID") return null
    val details = failed.details as? JsonObject ?: return null
    return when (details["reason"]?.jsonPrimitive?.content) {
        "moveBeforeNextMonday" -> {
            MoveRefusal.BeforeNextMonday
        }

        "mockCollision" -> {
            MoveRefusal.MockCollision
        }

        "badMove" -> {
            MoveRefusal.NoRoom
        }

        "unfundedMove" -> {
            details["unfundedMove"]?.jsonObject?.let {
                MoveRefusal.Unfunded(LocalDate.parse(it.getValue("date").jsonPrimitive.content), it.getValue("minutes").jsonPrimitive.int)
            }
        }

        else -> {
            null
        }
    }
}
