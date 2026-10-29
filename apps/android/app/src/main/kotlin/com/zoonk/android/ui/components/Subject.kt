package com.zoonk.android.ui.components

import androidx.annotation.StringRes
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.ui.theme.SubjectColors
import com.zoonk.android.ui.theme.zoonk

/** Main's `Subject`: a course's first category, its pages' color; `General` for a course without one. */
enum class Subject(
    val key: String,
    @param:StringRes val label: Int?,
) {
    Arts("arts", R.string.catalog_subject_arts),
    Business("business", R.string.catalog_subject_business),
    Communication("communication", R.string.catalog_subject_communication),
    Culture("culture", R.string.catalog_subject_culture),
    Economics("economics", R.string.catalog_subject_economics),
    Engineering("engineering", R.string.catalog_subject_engineering),
    Exams("exams", R.string.catalog_subject_exams),
    Geography("geography", R.string.catalog_subject_geography),
    Health("health", R.string.catalog_subject_health),
    History("history", R.string.catalog_subject_history),
    Languages("languages", R.string.catalog_subject_languages),
    Law("law", R.string.catalog_subject_law),
    Math("math", R.string.catalog_subject_math),
    Science("science", R.string.catalog_subject_science),
    Society("society", R.string.catalog_subject_society),
    Tech("tech", R.string.catalog_subject_tech),
    General("general", null),
    ;

    companion object {
        /** The API's category value; anything else is `General`. */
        fun of(key: String?): Subject = entries.firstOrNull { it.key == key } ?: General
    }
}

val Subject.colors: SubjectColors
    @Composable
    @ReadOnlyComposable
    get() = MaterialTheme.zoonk.subjects.getValue(key)

/** Beside words that name the subject or its course, never alone: it's decoration for TalkBack. */
@Composable
fun SubjectGlyph(
    subject: Subject,
    modifier: Modifier = Modifier,
) {
    val color = subject.colors.color
    val size =
        with(LocalDensity.current) {
            MaterialTheme.typography.labelMedium.fontSize
                .toDp()
        } * GLYPH_SHARE

    Canvas(modifier.size(size)) {
        drawRoundRect(color, cornerRadius = CornerRadius(2.dp.toPx()))
    }
}

/** Main's `SubjectLabel`: the subject's name on its tint. Nothing for `General`. */
@Composable
fun SubjectLabel(
    subject: Subject,
    modifier: Modifier = Modifier,
) {
    val label = subject.label ?: return
    val colors = subject.colors

    Text(
        text = stringResource(label),
        modifier =
            modifier
                .background(colors.tint, MaterialTheme.shapes.small)
                .padding(horizontal = 8.dp, vertical = 3.dp),
        color = colors.text,
        style = MaterialTheme.typography.labelMedium,
    )
}

private const val GLYPH_SHARE = 0.7f
