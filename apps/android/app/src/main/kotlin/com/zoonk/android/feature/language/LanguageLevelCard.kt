package com.zoonk.android.feature.language

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.LanguageTodayLevel

@Composable
fun LanguageLevelCard(
    level: LanguageTodayLevel,
    onOpenPlan: () -> Unit,
    modifier: Modifier = Modifier,
    ladder: @Composable () -> Unit = {},
) {
    val target = level.target
    val value = if (target == null) level.label else stringResource(R.string.language_level_toward, level.label, target)
    val spoken = if (target == null) level.label else stringResource(R.string.language_level_toward_spoken, level.label, target)

    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        SectionHeader(stringResource(R.string.language_level))
        Text(
            value,
            Modifier.semantics { contentDescription = spoken },
            style = MaterialTheme.typography.headlineMedium.withTabularFigures(),
        )
        ladder()
        TextButton(onClick = onOpenPlan) {
            Text(stringResource(R.string.language_see_your_plan))
            Spacer(Modifier.size(4.dp))
            Icon(painterResource(R.drawable.ic_chevron_right), contentDescription = null, modifier = Modifier.size(16.dp))
        }
    }
}
