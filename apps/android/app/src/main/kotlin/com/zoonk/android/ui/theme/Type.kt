package com.zoonk.android.ui.theme

import androidx.compose.ui.text.TextStyle

/**
 * Figures of one width, so numbers that change or line up don't shift: a readout
 * (`displaySmall.withTabularFigures()`), a count, a timer, a row's trailing minutes. Text uses
 * Material's default type scale; which style each design-system role takes is in
 * `.agents/skills/android-material-guidelines/references/design-system.md`.
 */
fun TextStyle.withTabularFigures(): TextStyle = copy(fontFeatureSettings = "tnum")
