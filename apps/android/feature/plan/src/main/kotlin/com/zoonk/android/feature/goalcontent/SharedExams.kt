package com.zoonk.android.feature.goalcontent

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.AnnotatedString
import com.zoonk.android.R
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatList
import com.zoonk.android.ui.format.joinSentences
import com.zoonk.api.models.SyllabusSharedExamsInner
import java.util.UUID

/** Main's `shared-exams.tsx`: up to two exams are named, more are counted. */
private const val MAX_NAMED_EXAMS = 2

@Composable
private fun examNames(exams: List<SyllabusSharedExamsInner>): String? =
    if (exams.size > MAX_NAMED_EXAMS) null else formatList(exams.map { it.name }, currentLocale())

/** Under an exam's subjects: the learner's other exams that share topics with it, which count once for all of them. */
@Composable
internal fun SharedExamsNote(
    sharedExams: List<SyllabusSharedExamsInner>,
    modifier: Modifier = Modifier,
) {
    if (sharedExams.isEmpty()) return
    val count = sharedExams.size
    val shared =
        examNames(sharedExams)?.let { pluralStringResource(R.plurals.goalcontent_shared_exams_named, count, it) }
            ?: pluralStringResource(R.plurals.goalcontent_shared_exams_counted, count, count)

    SectionNote(AnnotatedString(joinSentences(shared, stringResource(R.string.goalcontent_shared_exams_practice))), modifier)
}

/** "Also in …" for a subject the learner's other exams also teach, or null when none does. */
@Composable
internal fun alsoInLine(
    sharedExams: List<SyllabusSharedExamsInner>,
    sharedWith: List<UUID>,
): String? {
    val exams = sharedExams.filter { it.goalId in sharedWith }
    if (exams.isEmpty()) return null

    return examNames(exams)?.let { stringResource(R.string.goalcontent_also_in_exams, it) }
        ?: pluralStringResource(R.plurals.goalcontent_also_in_exam_count, exams.size, exams.size)
}
