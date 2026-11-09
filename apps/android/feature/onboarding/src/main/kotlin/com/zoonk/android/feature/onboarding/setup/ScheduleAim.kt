package com.zoonk.android.feature.onboarding.setup

import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.key
import androidx.compose.ui.res.stringResource
import com.zoonk.android.R
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.feature.onboarding.AdviceQuery
import com.zoonk.android.feature.onboarding.OnboardingStore
import com.zoonk.android.feature.onboarding.start.text
import com.zoonk.android.feature.plan.LanguageAimRow
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatMinutes
import com.zoonk.api.models.Goal
import com.zoonk.api.models.OnboardingLanguageAim
import com.zoonk.api.models.PlanTimeAdviceInput
import kotlinx.datetime.toJavaLocalDate
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
    store: OnboardingStore,
    week: PlanTimeAdviceInput,
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
        description = description,
        dates = {
            languageAim.choices.filterNot { it.aim.value == aim }.associate { choice ->
                key(choice.aim.value) {
                    val query = AdviceQuery(goal, week.copy(aim = PlanTimeAdviceInput.Aim.entries.first { it.value == choice.aim.value }))
                    val advice =
                        store.timeAdvice[query]
                            .collectShown()
                            .value.value
                    choice.aim.value to advice?.takeIf { it.ready }?.endDate?.toJavaLocalDate()
                }
            }
        },
    )
}
