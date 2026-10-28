package com.zoonk.android.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/** Only meanings no Material role carries; add one only with its token in `globals.css`. */
@Immutable
data class ZoonkColors(
    /** Brain Power and nothing else. */
    val brain: Color,
    val brainText: Color,
    /** Never a dot: an amber dot is review and practice. */
    val warning: Color,
    val warningText: Color,
    val energy: Color,
    val selectedTint: Color,
    val kindReview: Color,
    val kindMock: Color,
    val kindConversation: Color,
    val kindMindMap: Color,
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

val MaterialTheme.zoonk: ZoonkColors
    @Composable
    @ReadOnlyComposable
    get() = LocalZoonkColors.current
