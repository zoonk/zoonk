package com.zoonk.android.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/**
 * The design system's meanings no Material role carries, in the current scheme, read as
 * `MaterialTheme.zoonk.brain`. Everything else is a `MaterialTheme.colorScheme` role. Add a color
 * here only for a new meaning, with its token in `globals.css` and every scheme's value.
 */
@Immutable
data class ZoonkColors(
    /** Brain Power and nothing else: a reward's mark, the missions' track. */
    val brain: Color,
    /** Brain Power in words: "+50", a reward's number. */
    val brainText: Color,
    /** Look here: a flag, a suggestion, the one thing to improve. On icons and chips, never a dot. */
    val warning: Color,
    /** Look here, in words. */
    val warningText: Color,
    /** The buddy's Energy: its meter and its bolt. */
    val energy: Color,
    /** The faint fill under the learner's pick before it's checked; its ring is `primary`. */
    val selectedTint: Color,
    /** Going back over what was learned: a review, practice, the mistakes notebook. */
    val kindReview: Color,
    /** Testing what the learner knows: a mock exam, a challenge. */
    val kindMock: Color,
    /** Making something yourself: a conversation, an essay. */
    val kindConversation: Color,
    /** A mind map. */
    val kindMindMap: Color,
    /** Belts keep their full colors in every scheme: they're the learner's identity, not a meaning. */
    val beltWhite: Color,
    val beltYellow: Color,
    val beltOrange: Color,
    val beltGreen: Color,
    val beltBlue: Color,
    val beltPurple: Color,
    val beltBrown: Color,
    val beltRed: Color,
    val beltGray: Color,
    val beltBlack: Color,
)

internal fun ZoonkPalette.zoonkColors() =
    ZoonkColors(
        brain = brain,
        brainText = brainText,
        warning = warning,
        warningText = warningText,
        energy = energy,
        selectedTint = selectedTint,
        kindReview = kindReview,
        kindMock = kindMock,
        kindConversation = kindConversation,
        kindMindMap = kindMindMap,
        beltWhite = beltWhite,
        beltYellow = beltYellow,
        beltOrange = beltOrange,
        beltGreen = beltGreen,
        beltBlue = beltBlue,
        beltPurple = beltPurple,
        beltBrown = beltBrown,
        beltRed = beltRed,
        beltGray = beltGray,
        beltBlack = beltBlack,
    )

internal val LocalZoonkColors = staticCompositionLocalOf { LightPalette.zoonkColors() }

/** Zoonk's own colors in the current scheme, beside `MaterialTheme.colorScheme`. */
val MaterialTheme.zoonk: ZoonkColors
    @Composable
    @ReadOnlyComposable
    get() = LocalZoonkColors.current
