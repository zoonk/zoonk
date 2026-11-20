package com.zoonk.android.ui.components

import android.content.res.Configuration
import androidx.activity.ComponentActivity
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Text
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.test.getUnclippedBoundsInRoot
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.R
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.util.Locale

/**
 * The two pieces that put an action or a value beside their words or under them (a suggestion's line, a list row's
 * value), at every width from the narrowest phone to a tablet, 100% to 200% text, with each catalog's longest words
 * and longest short label: each lays out, and its action or value has a width inside the column.
 */
@RunWith(AndroidJUnit4::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(qualifiers = "w900dp-h1600dp")
class BesideOrUnderSweepTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    @Test
    fun anActionOrAValueBesideOrUnderItsWordsStaysOnScreenAtEveryWidthAndTextSize() {
        var case by mutableStateOf(Case(LOCALES.first().let(::longest), 320.dp, 1f))
        compose.setContent {
            ZoonkTheme {
                val density = LocalDensity.current
                CompositionLocalProvider(LocalDensity provides Density(density.density, case.fontScale)) {
                    Box(Modifier.width(case.width)) {
                        Column {
                            Suggestion(
                                label = case.words.long,
                                summary = case.words.long,
                                layout = SuggestionLayout.Line,
                                lineAction = {
                                    SuggestionAction(
                                        onClick = {},
                                        modifier = Modifier.testTag(ACTION),
                                    ) { Text(case.words.short) }
                                },
                            ) {}
                            ListRow(headline = { Text(case.words.long) }, meta = { Text(case.words.short, Modifier.testTag(VALUE)) })
                        }
                    }
                }
            }
        }

        for (locale in LOCALES) {
            val words = longest(locale)
            for (width in WIDTHS) {
                for (fontScale in FONT_SCALES) {
                    case = Case(words, width, fontScale)
                    compose.waitForIdle()
                    for (tag in listOf(ACTION, VALUE)) {
                        val node = compose.onNodeWithTag(tag, useUnmergedTree = true).assertExists().getUnclippedBoundsInRoot()
                        val where = "$tag at $locale, $width, ${fontScale}x: $node"
                        assertTrue("no width $where", node.right - node.left > 0.dp)
                        assertTrue("past the column $where", node.left >= 0.dp && node.right <= width + 1.dp)
                    }
                }
            }
        }
    }

    private data class Words(
        val long: String,
        val short: String,
    )

    private data class Case(
        val words: Words,
        val width: Dp,
        val fontScale: Float,
    )

    /** The catalog's longest string, and its longest short one (a label an action or a value could carry). */
    private fun longest(locale: Locale): Words {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val resources = context.createConfigurationContext(Configuration().apply { setLocale(locale) }).resources
        val strings = R.string::class.java.fields.mapNotNull { runCatching { resources.getString(it.getInt(null)) }.getOrNull() }
        return Words(long = strings.maxBy { it.length }, short = strings.filter { it.length <= SHORT }.maxBy { it.length })
    }

    private companion object {
        const val ACTION = "action"
        const val VALUE = "value"
        const val SHORT = 40
        val WIDTHS = listOf(240.dp, 320.dp, 411.dp, 600.dp, 840.dp)
        val FONT_SCALES = listOf(1f, 1.3f, 2f)
        val LOCALES = listOf("en", "de", "es", "fr", "it", "ja", "ko", "pl", "pt", "tr").map(Locale::forLanguageTag)
    }
}
