package com.zoonk.android.feature.activities

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatAmount
import com.zoonk.android.ui.richtext.RichText
import com.zoonk.android.ui.theme.withTabularFigures
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf5Fields
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf5FieldsTruthOneOfWorkingsInner
import com.zoonk.api.models.PlayableLibraryStepAnyOfContent.PlayableLibraryStepAnyOfContentOneOf5Value as GuessRevealContent
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf5FieldsTruth.PlayableLibraryStepAnyOfContentOneOf5FieldsTruthOneOf1Value as CitedTruth
import com.zoonk.api.models.PlayableLibraryStepAnyOfContentOneOf5FieldsTruth.PlayableLibraryStepAnyOfContentOneOf5FieldsTruthOneOfValue as ComputedTruth

val guessRevealRenderer =
    ActivityRenderer(
        badge = { ActivityBadge(R.string.activities_badge_estimate_first, R.drawable.ic_target) },
        canvas = { GuessRevealActivity(it) },
        showsData = { (it as GuessRevealContent).value.fields.truth is CitedTruth },
    )

@Composable
private fun GuessRevealActivity(props: ActivityProps) {
    val fields = (props.content as GuessRevealContent).value.fields

    ActivityGuessReveal(
        scale = GuessScale(fields.min, fields.max, log = fields.scale == PlayableLibraryStepAnyOfContentOneOf5Fields.Scale.LOG),
        unit = fields.unit,
        guess = props.answer.numericValue,
        actual = props.expected.numericValue,
        props = props,
        onGuessChange = { props.onAnswerChange(numericAnswer(it)) },
    ) {
        (fields.truth as? ComputedTruth)?.let { GuessWorkings(it.value.workings) }
        fields.comparison?.let { RichText(it, style = MaterialTheme.typography.bodyMedium) }
        ActivityTakeaway(fields.takeaway)
    }
}

@Composable
private fun GuessWorkings(workings: List<PlayableLibraryStepAnyOfContentOneOf5FieldsTruthOneOfWorkingsInner>) {
    val locale = currentLocale()

    Surface(
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface,
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            val style = MaterialTheme.typography.bodyMedium.withTabularFigures()
            workings.forEach { working ->
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        ActivityExpression.evaluate(working.expression)?.let { formatAmount(it, locale) }.orEmpty(),
                        style = style.copy(fontWeight = FontWeight.Medium),
                    )
                    Text(working.label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = style)
                }
            }
        }
    }
}
