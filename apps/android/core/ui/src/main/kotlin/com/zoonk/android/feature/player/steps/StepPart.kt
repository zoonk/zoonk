package com.zoonk.android.feature.player.steps

/**
 * What of a screen a view draws, in a lesson or a practice run: all of it in one column, or one
 * page of an unfolded book's spread, the screen (its question, teaching or passage) on the page
 * before the fold and the learner's turn (options, fields, canvases, feedback) on the page after
 * it. A view draws its turn at the same place for [Whole] and [Turn], so work not yet sent stays
 * when the book opens or closes.
 */
enum class StepPart {
    Whole,
    Screen,
    Turn,
    ;

    val showsScreen get() = this != Turn
    val showsTurn get() = this != Screen
}
