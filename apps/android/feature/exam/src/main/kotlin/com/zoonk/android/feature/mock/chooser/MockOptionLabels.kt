package com.zoonk.android.feature.mock.chooser

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.feature.mock.mockDaySize
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
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

@Composable
internal fun mockOptionName(
    option: MockOption,
    severalDays: Boolean,
): String {
    if (option.kind == MockOption.Kind.AREA) {
        return option.areas.firstOrNull() ?: option.area ?: stringResource(R.string.mock_chooser_one_subject)
    }

    val day = if (severalDays) option.day ?: 1 else null
    val unpicked = option.leftOut.filter { it.part == MockLeftOut.Part.CHOICE }.mapNotNull { it.name }
    if (option.kind == MockOption.Kind.FULL && unpicked.isNotEmpty()) {
        val names = formatList(unpicked, currentLocale())
        return day?.let { stringResource(R.string.mock_chooser_full_day_number_without, it, names) }
            ?: stringResource(R.string.mock_chooser_full_day_without, names)
    }

    return mockDaySize(fullLength = option.kind == MockOption.Kind.FULL, day = day)
}

/** What an option asks beyond its name: the parts it sits, its day's subjects, its written parts. */
@Composable
internal fun mockOptionDetail(
    option: MockOption,
    severalDays: Boolean,
): String? {
    val locale = currentLocale()
    val covers = option.covers?.takeIf { it.isNotEmpty() }?.let { formatList(it, locale) }
    val subjects =
        option.areas.takeIf { severalDays && option.kind != MockOption.Kind.AREA && it.isNotEmpty() }?.let {
            formatList(
                it,
                locale,
            )
        }
    val written = option.written.takeIf { it.isNotEmpty() }?.let { stringResource(R.string.mock_chooser_written, formatList(it, locale)) }
    val objective = stringResource(R.string.mock_chooser_objective_only).takeIf { option.objectiveOnly && covers == null }

    return listOfNotNull(covers, subjects, written, objective).factsLine().ifEmpty { null }
}

private const val SECONDS_PER_MINUTE = 60L
