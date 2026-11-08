package com.zoonk.android.feature.onboarding.setup

import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.feature.onboarding.start.text
import com.zoonk.android.feature.plan.LanguageAimRow
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.api.models.Goal
import com.zoonk.api.models.OnboardingLanguageAim
import java.time.LocalDate
import java.time.ZoneId

internal data class SetupAimContext(
    val aim: OnboardingLanguageAim? = null,
    val pending: Boolean = false,
    val failed: Boolean = false,
    val change: (String, () -> Unit) -> Unit = { _, _ -> },
)

internal val LocalSetupAim = compositionLocalOf { SetupAimContext() }

@Composable
internal fun ScheduleAim(
    endDate: LocalDate?,
    minutes: Int?,
    goal: Goal,
) {
    val context = LocalSetupAim.current
    val languageAim = context.aim ?: return
    val aim = languageAim.aim?.value ?: return
    val level = goal.details.text("level") ?: "none"
    val description =
        minutes?.let {
            val time = formatMinutes(it, currentLocale())
            when (level) {
                "none" -> stringResource(R.string.onboarding_aim_from_none, time)
                "basic" -> stringResource(R.string.onboarding_aim_from_basic, time)
                "intermediate" -> stringResource(R.string.onboarding_aim_from_intermediate, time)
                "advanced" -> stringResource(R.string.onboarding_aim_from_advanced, time)
                else -> stringResource(R.string.onboarding_aim_from_level, level, time)
            }
        }
    LanguageAimRow(
        aim,
        languageAim.choices,
        context.change,
        context.pending,
        context.failed,
        endDate,
        today = LocalDate.now(ZoneId.of(goal.timezone ?: "UTC")),
        description = description,
    )
}
