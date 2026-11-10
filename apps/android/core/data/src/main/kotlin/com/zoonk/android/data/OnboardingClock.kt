package com.zoonk.android.data

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.lifecycle.compose.LifecycleResumeEffect

@Composable
fun TrackVisibleWait(
    surface: String,
    contentKind: String,
    goalId: String? = null,
    onboardingId: String? = null,
    attemptId: String? = null,
) {
    val tracker = LocalEventTracker.current
    LifecycleResumeEffect(surface, goalId, onboardingId ?: attemptId) {
        val startedAt = System.currentTimeMillis()
        onPauseOrDispose {
            tracker.track(
                AnalyticsEvent.GenerationWaited(
                    surface,
                    contentKind,
                    startedAt,
                    System.currentTimeMillis(),
                    goalId,
                    onboardingId,
                    attemptId,
                ),
            )
        }
    }
}

@Composable
fun TrackOnboardingQuestion(
    goalId: String,
    question: String,
    onboardingId: String? = null,
) {
    val tracker = LocalEventTracker.current
    var shown by rememberSaveable(goalId, question) { mutableStateOf(false) }
    LifecycleResumeEffect(goalId, question) {
        if (!shown) {
            shown = true
            tracker.track(AnalyticsEvent.OnboardingProgressed("question_shown", goalId, onboardingId, question = question))
        }
        onPauseOrDispose {}
    }
}

@Composable
fun TrackDeckReceived(
    goalId: String,
    deckId: String?,
    onboardingId: String? = null,
) {
    val tracker = LocalEventTracker.current
    var received by rememberSaveable(goalId) { mutableStateOf(emptyList<String>()) }
    LifecycleResumeEffect(goalId, deckId) {
        if (deckId != null && deckId !in received) {
            received = received + deckId
            tracker.track(AnalyticsEvent.OnboardingProgressed("deck_received", goalId, onboardingId, deckId = deckId))
        }
        onPauseOrDispose {}
    }
}
