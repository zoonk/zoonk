package com.zoonk.android.feature.onboarding.course

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.serialization.saved
import androidx.lifecycle.viewModelScope
import com.zoonk.android.data.Visit
import com.zoonk.android.feature.onboarding.CourseStarted
import com.zoonk.android.feature.onboarding.GoalLimitReason
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.android.feature.onboarding.goalLimitReason
import com.zoonk.android.feature.onboarding.setup.LevelChoice
import com.zoonk.api.models.OnboardingAnswerInputOneOf8
import kotlinx.coroutines.launch

internal sealed interface CourseStartFailure {
    data class Limit(
        val reason: GoalLimitReason,
    ) : CourseStartFailure

    data object Failed : CourseStartFailure
}

internal class CourseStartViewModel(
    private val store: OnboardingStore,
    handle: SavedStateHandle,
) : ViewModel() {
    /** The page's visit: a start that didn't save says so only on it. */
    val visit = Visit()

    private var savedLevel by handle.saved { "" }

    var level by mutableStateOf(levelOf(savedLevel))
        private set

    /** Stays on once a start succeeds: the screen is on its way out to the goal. */
    var isStarting by mutableStateOf(false)
        private set

    private val startFailure = visit.outcome<CourseStartFailure>()

    /** Why the start didn't go through, on this visit: leaving for a refusal's remedy lets the allowance say again what's left. */
    val failure get() = startFailure.value

    /** The screen showing now leads there, since this outlives the one that tapped. */
    var started by mutableStateOf<CourseStarted?>(null)
        private set

    fun pick(next: LevelChoice) {
        level = next
        savedLevel = next.key()
    }

    /** A chapter's start skips the level: the plan starts at that chapter. */
    fun start(
        courseId: String,
        chapterId: String?,
        dailyMinutes: Int?,
    ) {
        if (isStarting) return
        isStarting = true
        startFailure.clear()
        val asked = visit.number
        viewModelScope.launch {
            when (val outcome = store.startCourse(courseId, chapterId, dailyMinutes, level.takeIf { chapterId == null })) {
                is WriteOutcome.Done -> {
                    started = outcome.value
                    return@launch
                }

                is WriteOutcome.Refused -> {
                    startFailure.send(asked, CourseStartFailure.Limit(outcome.refusal.goalLimitReason()))
                }

                WriteOutcome.Failed -> {
                    startFailure.send(asked, CourseStartFailure.Failed)
                }

                WriteOutcome.Obsolete -> {}
            }
            isStarting = false
        }
    }
}

private const val QUICK_TEST = "test"

private fun LevelChoice.key() = (this as? LevelChoice.Own)?.level?.value ?: QUICK_TEST

private fun levelOf(key: String): LevelChoice? =
    if (key == QUICK_TEST) {
        LevelChoice.QuickTest
    } else {
        OnboardingAnswerInputOneOf8.Level.entries
            .find { it.value == key }
            ?.let(LevelChoice::Own)
    }
