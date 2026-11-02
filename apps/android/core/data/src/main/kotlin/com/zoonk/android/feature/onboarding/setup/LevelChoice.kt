package com.zoonk.android.feature.onboarding.setup

import com.zoonk.api.models.OnboardingAnswerInputOneOf7

/** The quick test is the answer of a learner who isn't sure, and leaves their level to placement. */
sealed interface LevelChoice {
    data class Own(
        val level: OnboardingAnswerInputOneOf7.Level,
    ) : LevelChoice

    data object QuickTest : LevelChoice
}
