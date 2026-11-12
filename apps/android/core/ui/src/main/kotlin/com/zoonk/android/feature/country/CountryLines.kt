package com.zoonk.android.feature.country

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.varietyName
import com.zoonk.api.models.GoalContentCountry
import com.zoonk.api.models.LearningProfileSuggestedInnerLessonVariety
import java.util.Locale

/**
 * "Português (Brasil)": the language lessons use where the content's country speaks it another way. Core names the
 * countries beside it in the content's language, [LearningProfileSuggestedInnerLessonVariety.language], so it is named
 * in that language too, whatever the app's.
 */
fun lessonVarietyName(variety: LearningProfileSuggestedInnerLessonVariety): String =
    varietyName(variety.language, variety.region, Locale.forLanguageTag(variety.language))

/** "Lesson language: Português (Brasil)", or null when core discloses no other variety. */
@Composable
fun lessonLanguageLine(variety: LearningProfileSuggestedInnerLessonVariety?): String? =
    variety?.let { stringResource(R.string.country_lesson_language_value, lessonVarietyName(it)) }

/** A country course's disclosure: "Content country: Portugal · Lesson language: Português (Brasil)". */
@Composable
fun countryDisclosure(country: GoalContentCountry): String =
    factsLine(stringResource(R.string.country_content_value, country.name), lessonLanguageLine(country.lessonVariety))
