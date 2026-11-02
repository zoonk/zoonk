package com.zoonk.android.ui.components

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RichTooltip
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TooltipAnchorPosition
import androidx.compose.material3.TooltipBox
import androidx.compose.material3.TooltipDefaults
import androidx.compose.material3.rememberTooltipState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.app.openWebPage
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.ZoneOffset

/** Main's `SourcesChip`: when a public document was last checked, opening its title, publisher and link. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SourcesChip(
    title: String,
    publisher: String?,
    url: String?,
    checkedAt: Instant,
) {
    val locale = currentLocale()
    val context = LocalContext.current
    val tooltip = rememberTooltipState(isPersistent = true)
    val scope = rememberCoroutineScope()
    val checked = checkedAt.atZone(ZoneOffset.UTC).toLocalDate()
    val day = formatDate(checked, locale, DateStyle.Short)

    TooltipBox(
        positionProvider = TooltipDefaults.rememberTooltipPositionProvider(TooltipAnchorPosition.Above),
        tooltip = {
            RichTooltip(
                title = { Text(title) },
                action =
                    url?.let {
                        {
                            TextButton(onClick = { openWebPage(context, it) }) {
                                Text(stringResource(R.string.citation_open_source))
                                Icon(
                                    painterResource(R.drawable.ic_open_in_new),
                                    contentDescription = null,
                                    modifier = Modifier.padding(start = 6.dp).size(16.dp),
                                )
                            }
                        }
                    },
            ) {
                Text(
                    publisher?.let { stringResource(R.string.citation_checked_by, it, day) }
                        ?: stringResource(R.string.citation_checked, day),
                )
            }
        },
        state = tooltip,
    ) {
        AssistChip(
            onClick = { scope.launch { tooltip.show() } },
            label = { Text(stringResource(R.string.citation_sources_chip, formatDate(checked, locale, DateStyle.MonthShort))) },
            colors =
                AssistChipDefaults.assistChipColors(
                    labelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                    leadingIconContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
                ),
            leadingIcon = {
                Icon(
                    painterResource(R.drawable.ic_menu_book),
                    contentDescription = null,
                    modifier = Modifier.size(AssistChipDefaults.IconSize),
                )
            },
        )
    }
}

/** Main's `useCitationLabel`: a page or slide of the learner's material, or its title when it has no pages. */
@Composable
fun materialCitationLabel(
    title: String,
    page: Long?,
    isSlide: Boolean,
): String =
    when {
        page == null -> title
        isSlide -> stringResource(R.string.citation_slide, title, page.toString())
        else -> stringResource(R.string.citation_page, title, page.toString())
    }

/** A quiet note led by an icon as tall as its text, such as where a question or a screen comes from. */
@Composable
fun IconNote(
    @DrawableRes icon: Int,
    text: String,
    modifier: Modifier = Modifier,
) {
    val style = MaterialTheme.typography.labelMedium

    Row(modifier, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Icon(
            painter = painterResource(icon),
            contentDescription = null,
            modifier = Modifier.size(with(LocalDensity.current) { style.lineHeight.toDp() }),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(text = text, color = MaterialTheme.colorScheme.onSurfaceVariant, style = style)
    }
}
