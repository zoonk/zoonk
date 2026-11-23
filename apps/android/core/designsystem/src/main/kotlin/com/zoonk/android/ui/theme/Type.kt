package com.zoonk.android.ui.theme

import androidx.annotation.FontRes
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.intl.LocaleList
import androidx.compose.ui.text.style.LineBreak
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.LayoutDirection
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
        // Text without letters ("+50", "−3", "<1%") reads left to right in every language, even in a mirrored screen.
        textDirection = TextDirection.ContentOrLtr,
    )

/**
 * Main's titles and questions balance their lines (`text-balance`), so a wrapped one never leaves a word alone, by the
 * normal rules: Compose's `LineBreak.Heading` also loosens them, which lets a Japanese line start with 々 in any app
 * language. Where a line may break between words is the theme's ([wrappedFor]), so this keeps it.
 */
fun TextStyle.balanced(): TextStyle =
    copy(lineBreak = lineBreak.copy(strategy = LineBreak.Strategy.Balanced, strictness = LineBreak.Strictness.Normal))

/** This look on a short label or control, which wraps as the theme's [label] does: balanced, and between phrases in Japanese and Korean. */
fun TextStyle.wrappedAs(label: TextStyle): TextStyle = copy(lineBreak = label.lineBreak, localeList = label.localeList)

private val material = Typography()

/** Material's slots, so its components (bars, buttons, navigation, dialogs, fields) take main's roles. */
internal val ZoonkMaterialTypography =
    with(material) {
        Typography(
            // A moment's or a result's leading number (main's `text-[2.5rem]` readouts).
            displayLarge = displayLarge.role(40f, 600, 44f, -0.04f).balanced(),
            displayMedium = displayMedium.role(40f, 600, 44f, -0.04f).balanced(),
            // `text-headline`: a course's, chapter's or lesson's name, a ceremony.
            displaySmall = displaySmall.role(34f, 640, 38f, -0.035f).balanced(),
            // `text-title`: a page's title (`PageTitle`).
            headlineLarge = headlineLarge.role(30f, 620, 33f, -0.035f).balanced(),
            headlineMedium = headlineMedium.role(30f, 620, 33f, -0.035f).balanced(),
            // `text-readout` at a block's size (`BigQuantity`), and headings that size.
            headlineSmall = headlineSmall.role(24f, 600, 30f, -0.04f).balanced(),
            // `text-section`, and a top app bar's title.
            titleLarge = titleLarge.role(20f, 600, 26f, -0.02f).balanced(),
            // A card's or a block's title at reading size, at Material's weight.
            titleMedium = titleMedium.role(16f, 500, 24f).balanced(),
            // A row's title (`ListRowTitle`), and what titles a card or an item.
            titleSmall = titleSmall.role(14f, 500, 20f).balanced(),
            // Reading: a question's context, Today's queue.
            bodyLarge = bodyLarge.role(16f, 400, 24f),
            // The app's body (`text-sm`).
            bodyMedium = bodyMedium.role(14f, 400, 20f),
            // A row's description and meta (`ListRowDescription`).
            bodySmall = bodySmall.role(12f, 400, 16f),
            // A button for a screen's action.
            labelLarge = labelLarge.role(15f, 500, 22f).balanced(),
            // A small button (`size="sm"`), navigation labels.
            labelMedium = labelMedium.role(13f, 500, 18f).balanced(),
            // Small marks and plot labels.
            labelSmall = labelSmall.role(11f, 500, 16f).balanced(),
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
    /** The table, code or words a check asks about, over its question (`LessonContext`). */
    val context: TextStyle,
    /** A lesson's question (`QUESTION_TEXT_CLASS`). */
    val question: TextStyle,
    /** The title a sheet's content starts with (`DrawerTitle`). */
    val sheetTitle: TextStyle,
    /** The words under a sheet's title (`text-reading leading-normal`). */
    val sheetText: TextStyle,
    /** `text-compact`: a suggestion line's words under its summary. */
    val compact: TextStyle,
    /** A checked answer's verdict (`FeedbackVerdict`), in its tone's word color. */
    val verdict: TextStyle,
    /** The word on a checked answer option (`ANSWER_TAG_CLASS`). */
    val tag: TextStyle,
    /** The buddy's words on its page, its hello included, and the learner's bubble; a panel's answers stay `bodyMedium`, as main's. */
    val message: TextStyle,
    /** Code, at a table's size (`CodeListing`, `CodeSnippet`). */
    val code: TextStyle,
    /** Code with a field in it (`CODE_FIELD_TEXT` on a phone). */
    val codeField: TextStyle,
)

internal val ZoonkTypeRoles =
    with(material) {
        ZoonkTypography(
            sectionTitle = titleSmall.role(14f, 600, 20f, -0.01f).balanced(),
            data = labelMedium.role(12f, 400, 16f, family = GeistMono),
            eyebrow = labelSmall.role(11.5f, 400, 16f, family = GeistMono),
            label = labelSmall.role(11.5f, 550, 16f, 0.04f),
            lead = bodyLarge.role(17f, 400, 26f, -0.01f),
            lessonText = bodyLarge.role(18f, 400, 29.25f),
            context = bodyLarge.role(16f, 400, 26f),
            question = titleMedium.role(19f, 560, 25.65f, -0.02f).balanced(),
            sheetTitle = titleMedium.role(18f, 600, 22.5f).balanced(),
            sheetText = bodyLarge.role(15f, 400, 22.5f),
            compact = bodyMedium.role(13f, 400, 18f),
            verdict = labelLarge.role(15f, 550, 24f),
            tag = labelSmall.role(11.5f, 550, 16f),
            message = bodyLarge.role(15f, 400, 23.25f),
            // Code wraps as an editor does: each row as full as it gets, never balanced.
            code = bodyMedium.role(14f, 400, 24f, 0f, family = GeistMono).copy(lineBreak = LineBreak.Simple),
            codeField = bodyLarge.role(16f, 400, 24f, 0f, family = GeistMono).copy(lineBreak = LineBreak.Simple),
        )
    }

internal val LocalZoonkTypography = staticCompositionLocalOf { ZoonkTypeRoles }

val MaterialTheme.zoonkType: ZoonkTypography
    @Composable
    @ReadOnlyComposable
    get() = LocalZoonkTypography.current

fun TextStyle.withTabularFigures(): TextStyle = copy(fontFeatureSettings = "tnum")

/**
 * Compose breaks Korean and Japanese inside words. Korean wraps between words, at the spaces, everywhere, as the web's
 * `keep-all` does. Japanese wraps between phrases only in a short control (a button, a chip, a label), so it never
 * splits a word; a sentence or a question wraps between characters, as on the web.
 */
internal fun Typography.wrappedFor(language: String): Typography =
    when (language) {
        "ko" -> {
            val phrase = phraseLocale(language)
            copy(
                displayLarge = displayLarge.byPhrase(phrase),
                displayMedium = displayMedium.byPhrase(phrase),
                displaySmall = displaySmall.byPhrase(phrase),
                headlineLarge = headlineLarge.byPhrase(phrase),
                headlineMedium = headlineMedium.byPhrase(phrase),
                headlineSmall = headlineSmall.byPhrase(phrase),
                titleLarge = titleLarge.byPhrase(phrase),
                titleMedium = titleMedium.byPhrase(phrase),
                titleSmall = titleSmall.byPhrase(phrase),
                bodyLarge = bodyLarge.byPhrase(phrase),
                bodyMedium = bodyMedium.byPhrase(phrase),
                bodySmall = bodySmall.byPhrase(phrase),
                labelLarge = labelLarge.byPhrase(phrase),
                labelMedium = labelMedium.byPhrase(phrase),
                labelSmall = labelSmall.byPhrase(phrase),
            )
        }

        "ja" -> {
            val phrase = phraseLocale(language)
            copy(
                labelLarge = labelLarge.byPhrase(phrase),
                labelMedium = labelMedium.byPhrase(phrase),
                labelSmall = labelSmall.byPhrase(phrase),
            )
        }

        else -> {
            this
        }
    }

internal fun ZoonkTypography.wrappedFor(language: String): ZoonkTypography =
    when (language) {
        "ko" -> {
            val phrase = phraseLocale(language)
            copy(
                sectionTitle = sectionTitle.byPhrase(phrase),
                lead = lead.byPhrase(phrase),
                lessonText = lessonText.byPhrase(phrase),
                context = context.byPhrase(phrase),
                question = question.byPhrase(phrase),
                sheetTitle = sheetTitle.byPhrase(phrase),
                sheetText = sheetText.byPhrase(phrase),
                compact = compact.byPhrase(phrase),
            )
        }

        "ja" -> {
            val phrase = phraseLocale(language)
            copy(label = label.byPhrase(phrase), tag = tag.byPhrase(phrase))
        }

        else -> {
            this
        }
    }

private fun phraseLocale(language: String) = LocaleList("$language-u-lw-phrase")

/**
 * Every paragraph starts on the screen's start side, as Android's `viewStart` does: an English
 * sentence in a mirrored screen ends on its right like the titles and rows around it, its words still
 * left to right. Compose's `TextAlign.Start` follows the text's own direction instead.
 */
internal fun Typography.startingOn(direction: LayoutDirection): Typography =
    copy(
        displayLarge = displayLarge.startingOn(direction),
        displayMedium = displayMedium.startingOn(direction),
        displaySmall = displaySmall.startingOn(direction),
        headlineLarge = headlineLarge.startingOn(direction),
        headlineMedium = headlineMedium.startingOn(direction),
        headlineSmall = headlineSmall.startingOn(direction),
        titleLarge = titleLarge.startingOn(direction),
        titleMedium = titleMedium.startingOn(direction),
        titleSmall = titleSmall.startingOn(direction),
        bodyLarge = bodyLarge.startingOn(direction),
        bodyMedium = bodyMedium.startingOn(direction),
        bodySmall = bodySmall.startingOn(direction),
        labelLarge = labelLarge.startingOn(direction),
        labelMedium = labelMedium.startingOn(direction),
        labelSmall = labelSmall.startingOn(direction),
    )

internal fun ZoonkTypography.startingOn(direction: LayoutDirection): ZoonkTypography =
    copy(
        sectionTitle = sectionTitle.startingOn(direction),
        data = data.startingOn(direction),
        eyebrow = eyebrow.startingOn(direction),
        label = label.startingOn(direction),
        lead = lead.startingOn(direction),
        lessonText = lessonText.startingOn(direction),
        context = context.startingOn(direction),
        question = question.startingOn(direction),
        verdict = verdict.startingOn(direction),
        tag = tag.startingOn(direction),
        message = message.startingOn(direction),
    )

private fun TextStyle.startingOn(direction: LayoutDirection): TextStyle = copy(textAlign = startOf(direction))

private fun startOf(direction: LayoutDirection): TextAlign = if (direction == LayoutDirection.Rtl) TextAlign.Right else TextAlign.Left

/**
 * The screen's start side whatever the text's direction, for text that sets its own alignment: Compose's
 * `TextAlign.Start` follows the text, so a number, which reads left to right, would start on the left of a mirrored screen.
 */
@Composable
@ReadOnlyComposable
fun layoutStart(): TextAlign = startOf(LocalLayoutDirection.current)

/** The screen's end side whatever the text's direction, as a list's number or a column of values ends. */
@Composable
@ReadOnlyComposable
fun layoutEnd(): TextAlign = if (LocalLayoutDirection.current == LayoutDirection.Rtl) TextAlign.Left else TextAlign.Right

private fun TextStyle.byPhrase(locale: LocaleList): TextStyle =
    copy(
        lineBreak = lineBreak.copy(wordBreak = LineBreak.WordBreak.Phrase),
        // Compose's intrinsic width reads the locale's breaks instead of the paragraph's word-break style.
        localeList = locale,
    )
