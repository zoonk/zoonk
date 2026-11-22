package com.zoonk.android.feature.plan

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.api.models.ExamDocument

/**
 * What optional exam study, such as exam strategy, is called wherever it shows: beside the exam's official document
 * when it has one, and just optional when none was found.
 */
@Composable
fun optionalStudyLabel(
    hasNotice: Boolean,
    document: ExamDocument,
): String =
    stringResource(
        when {
            !hasNotice -> R.string.goalcontent_optional_study
            document == ExamDocument.NOTICE -> R.string.goalcontent_not_in_notice
            else -> R.string.goalcontent_not_in_guide
        },
    )
