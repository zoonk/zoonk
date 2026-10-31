package com.zoonk.android.feature.player.steps

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import com.zoonk.android.R
import com.zoonk.android.feature.player.model.StepCitation
import com.zoonk.android.ui.components.IconNote
import com.zoonk.android.ui.components.SourcesChip
import com.zoonk.android.ui.components.materialCitationLabel
import com.zoonk.api.models.PlayableLibraryStepAnyOfCitationOneOf
import kotlin.time.toJavaInstant
import com.zoonk.api.models.PlayableLibraryStepAnyOfCitation.PlayableLibraryStepAnyOfCitationOneOf1Value as SourceCitation
import com.zoonk.api.models.PlayableLibraryStepAnyOfCitation.PlayableLibraryStepAnyOfCitationOneOf2Value as NotInMaterial
import com.zoonk.api.models.PlayableLibraryStepAnyOfCitation.PlayableLibraryStepAnyOfCitationOneOfValue as MaterialCitation

/** Main's `LessonCitation`: the page of the learner's material a screen comes from, the public source it was checked against, or neither. */
@Composable
fun LessonCitation(citation: StepCitation) {
    when (citation) {
        is MaterialCitation -> {
            val material = citation.value
            val label =
                materialCitationLabel(material.title, material.page, material.unit == PlayableLibraryStepAnyOfCitationOneOf.Unit.SLIDE)
            val description = stringResource(R.string.player_citation_from_material, label)
            IconNote(R.drawable.ic_description, label, Modifier.clearAndSetSemantics { contentDescription = description })
        }

        is SourceCitation -> {
            with(citation.value) { SourcesChip(title, publisher, url, checkedAt.toJavaInstant()) }
        }

        is NotInMaterial -> {
            IconNote(R.drawable.ic_unknown_document, stringResource(R.string.player_citation_not_in_material))
        }
    }
}
