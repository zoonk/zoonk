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

    /** For the mock picked as [key] only: Start again takes it as it is. */
    data class Short(
        val key: String,
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
) : ViewModel() {
    private val mutableStatus = MutableStateFlow<ChooserStatus>(ChooserStatus.Choosing)
    private val mutableBusy = MutableStateFlow(false)
    private val mutableOpened = MutableStateFlow<String?>(null)
    private var owner: AuthenticatedSession? = null
    private var writing: MockChoice? = null

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

    fun start(
        choice: MockChoice,
        key: String,
    ) {
        if (mutableBusy.value || mutableStatus.value == ChooserStatus.Writing) return
        val acceptFewer = (mutableStatus.value as? ChooserStatus.Short)?.key == key
        mutableStatus.value = ChooserStatus.Choosing
        mutableBusy.value = true
        viewModelScope.launch {
            when (val result = starter.start(goalId, choice, acceptFewer)) {
                is MutationResult.Done -> {
                    if (result.value ==
                        MockStartOutcome.NeedsQuestions
                    ) {
                        write(choice, key)
                    } else {
                        show(result.value, key)
                    }
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

    private suspend fun write(
        choice: MockChoice,
        key: String,
    ) {
        val session = sessions.current
        val result = starter.writeQuestions(goalId, choice)
        if (result is MutationResult.Failed) {
            mutableStatus.value = ChooserStatus.Failed(notEnoughQuestions = false)
            return
        }

        when (val written = (result as? MutationResult.Done)?.value) {
            is QuestionWriting.Writing -> {
                owner = session
                writing = choice
                mutableStatus.value = ChooserStatus.Writing
                mutableBusy.value = false
                follower.follow(written.generationId)
                follower.run.first { it.status == GenerationRun.Status.Ready }
                mutableBusy.value = true
                startWithWhatThereIs(choice, key)
            }

            QuestionWriting.Ready -> {
                startWithWhatThereIs(choice, key)
            }

            is QuestionWriting.Refused -> {
                mutableStatus.value = ChooserStatus.Refused(written.limit)
            }

            // Plus required: the options read again shows the mock locked.
            QuestionWriting.PlusRequired, null -> {
                return
            }
        }
    }

    private suspend fun startWithWhatThereIs(
        choice: MockChoice,
        key: String,
    ) {
        when (val result = starter.start(goalId, choice, acceptFewer = true)) {
            is MutationResult.Done -> show(result.value, key)
            is MutationResult.Failed -> mutableStatus.value = ChooserStatus.Failed(notEnoughQuestions = false)
            MutationResult.Obsolete -> mutableStatus.value = ChooserStatus.Choosing
        }
    }

    private fun show(
        outcome: MockStartOutcome,
        key: String,
    ) {
        mutableStatus.value =
            when (outcome) {
                is MockStartOutcome.Opened -> ChooserStatus.Choosing.also { mutableOpened.value = outcome.id }

                is MockStartOutcome.Short -> ChooserStatus.Short(key, outcome)

                MockStartOutcome.NotEnoughQuestions -> ChooserStatus.Failed(notEnoughQuestions = true)

                MockStartOutcome.NeedsQuestions -> ChooserStatus.Failed(notEnoughQuestions = false)

                // The options read again shows the mock locked.
                MockStartOutcome.PlusRequired -> ChooserStatus.Choosing
            }
    }

    /** The run's Try again: null once nothing is left to write, which starts the mock. */
    private suspend fun writeAgain(): String? {
        val choice = checkNotNull(writing)
        val result = starter.writeQuestions(goalId, choice)
        val written = (result as? MutationResult.Done)?.value ?: error("The mock's questions couldn't be asked for again")
        return (written as? QuestionWriting.Writing)?.generationId
    }
}
