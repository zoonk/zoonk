package com.zoonk.android.feature.certificates

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.android.ui.format.languageName
import com.zoonk.api.models.CertificateFacts
import com.zoonk.api.models.OwnedCertificate
import kotlinx.datetime.toJavaLocalDate
import kotlin.math.roundToInt

enum class CertificateKind { Course, LanguageLevel, Placement }

/**
 * What names a certificate, the same in a completion's facts and in the learner's list, so the
 * award moment can say what was earned before the list with its pictures arrives.
 */
@Immutable
data class CertificateName(
    val code: String,
    val kind: CertificateKind,
    val title: String?,
    val targetLanguage: String?,
    val level: String?,
)

val OwnedCertificate.naming: CertificateName
    get() = CertificateName(code, kindOf(kind.value), title, targetLanguage, level?.value)

val CertificateFacts.naming: CertificateName
    get() = CertificateName(code, kindOf(kind.value), title, targetLanguage, level?.value)

private fun kindOf(value: String) =
    when (value) {
        "course" -> CertificateKind.Course
        "languageLevel" -> CertificateKind.LanguageLevel
        else -> CertificateKind.Placement
    }

/** The language a level or placement certifies, capitalized as a title: "Spanish", pt "Espanhol". */
@Composable
@ReadOnlyComposable
fun CertificateName.languageWord(): String {
    val locale = currentLocale()
    return targetLanguage?.let { languageName(it, locale).replaceFirstChar { first -> first.titlecase(locale) } }.orEmpty()
}

/** A course's title, or "Spanish B1" for a level or a placement, which [kindWord] tells apart. */
@Composable
@ReadOnlyComposable
fun CertificateName.words(): String =
    when (kind) {
        CertificateKind.Course -> title.orEmpty()
        else -> stringResource(R.string.certificates_language_level, languageWord(), level.orEmpty())
    }

@Composable
@ReadOnlyComposable
fun OwnedCertificate.kindWord(): String =
    stringResource(
        if (naming.kind ==
            CertificateKind.Placement
        ) {
            R.string.certificates_kind_placement
        } else {
            R.string.certificates_kind_completion
        },
    )

/** "Certificate of completion · Nov 3, 2026", as lists show it. */
@Composable
@ReadOnlyComposable
fun OwnedCertificate.kindLine(): String = factsLine(kindWord(), formatDate(completedOn.toJavaLocalDate(), currentLocale(), DateStyle.Short))

/** What the picture says, for TalkBack: main's page heading and the day it was earned. */
@Composable
@ReadOnlyComposable
fun OwnedCertificate.pictureLabel(): String {
    val recipient = recipientName
    val level = level?.value.orEmpty()
    val heading =
        when {
            recipient == null -> {
                factsLine(kindWord(), naming.words())
            }

            naming.kind == CertificateKind.Course -> {
                stringResource(R.string.certificates_alt_course, recipient, title.orEmpty())
            }

            naming.kind == CertificateKind.LanguageLevel -> {
                stringResource(
                    R.string.certificates_alt_level,
                    recipient,
                    level,
                    naming.languageWord(),
                )
            }

            else -> {
                stringResource(R.string.certificates_alt_placement, recipient, naming.languageWord(), level)
            }
        }
    val day = formatDate(completedOn.toJavaLocalDate(), currentLocale(), DateStyle.LongYear)
    return stringResource(R.string.certificates_alt_dated, heading, day)
}

/** The text a share suggests: lessons studied, never lessons skipped, and the hours only when known. */
@Composable
@ReadOnlyComposable
fun OwnedCertificate.caption(): String {
    val locale = currentLocale()
    val level = level?.value.orEmpty()
    return when (naming.kind) {
        CertificateKind.Course -> {
            val studied = (lessonsStudied ?: 0).toInt()
            val lessons = pluralStringResource(R.plurals.certificates_lessons, studied, formatNumber(studied.toDouble(), locale))
            val hours = minutes?.let { (it / MINUTES_PER_HOUR.toDouble()).roundToInt() }?.takeIf { it > 0 }
            if (hours == null) {
                stringResource(R.string.certificates_caption_course, title.orEmpty(), lessons)
            } else {
                pluralStringResource(R.plurals.certificates_caption_course_hours, hours, title.orEmpty(), lessons, hours)
            }
        }

        CertificateKind.LanguageLevel -> {
            stringResource(R.string.certificates_caption_level, level, naming.languageWord())
        }

        CertificateKind.Placement -> {
            stringResource(R.string.certificates_caption_placement, naming.languageWord(), level)
        }
    }
}

/** The name LinkedIn's form takes: the course, "Spanish B1", or "Spanish B1 placement result". */
@Composable
@ReadOnlyComposable
fun OwnedCertificate.linkedInName(): String =
    if (naming.kind == CertificateKind.Placement) {
        stringResource(R.string.certificates_linkedin_placement_name, naming.languageWord(), level?.value.orEmpty())
    } else {
        naming.words()
    }

/** Main's download name, "Ana Souza - Quantum physics from scratch - Zoonk.png", safe as a file name. */
@Composable
@ReadOnlyComposable
fun OwnedCertificate.fileName(): String =
    listOfNotNull(recipientName, naming.words(), stringResource(R.string.app_name))
        .joinToString(" - ")
        .replace(UNSAFE_FILE_CHARACTERS, " ")
        .take(MAX_FILE_NAME) + ".png"

/** Main's credential id, in groups of four: "K7QF-2M9X-HD4P". */
fun formatCertificateCode(code: String): String = code.chunked(CODE_GROUP).joinToString("-")

/** Main's `normalizeCertificateCode`: any case, with dashes or spaces, I or L for 1 and O for 0. */
fun normalizeCertificateCode(input: String): String =
    input
        .uppercase()
        .replace(Regex("[\\s-]"), "")
        .replace(Regex("[IL]"), "1")
        .replace("O", "0")

private const val MINUTES_PER_HOUR = 60
private const val CODE_GROUP = 4
private const val MAX_FILE_NAME = 120
private val UNSAFE_FILE_CHARACTERS = Regex("[\\\\/:*?\"<>|\\p{Cc}]")
