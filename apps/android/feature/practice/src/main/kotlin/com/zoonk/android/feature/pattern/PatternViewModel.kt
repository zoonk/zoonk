package com.zoonk.android.feature.pattern

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.MutationResult
import com.zoonk.android.feature.practice.Segment
import com.zoonk.api.models.MistakePattern
import com.zoonk.api.models.MistakePatternDrillInner
import com.zoonk.api.models.MistakePatternPracticeResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.updateAndGet
import kotlinx.coroutines.launch
import java.util.UUID

sealed interface DrillStep {
    data object Intro : DrillStep

    data class Question(
        val index: Int,
    ) : DrillStep

    data class Result(
        val result: MistakePatternPracticeResult,
    ) : DrillStep
}

data class PatternDrill(
    val pattern: MistakePattern,
    val step: DrillStep = DrillStep.Intro,
    val answers: List<String> = emptyList(),
    val picked: Int? = null,
    val saving: Boolean = false,
    val failed: Boolean = false,
) {
    val isTypos: Boolean get() = pattern.kind == MistakePattern.Kind.TYPOS || pattern.drill.isEmpty()
    val index: Int get() = (step as? DrillStep.Question)?.index ?: 0
    val question: MistakePatternDrillInner? get() = (step as? DrillStep.Question)?.let { pattern.drill.getOrNull(it.index) }
    val answer: String? get() = answers.getOrNull(index)

    val segments: List<Segment>
        get() =
            pattern.drill.mapIndexed { position, question ->
                val checked = answers.getOrNull(position)
                when {
                    checked == null -> if (position == index) Segment.Current else Segment.Ahead
                    checked.trim() == question.answer.trim() -> Segment.Right
                    else -> Segment.Wrong
                }
            }
}

/** Main's `usePatternDrill`: each answer is checked here, and the drill is saved once, at its end. */
class PatternViewModel(
    private val patternId: UUID,
    private val store: PatternStore,
    private val saved: SavedStateHandle,
) : ViewModel() {
    private val mutableState = MutableStateFlow<PatternDrill?>(null)
    val state: StateFlow<PatternDrill?> = mutableState.asStateFlow()

    val pattern get() = store.patterns[patternId]

    // "Try again" sends the same id, so a retry after a lost response counts the drill once.
    private val requestId: UUID =
        saved.get<String>(REQUEST_ID)?.let(UUID::fromString) ?: UUID.randomUUID().also { saved[REQUEST_ID] = it.toString() }

    private val closing = MutableStateFlow(false)
    val closed: StateFlow<Boolean> = closing.asStateFlow()
    private var closeWhenSaved = false

    /** Typos have nothing to practice, so showing them is what clears them, as main's. */
    fun begin(pattern: MistakePattern) {
        if (mutableState.value != null) return
        val drill =
            PatternDrill(
                pattern,
                step = saved.get<Int>(QUESTION)?.takeIf { it < pattern.drill.size }?.let(DrillStep::Question) ?: DrillStep.Intro,
                answers = saved.get<List<String>>(ANSWERS).orEmpty(),
                picked = saved[PICKED],
            )
        mutableState.value = drill
        if (drill.isTypos) viewModelScope.launch { store.dismiss(patternId) }
    }

    fun start() = change { it.copy(step = DrillStep.Question(0), answers = emptyList(), picked = null) }

    fun pick(option: Int?) = change { if (it.step is DrillStep.Question && it.answer == null) it.copy(picked = option) else it }

    fun check() =
        change { drill ->
            val option = drill.picked?.let { drill.question?.options?.getOrNull(it) }
            if (drill.answer == null && option != null) drill.copy(answers = drill.answers + option) else drill
        }

    fun next() {
        val drill = mutableState.value ?: return
        if (drill.step !is DrillStep.Question || drill.answer == null || drill.saving) return
        if (drill.index + 1 < drill.pattern.drill.size) {
            change { it.copy(step = DrillStep.Question(drill.index + 1), picked = null) }
        } else {
            save()
        }
    }

    fun retry() = save()

    /** Leaving waits for the save on its way, so the drill still counts. */
    fun leave() {
        if (mutableState.value?.saving == true) closeWhenSaved = true else closing.value = true
    }

    private fun save() {
        val drill = mutableState.value
        if (drill == null || drill.saving || drill.step !is DrillStep.Question) return
        change { it.copy(saving = true, failed = false) }
        viewModelScope.launch {
            val result = store.practice(patternId, drill.answers, requestId)
            change {
                when (result) {
                    is MutationResult.Done -> it.copy(step = DrillStep.Result(result.value), saving = false)
                    else -> it.copy(saving = false, failed = true)
                }
            }
            if (closeWhenSaved) closing.value = true
        }
    }

    /** A result isn't kept: after process death the drill is back on its last question, and its save replays. */
    private fun change(transform: (PatternDrill) -> PatternDrill) {
        val drill = mutableState.updateAndGet { it?.let(transform) } ?: return
        val question = drill.step as? DrillStep.Question ?: return
        saved[QUESTION] = question.index
        saved[ANSWERS] = ArrayList(drill.answers)
        saved[PICKED] = drill.picked
    }

    private companion object {
        const val QUESTION = "question"
        const val ANSWERS = "answers"
        const val PICKED = "picked"
        const val REQUEST_ID = "requestId"
    }
}
