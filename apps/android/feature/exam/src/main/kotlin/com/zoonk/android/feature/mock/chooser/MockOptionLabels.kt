package com.zoonk.android.feature.mock.chooser

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDuration
import com.zoonk.android.ui.format.formatList
import com.zoonk.api.models.MockLeftOut
import com.zoonk.api.models.MockOption
import com.zoonk.api.models.MockShape

/** Main's `getMockOptionKey`: an option is its kind, day and subject. */
internal val MockOption.key: String
    get() = listOf(kind.value, day?.toString().orEmpty(), area.orEmpty()).joinToString(":")

internal val MockOption.shape: MockShape
    get() = MockShape(area = area, day = day, kind = MockShape.Kind.valueOf(kind.name))

@Composable
internal fun minutesText(minutes: Long): String = formatDuration(minutes * SECONDS_PER_MINUTE, currentLocale())

/** "Day 1", "Half of day 2", "The full exam", "Half the exam", or a subject. */
@Composable
internal fun mockOptionName(
    option: MockOption,
    severalDays: Boolean,
): String {
    val day = (option.day ?: 1).toInt()
    if (option.kind == MockOption.Kind.AREA) {
        return option.areas.firstOrNull() ?: option.area ?: stringResource(R.string.mock_chooser_one_subject)
    }
    if (option.kind == MockOption.Kind.HALF) {
        return if (severalDays) stringResource(R.string.mock_chooser_half_day, day) else stringResource(R.string.mock_chooser_half_exam)
    }

    val unpicked = option.leftOut.filter { it.part == MockLeftOut.Part.CHOICE }.mapNotNull { it.name }
    if (unpicked.isNotEmpty()) {
        val names = formatList(unpicked, currentLocale())
        return if (severalDays) {
            stringResource(R.string.mock_chooser_day_without, day, names)
        } else {
            stringResource(R.string.mock_chooser_full_exam_without, names)
        }
    }
    return if (severalDays) stringResource(R.string.mock_chooser_day, day) else stringResource(R.string.mock_chooser_full_exam)
}

/** A row's one line: what the mock exam asks. */
@Composable
internal fun mockOptionDetail(
    option: MockOption,
    severalDays: Boolean,
): String? {
    val subjects = option.areas.takeIf { severalDays && option.kind != MockOption.Kind.AREA }.orEmpty()
    val parts = option.covers ?: (subjects + option.written)
    return when {
        parts.isNotEmpty() -> formatList(parts, currentLocale())
        option.objectiveOnly -> stringResource(R.string.mock_chooser_no_written_part)
        else -> null
    }
}

/** "90 questions · 4 hr 42 min". */
@Composable
internal fun mockOptionSize(option: MockOption): String {
    val questions = option.questions.toInt()
    return pluralStringResource(R.plurals.mock_chooser_option_size, questions, questions, minutesText(option.estimatedMinutes))
}

private const val SECONDS_PER_MINUTE = 60L
