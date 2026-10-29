package com.zoonk.android.feature.mock.chooser

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.feature.mock.mockDaySize
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDuration
import com.zoonk.android.ui.format.formatList
import com.zoonk.api.models.MockOption
import com.zoonk.api.models.MockShape
import com.zoonk.api.models.PlacementMockOption

/** Main's `getMockOptionKey`: an option is its kind, day and subject. */
internal val MockOption.key: String
    get() = listOf(kind.value, day?.toString().orEmpty(), area.orEmpty()).joinToString(":")

internal val MockOption.shape: MockShape
    get() = MockShape(area = area, day = day, kind = MockShape.Kind.valueOf(kind.name))

internal val PlacementMockOption.key: String
    get() = "placement:${length.value}"

@Composable
internal fun minutesText(minutes: Long): String = formatDuration(minutes * SECONDS_PER_MINUTE, currentLocale())

@Composable
internal fun mockOptionName(
    option: MockOption,
    severalDays: Boolean,
): String =
    if (option.kind == MockOption.Kind.AREA) {
        option.areas.firstOrNull() ?: option.area ?: stringResource(R.string.mock_chooser_one_subject)
    } else {
        mockDaySize(fullLength = option.kind == MockOption.Kind.FULL, day = if (severalDays) option.day ?: 1 else null)
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

    return listOfNotNull(covers, subjects, written, objective).joinToString(" · ").ifEmpty { null }
}

@Composable
internal fun placementLength(
    option: PlacementMockOption,
    recommended: Boolean,
): String {
    val time = minutesText(option.estimatedMinutes)
    return stringResource(if (recommended) R.string.mock_chooser_about_recommended else R.string.mock_chooser_about, time)
}

/** How precise a starting point each length finds. */
@Composable
internal fun placementPrecision(option: PlacementMockOption): String =
    when {
        !option.coversAllAreas && option.areas.size == 1 -> {
            stringResource(R.string.mock_chooser_placement_top_subject)
        }

        !option.coversAllAreas -> {
            pluralStringResource(R.plurals.mock_chooser_placement_top_subjects, option.areas.size, option.areas.size)
        }

        option.length == PlacementMockOption.Length.SHORT -> {
            stringResource(R.string.mock_chooser_placement_short)
        }

        option.length == PlacementMockOption.Length.LONG -> {
            stringResource(R.string.mock_chooser_placement_long)
        }

        else -> {
            stringResource(R.string.mock_chooser_placement_medium)
        }
    }

private const val SECONDS_PER_MINUTE = 60L
