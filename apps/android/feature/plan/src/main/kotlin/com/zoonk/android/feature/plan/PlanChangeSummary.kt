package com.zoonk.android.feature.plan

import androidx.annotation.DrawableRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.api.models.PlanChange
import java.time.LocalDate

/**
 * What an applied change did, as main's `PlanChangeSummary`: its sentence, its consequence and every
 * change behind "See all changes", and whether today's session took it. An undone change says so
 * instead. [targetDate] and [fullCourse] are the plan's after the change.
 */
@Composable
fun PlanChangeSummary(
    change: PlanChange,
    targetDate: LocalDate?,
    fullCourse: Boolean,
    @DrawableRes icon: Int,
    modifier: Modifier = Modifier,
    dateKind: GoalDateKind = GoalDateKind.Unknown,
) {
    val undone = change.status == PlanChange.Status.UNDONE

    Row(
        modifier = modifier.fillMaxWidth().semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite },
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(
            painter = painterResource(icon),
            contentDescription = null,
            modifier = Modifier.padding(top = 2.dp).size(18.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                text = if (undone) stringResource(R.string.plan_change_undone) else planChangeSentence(change),
                style = MaterialTheme.typography.bodyLarge,
                fontWeight = FontWeight.Medium,
            )
            if (!undone) {
                PlanEffectDiff(change.effect, byDate = targetDate != null && !fullCourse, dateKind = dateKind)
                SupportingLine(planChangeAppliedLine(change.todaySession))
            }
        }
    }
}

@Composable
private fun SupportingLine(text: String) {
    Text(text = text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
}
