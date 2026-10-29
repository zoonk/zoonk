package com.zoonk.android.feature.onboarding.course

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.serialization.saved
import androidx.lifecycle.viewModelScope
import com.zoonk.android.feature.onboarding.GoalLimitReason
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.WriteOutcome
import com.zoonk.android.feature.onboarding.goalLimitReason
import com.zoonk.android.feature.onboarding.setup.LevelChoice
import com.zoonk.api.models.OnboardingAnswerInputOneOf7
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
    private var savedLevel by handle.saved { "" }

    var level by mutableStateOf(levelOf(savedLevel))
        private set

    /** Stays on once a start succeeds: the screen is on its way out to the goal. */
    var isStarting by mutableStateOf(false)
        private set

    var failure by mutableStateOf<CourseStartFailure?>(null)
        private set

    fun pick(next: LevelChoice) {
        level = next
        savedLevel = next.key()
    }

    /** Leaving for a refusal's remedy (an account, Plus, the Plan) lets the allowance say again what's left. */
    fun clearFailure() {
        failure = null
    }

    /** A chapter's start skips the level: the plan starts at that chapter. */
    fun start(
        courseId: String,
        chapterId: String?,
        dailyMinutes: Int?,
        onStarted: (goalId: String, inSetup: Boolean) -> Unit,
    ) {
        if (isStarting) return
        isStarting = true
        failure = null
        viewModelScope.launch {
            when (val outcome = store.startCourse(courseId, chapterId, dailyMinutes, level.takeIf { chapterId == null })) {
                is WriteOutcome.Done -> {
                    return@launch onStarted(outcome.value.goalId, outcome.value.inSetup)
                }

                is WriteOutcome.Refused -> {
                    failure = CourseStartFailure.Limit(outcome.refusal.goalLimitReason())
                }

                WriteOutcome.Failed -> {
                    failure = CourseStartFailure.Failed
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
        OnboardingAnswerInputOneOf7.Level.entries
            .find { it.value == key }
            ?.let(LevelChoice::Own)
    }
