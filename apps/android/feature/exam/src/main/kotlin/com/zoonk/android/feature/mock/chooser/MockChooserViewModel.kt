package com.zoonk.android.feature.mock.chooser

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.AuthenticatedSession
import com.zoonk.android.data.GenerationFollower
import com.zoonk.android.data.GenerationKind
import com.zoonk.android.data.GenerationRun
import com.zoonk.android.data.GenerationSource
import com.zoonk.android.data.MutationResult
import com.zoonk.android.data.SessionSource
import com.zoonk.android.ui.components.Limit
import com.zoonk.api.models.MockShape
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import java.util.UUID

sealed interface ChooserStatus {
    data object Choosing : ChooserStatus

    /** Questions are being written; the mock starts once they're ready. */
    data object Writing : ChooserStatus

    /** The mock exam picked as [key] would be shorter than the exam: the learner is asked before it starts. */
    data class Short(
        val key: String,
        val shape: MockShape,
        val outcome: MockStartOutcome.Short,
    ) : ChooserStatus

    data class Failed(
        val notEnoughQuestions: Boolean,
    ) : ChooserStatus

    data class Refused(
        val limit: Limit,
    ) : ChooserStatus
}

/**
 * Main's `MockChooserClient`: Start asks for the mock, has its questions written when the bank is
 * short of new ones, follows that run, then starts it with what there is.
 */
class MockChooserViewModel(
    private val goalId: UUID,
    private val starter: MockStarter,
    private val sessions: SessionSource,
    private val generations: (AuthenticatedSession?) -> GenerationSource,
    private val refused: suspend () -> Unit = {},
) : ViewModel() {
    private val mutableStatus = MutableStateFlow<ChooserStatus>(ChooserStatus.Choosing)
    private val mutableBusy = MutableStateFlow(false)
    private val mutableOpened = MutableStateFlow<String?>(null)
    private val mutableTriedLocked = MutableStateFlow(false)
    private var owner: AuthenticatedSession? = null
    private var writing: MockShape? = null
    private var generationId: String? = null
    private val shown = MutableStateFlow(true)

    private val follower =
        GenerationFollower(
            kind = GenerationKind.MockQuestions,
            scope = viewModelScope,
            source =
                object : GenerationSource {
                    override fun events(id: String) = generations(owner).events(id)

                    override suspend fun status(id: String) = generations(owner).status(id)
                },
            restart = { writeAgain() },
        )

    val status: StateFlow<ChooserStatus> = mutableStatus.asStateFlow()

    /** Getting the mock ready, before it's written or opened. */
    val busy: StateFlow<Boolean> = mutableBusy.asStateFlow()

    /** The mock to open: started, or the one that was running. */
    val opened: StateFlow<String?> = mutableOpened.asStateFlow()

    val run: StateFlow<GenerationRun> = follower.run

    /** The learner pressed Start on a locked mock, or the server refused a start: the gate shows while the mocks read locked. */
    val triedLocked: StateFlow<Boolean> = mutableTriedLocked.asStateFlow()

    fun tryLocked() {
        mutableTriedLocked.value = true
    }

    fun start(
        shape: MockShape,
        key: String,
    ) {
        begin(shape, key, MockStartAsk.First)
    }

    /** The server's refusal is the options' access now ([refused] writes it), so the gate reads it from them. */
    private fun metTheLock() {
        tryLocked()
        viewModelScope.launch { refused() }
    }

    /** The learner agreed, in the confirmation, to start the shorter mock exam. */
    fun startShort() {
        val short = mutableStatus.value as? ChooserStatus.Short ?: return
        begin(short.shape, short.key, MockStartAsk.AcceptFewer)
    }

    /** "Pick another" closes the confirmation; the pick stays. */
    fun stayChoosing() {
        if (mutableStatus.value is ChooserStatus.Short) mutableStatus.value = ChooserStatus.Choosing
    }

    private fun begin(
        shape: MockShape,
        key: String,
        ask: MockStartAsk,
    ) {
        if (mutableBusy.value || mutableStatus.value == ChooserStatus.Writing) return
        owner = sessions.current
        mutableStatus.value = ChooserStatus.Choosing
        mutableBusy.value = true
        viewModelScope.launch {
            if (!isOwnersSession) {
                abandon()
                mutableBusy.value = false
                return@launch
            }
            when (val result = starter.start(goalId, shape, ask)) {
                is MutationResult.Done -> {
                    if (result.value == MockStartOutcome.NeedsQuestions) write(shape, key) else show(result.value, shape, key)
                }

                is MutationResult.Failed -> {
                    mutableStatus.value = ChooserStatus.Failed(notEnoughQuestions = false)
                }

                MutationResult.Obsolete -> {
                    mutableStatus.value = ChooserStatus.Choosing
                }
            }
            mutableBusy.value = false
        }
    }

    fun retry() = follower.retry()

    /**
     * Writing goes on on the server while the chooser is hidden, but the screen stops following it,
     * and a mock never starts its clock out of sight: it waits to be seen again.
     */
    fun onShown(isShown: Boolean) {
        shown.value = isShown
        val id = generationId ?: return
        if (mutableStatus.value != ChooserStatus.Writing || follower.run.value.status == GenerationRun.Status.Ready) return
        if (isShown) follower.follow(id) else follower.stop()
    }

    /** Every step after the tap belongs to the session that tapped. */
    private val isOwnersSession: Boolean get() = sessions.current == owner

    private fun abandon() {
        follower.stop()
        generationId = null
        mutableStatus.value = ChooserStatus.Choosing
    }

    private suspend fun write(
        shape: MockShape,
        key: String,
    ) {
        if (!isOwnersSession) return abandon()
        val result = starter.writeQuestions(goalId, shape)
        if (result is MutationResult.Failed) {
            mutableStatus.value = ChooserStatus.Failed(notEnoughQuestions = false)
            return
        }

        when (val written = (result as? MutationResult.Done)?.value) {
            is QuestionWriting.Writing -> {
                writing = shape
                generationId = written.generationId
                mutableStatus.value = ChooserStatus.Writing
                mutableBusy.value = false
                follower.follow(written.generationId)
                follower.run.first { it.status == GenerationRun.Status.Ready }
                shown.first { it }
                if (!isOwnersSession) return abandon()
                mutableBusy.value = true
                startWithWhatThereIs(shape, key)
            }

            QuestionWriting.Ready -> {
                startWithWhatThereIs(shape, key)
            }

            is QuestionWriting.Refused -> {
                mutableStatus.value = ChooserStatus.Refused(written.limit)
            }

            QuestionWriting.PlusRequired -> {
                metTheLock()
            }

            null -> {
                return
            }
        }
    }

    private suspend fun startWithWhatThereIs(
        shape: MockShape,
        key: String,
    ) {
        when (val result = starter.start(goalId, shape, MockStartAsk.AfterWriting)) {
            is MutationResult.Done -> show(result.value, shape, key)
            is MutationResult.Failed -> mutableStatus.value = ChooserStatus.Failed(notEnoughQuestions = false)
            MutationResult.Obsolete -> mutableStatus.value = ChooserStatus.Choosing
        }
    }

    private fun show(
        outcome: MockStartOutcome,
        shape: MockShape,
        key: String,
    ) {
        mutableStatus.value =
            when (outcome) {
                is MockStartOutcome.Opened -> ChooserStatus.Choosing.also { mutableOpened.value = outcome.id }
                is MockStartOutcome.Short -> ChooserStatus.Short(key, shape, outcome)
                MockStartOutcome.NotEnoughQuestions -> ChooserStatus.Failed(notEnoughQuestions = true)
                MockStartOutcome.NeedsQuestions -> ChooserStatus.Failed(notEnoughQuestions = false)
                MockStartOutcome.PlusRequired -> ChooserStatus.Choosing.also { metTheLock() }
            }
    }

    /** The run's Try again: null once nothing is left to write, which starts the mock. */
    private suspend fun writeAgain(): String? {
        check(isOwnersSession) { "Another session can't write this mock's questions" }
        val result = starter.writeQuestions(goalId, checkNotNull(writing))
        val written = (result as? MutationResult.Done)?.value ?: error("The mock's questions couldn't be asked for again")
        return (written as? QuestionWriting.Writing)?.generationId.also { generationId = it }
    }
}
