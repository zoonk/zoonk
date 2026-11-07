package com.zoonk.android.ui.theme

import androidx.annotation.FontRes
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.LineBreak
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.zoonk.android.R

/*
 * Main's type roles (`text-*` in globals.css, measured at 390px), the same numbers as the Apple app's
 * `DesignSystem/Typography.swift`. Sizes are in sp, so they follow the font scale; Bold Text adds 300 to
 * every weight before Compose picks a font (API 31+), so each family carries the heavier weights too.
 */

private fun variable(
    @FontRes font: Int,
): FontFamily =
    FontFamily(
        // Geist's `wght` axis runs from 100 to 900; the roles use 550, 620 and 640 too, and Bold Text's 850 and up.
        ((100..900 step 50) + listOf(620, 640)).map {
            Font(font, FontWeight(it), variationSettings = FontVariation.Settings(FontVariation.weight(it)))
        },
    )

/** Main's `font-sans`. Scripts it lacks (Japanese, Korean, Arabic) fall back to the system's, as on main. */
val Geist = variable(R.font.geist)

/** Main's `font-mono`: data that lines up (minutes, counts, dates), the eyebrow and code. Fixed width, so its figures are tabular. */
val GeistMono = variable(R.font.geist_mono)

/** Main's `body`: every role but the readouts and titles keeps its slight tightening. */
private const val BODY_TRACKING = -0.006f

private fun TextStyle.role(
    size: Float,
    weight: Int,
    lineHeight: Float,
    tracking: Float = BODY_TRACKING,
    family: FontFamily = Geist,
): TextStyle =
    copy(
        fontFamily = family,
        fontSize = size.sp,
        fontWeight = FontWeight(weight),
        lineHeight = lineHeight.sp,
        letterSpacing = tracking.em,
    )

private val material = Typography()

/** Material's slots, so its components (bars, buttons, navigation, dialogs, fields) take main's roles. */
internal val ZoonkMaterialTypography =
    with(material) {
        Typography(
            // A moment's or a result's leading number (main's `text-[2.5rem]` readouts).
            displayLarge = displayLarge.role(40f, 600, 44f, -0.04f),
            displayMedium = displayMedium.role(40f, 600, 44f, -0.04f),
            // `text-headline`: a course's, chapter's or lesson's name, a ceremony.
            displaySmall = displaySmall.role(34f, 640, 38f, -0.035f),
            // `text-title`: a page's title (`PageTitle`).
            headlineLarge = headlineLarge.role(30f, 620, 33f, -0.035f),
            headlineMedium = headlineMedium.role(30f, 620, 33f, -0.035f),
            // `text-readout` at a block's size (`BigQuantity`), and headings that size.
            headlineSmall = headlineSmall.role(24f, 600, 30f, -0.04f),
            // `text-section`, and a top app bar's title.
            titleLarge = titleLarge.role(20f, 600, 26f, -0.02f),
            // A card's or a block's title at reading size, at Material's weight.
            titleMedium = titleMedium.role(16f, 500, 24f),
            // A row's title (`ListRowTitle`), and what titles a card or an item.
            titleSmall = titleSmall.role(14f, 500, 20f),
            // Reading: a question's context, Today's queue.
            bodyLarge = bodyLarge.role(16f, 400, 24f),
            // The app's body (`text-sm`).
            bodyMedium = bodyMedium.role(14f, 400, 20f),
            // A row's description and meta (`ListRowDescription`).
            bodySmall = bodySmall.role(12f, 400, 16f),
            // A button for a screen's action.
            labelLarge = labelLarge.role(15f, 500, 22f),
            // A small button (`size="sm"`), navigation labels.
            labelMedium = labelMedium.role(13f, 500, 18f),
            // Small marks and plot labels.
            labelSmall = labelSmall.role(11f, 500, 16f),
        )
    }

/** Main's roles that no Material slot carries. Read through [MaterialTheme.zoonkType]. */
@Immutable
data class ZoonkTypography(
    /** `PageSectionTitle` (`SectionHeader`). */
    val sectionTitle: TextStyle,
    /** `ListRowTrailing`, `PageSectionDetail`: data that lines up, in `onSurfaceVariant`. */
    val data: TextStyle,
    /** `PageEyebrow`, uppercase (the `Eyebrow` composable writes it so), in `faint`. */
    val eyebrow: TextStyle,
    /** `text-label`: a panel's or a stat's label, uppercase (`StatTile` writes it so), in `faint`. */
    val label: TextStyle,
    /** `text-lead`, in `onSurfaceVariant`. */
    val lead: TextStyle,
    /** A lesson's running text (`LessonBody`). */
    val lessonText: TextStyle,
    /** A lesson's question (`QUESTION_TEXT_CLASS`). */
    val question: TextStyle,
    /** A checked answer's verdict (`FeedbackVerdict`), in its tone's word color. */
    val verdict: TextStyle,
    /** The word on a checked answer option (`ANSWER_TAG_CLASS`). */
    val tag: TextStyle,
    /** The buddy's words on its page, its hello included, and the learner's bubble; a panel's answers stay `bodyMedium`, as main's. */
    val message: TextStyle,
)

internal val ZoonkTypeRoles =
    with(material) {
        ZoonkTypography(
            sectionTitle = titleSmall.role(14f, 600, 20f, -0.01f),
            data = labelMedium.role(12f, 400, 16f, family = GeistMono),
            eyebrow = labelSmall.role(11.5f, 400, 16f, family = GeistMono),
            label = labelSmall.role(11.5f, 550, 16f, 0.04f),
            lead = bodyLarge.role(17f, 400, 26f, -0.01f),
            lessonText = bodyLarge.role(18f, 400, 29.25f),
            question = titleMedium.role(19f, 560, 25.65f, -0.02f),
            verdict = labelLarge.role(15f, 550, 24f),
            tag = labelSmall.role(11.5f, 550, 16f),
            message = bodyLarge.role(15f, 400, 23.25f),
        )
    }

internal val LocalZoonkTypography = staticCompositionLocalOf { ZoonkTypeRoles }

val MaterialTheme.zoonkType: ZoonkTypography
    @Composable
    @ReadOnlyComposable
    get() = LocalZoonkTypography.current

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

internal fun ZoonkTypography.wrappedFor(language: String): ZoonkTypography =
    if (language != "ko") {
        this
    } else {
        copy(
            sectionTitle = sectionTitle.byPhrase(),
            lead = lead.byPhrase(),
            lessonText = lessonText.byPhrase(),
            question = question.byPhrase(),
        )
    }

private fun TextStyle.byPhrase(): TextStyle = copy(lineBreak = lineBreak.copy(wordBreak = LineBreak.WordBreak.Phrase))
