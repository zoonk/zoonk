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

enum class CertificateKind { Course, LanguageLevel }

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

private fun kindOf(value: String) = if (value == "languageLevel") CertificateKind.LanguageLevel else CertificateKind.Course

/** The language a level certifies, capitalized as a title: "Spanish", pt "Espanhol". */
@Composable
@ReadOnlyComposable
fun CertificateName.languageWord(): String {
    val locale = currentLocale()
    return targetLanguage?.let { languageName(it, locale).replaceFirstChar { first -> first.titlecase(locale) } }.orEmpty()
}

@Composable
@ReadOnlyComposable
fun CertificateName.words(): String =
    when (kind) {
        CertificateKind.Course -> title.orEmpty()
        else -> stringResource(R.string.certificates_language_level, languageWord(), level.orEmpty())
    }

/** "Certificate of completion · Nov 3, 2026", as lists show it. */
@Composable
@ReadOnlyComposable
fun OwnedCertificate.kindLine(): String =
    factsLine(
        stringResource(R.string.certificates_kind_completion),
        formatDate(completedOn.toJavaLocalDate(), currentLocale(), DateStyle.Short),
    )

/** What the picture says, for TalkBack: main's page heading and the day it was earned. */
@Composable
@ReadOnlyComposable
fun OwnedCertificate.pictureLabel(): String {
    val recipient = recipientName
    val level = level?.value.orEmpty()
    val heading =
        when {
            recipient == null -> {
                factsLine(stringResource(R.string.certificates_kind_completion), naming.words())
            }

            naming.kind == CertificateKind.Course -> {
                stringResource(R.string.certificates_alt_course, recipient, title.orEmpty())
            }

            else -> {
                stringResource(
                    R.string.certificates_alt_level,
                    recipient,
                    level,
                    naming.languageWord(),
                )
            }
        }
    val day = formatDate(completedOn.toJavaLocalDate(), currentLocale(), DateStyle.LongYear)
    return stringResource(R.string.certificates_alt_dated, heading, day)
}

/** The text a share suggests, as Main words it: lessons studied, never lessons skipped, and the study time only when known. */
@Composable
@ReadOnlyComposable
fun OwnedCertificate.caption(): String {
    val locale = currentLocale()
    val level = level?.value.orEmpty()
    return when (naming.kind) {
        CertificateKind.Course -> {
            val studied = (lessonsStudied ?: 0).toInt()
            val studyMinutes = minutes?.toInt()?.takeIf { it > 0 }
            if (studied == 0) {
                return stringResource(R.string.certificates_caption_course_tested_out, title.orEmpty())
            }
            val lessons = pluralStringResource(R.plurals.certificates_lessons, studied, formatNumber(studied.toDouble(), locale))
            when {
                studyMinutes == null -> {
                    stringResource(R.string.certificates_caption_course, title.orEmpty(), lessons)
                }

                studyMinutes < MINUTES_PER_HOUR -> {
                    pluralStringResource(
                        R.plurals.certificates_caption_course_minutes,
                        studyMinutes,
                        title.orEmpty(),
                        lessons,
                        studyMinutes,
                    )
                }

                else -> {
                    val hours = (studyMinutes / MINUTES_PER_HOUR.toDouble()).roundToInt()
                    pluralStringResource(R.plurals.certificates_caption_course_hours, hours, title.orEmpty(), lessons, hours)
                }
            }
        }

        CertificateKind.LanguageLevel -> {
            stringResource(R.string.certificates_caption_level, level, naming.languageWord())
        }
    }
}

/** Main's download name, "Ana Souza - Quantum physics from scratch - Zoonk.png", safe as a file name. */
@Composable
@ReadOnlyComposable
fun OwnedCertificate.fileName(): String = pictureFileName(listOfNotNull(recipientName, naming.words(), stringResource(R.string.app_name)))

/** Android's file names hold 255 bytes, and a CJK letter takes three, so the name is cut by bytes, whole letters only. */
internal fun pictureFileName(parts: List<String>): String {
    val name = parts.joinToString(" - ").replace(UNSAFE_FILE_CHARACTERS, " ")
    var end = 0
    var bytes = 0
    while (end < name.length) {
        val next = name.offsetByCodePoints(end, 1)
        bytes += name.substring(end, next).encodeToByteArray().size
        if (bytes > MAX_FILE_NAME_BYTES) break
        end = next
    }
    return name.substring(0, end).trimEnd() + ".png"
}

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
private const val MAX_FILE_NAME_BYTES = 200
private val UNSAFE_FILE_CHARACTERS = Regex("[\\\\/:*?\"<>|\\p{Cc}]")
