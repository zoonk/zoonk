package com.zoonk.android.feature.country

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.factsLine
import com.zoonk.android.ui.format.varietyName
import com.zoonk.api.models.GoalContentCountry
import com.zoonk.api.models.LearningProfileSuggestedInnerLessonVariety

/** "Portuguese (Brazil)": the language lessons use where the content's country speaks it another way. */
@Composable
fun lessonVarietyName(variety: LearningProfileSuggestedInnerLessonVariety): String =
    varietyName(variety.language, variety.region, currentLocale())

/** "Lesson language: Portuguese (Brazil)", or null when core discloses no other variety. */
@Composable
fun lessonLanguageLine(variety: LearningProfileSuggestedInnerLessonVariety?): String? =
    variety?.let { stringResource(R.string.country_lesson_language_value, lessonVarietyName(it)) }

/** A country course's disclosure: "Content country: Portugal · Lesson language: Portuguese (Brazil)". */
@Composable
fun countryDisclosure(country: GoalContentCountry): String =
    factsLine(stringResource(R.string.country_content_value, country.name), lessonLanguageLine(country.lessonVariety))
