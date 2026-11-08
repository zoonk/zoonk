package com.zoonk.android.feature.certificates

import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.feature.catalog.courseLevelName
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatNumber
import com.zoonk.api.models.OwnedCertificate
import com.zoonk.api.models.OwnedCertificateFacts
import kotlinx.datetime.LocalDate
import kotlinx.datetime.toJavaLocalDate
import kotlin.math.roundToInt

/**
 * What names a certificate, the same in a completion's facts and in the learner's list, so the
 * award moment can say what was earned, and show it locked, before the list with its pictures
 * arrives. [courseLevel] is the API's value of the course level it certifies, null for a whole plan.
 */
@Immutable
data class CertificateName(
    val code: String,
    val title: String,
    val courseLevel: String?,
    val cefrRange: String?,
    val completedOn: LocalDate,
    val locked: Boolean,
)

val OwnedCertificate.naming: CertificateName
    get() = CertificateName(code, title, courseLevel?.value, cefrRange, completedOn, locked)

val OwnedCertificateFacts.naming: CertificateName
    get() = CertificateName(code, title, courseLevel?.value, cefrRange, completedOn, locked)

@Composable
@ReadOnlyComposable
fun certificateLevelName(
    courseLevel: String,
    cefrRange: String?,
): String {
    val level = courseLevelName(courseLevel)
    return cefrRange?.let { stringResource(R.string.certificates_level_range, level, it) } ?: level
}

@Composable
@ReadOnlyComposable
fun CertificateName.words(): String =
    courseLevel?.let { stringResource(R.string.certificates_course_level, title, certificateLevelName(it, cefrRange)) } ?: title

/** "Certificate of completion · Nov 3, 2026", as lists show it. */
@Composable
@ReadOnlyComposable
fun CertificateName.kindLine(): String =
    factsLine(
        stringResource(R.string.certificates_kind_completion),
        formatDate(completedOn.toJavaLocalDate(), currentLocale(), DateStyle.Short),
    )

/** Main's `useCertificateSentence`: the certificate page's headline, which a reader checks. */
@Composable
@ReadOnlyComposable
fun OwnedCertificate.sentence(): String {
    val recipient = recipientName
    return if (recipient != null) {
        stringResource(R.string.certificates_alt_course, recipient, naming.words())
    } else {
        stringResource(R.string.certificates_course_on_zoonk, naming.words())
    }
}

/** What the picture says, for TalkBack: the page's headline and the day it was earned. */
@Composable
@ReadOnlyComposable
fun OwnedCertificate.pictureLabel(): String {
    val day = formatDate(completedOn.toJavaLocalDate(), currentLocale(), DateStyle.LongYear)
    return stringResource(R.string.certificates_alt_dated, sentence(), day)
}

/** The text a share suggests, as Main words it: lessons studied, never lessons skipped, and the study time only when known. */
@Composable
@ReadOnlyComposable
fun OwnedCertificate.caption(): String {
    val locale = currentLocale()
    val name = naming.words()
    val studied = (lessonsStudied ?: 0).toInt()
    val studyMinutes = minutes?.toInt()?.takeIf { it > 0 }
    if (studied == 0) {
        return stringResource(R.string.certificates_caption_course_tested_out, name)
    }
    val lessons = pluralStringResource(R.plurals.certificates_lessons, studied, formatNumber(studied.toDouble(), locale))
    return when {
        studyMinutes == null -> {
            stringResource(R.string.certificates_caption_course, name, lessons)
        }

        studyMinutes < MINUTES_PER_HOUR -> {
            pluralStringResource(
                R.plurals.certificates_caption_course_minutes,
                studyMinutes,
                name,
                lessons,
                studyMinutes,
            )
        }

        else -> {
            val hours = (studyMinutes / MINUTES_PER_HOUR.toDouble()).roundToInt()
            pluralStringResource(R.plurals.certificates_caption_course_hours, hours, name, lessons, hours)
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
