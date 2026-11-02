package com.zoonk.android.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.LineBreak

fun TextStyle.withTabularFigures(): TextStyle = copy(fontFeatureSettings = "tnum")

/**
 * Compose breaks Korean inside words, where Android's own text views (word style AUTO) and Korean
 * readers wrap between them, at the spaces.
 */
internal fun Typography.wrappedFor(language: String): Typography =
    if (language != "ko") {
        this
    } else {
        copy(
            displayLarge = displayLarge.byPhrase(),
            displayMedium = displayMedium.byPhrase(),
            displaySmall = displaySmall.byPhrase(),
            headlineLarge = headlineLarge.byPhrase(),
            headlineMedium = headlineMedium.byPhrase(),
            headlineSmall = headlineSmall.byPhrase(),
            titleLarge = titleLarge.byPhrase(),
            titleMedium = titleMedium.byPhrase(),
            titleSmall = titleSmall.byPhrase(),
            bodyLarge = bodyLarge.byPhrase(),
            bodyMedium = bodyMedium.byPhrase(),
            bodySmall = bodySmall.byPhrase(),
            labelLarge = labelLarge.byPhrase(),
            labelMedium = labelMedium.byPhrase(),
            labelSmall = labelSmall.byPhrase(),
        )
    }

private fun TextStyle.byPhrase(): TextStyle = copy(lineBreak = lineBreak.copy(wordBreak = LineBreak.WordBreak.Phrase))
