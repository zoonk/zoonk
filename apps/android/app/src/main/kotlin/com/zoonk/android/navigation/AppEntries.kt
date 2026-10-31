package com.zoonk.android.navigation

import androidx.navigation3.runtime.NavEntry
import androidx.navigation3.runtime.NavKey
import androidx.navigation3.runtime.entryProvider
import com.zoonk.android.app.AppContainer
import com.zoonk.android.feature.account.accountEntries
import com.zoonk.android.feature.buddy.buddyEntries
import com.zoonk.android.feature.catalog.catalogEntries
import com.zoonk.android.feature.challenge.challengeEntries
import com.zoonk.android.feature.checkpoint.checkpointEntries
import com.zoonk.android.feature.conversation.conversationEntries
import com.zoonk.android.feature.essay.essayEntries
import com.zoonk.android.feature.exam.examEntries
import com.zoonk.android.feature.explain.explainEntries
import com.zoonk.android.feature.feedback.feedbackEntries
import com.zoonk.android.feature.focustest.focusTestEntries
import com.zoonk.android.feature.goalcontent.goalContentEntries
import com.zoonk.android.feature.language.languageEntries
import com.zoonk.android.feature.memory.memoryEntries
import com.zoonk.android.feature.mindmaps.mindMapsEntries
import com.zoonk.android.feature.mistakes.mistakesEntries
import com.zoonk.android.feature.mock.chooser.mockChooserEntries
import com.zoonk.android.feature.mock.runner.mockRunnerEntries
import com.zoonk.android.feature.onboarding.course.onboardingCourseEntries
import com.zoonk.android.feature.onboarding.setup.onboardingSetupEntries
import com.zoonk.android.feature.onboarding.start.onboardingStartEntries
import com.zoonk.android.feature.pattern.patternEntries
import com.zoonk.android.feature.plan.planEntries
import com.zoonk.android.feature.planlink.planLinkEntries
import com.zoonk.android.feature.player.playerEntries
import com.zoonk.android.feature.practice.block.practiceBlockEntries
import com.zoonk.android.feature.pronunciation.pronunciationEntries
import com.zoonk.android.feature.recap.recapEntries
import com.zoonk.android.feature.session.sessionEntries
import com.zoonk.android.feature.settings.settingsEntries
import com.zoonk.android.feature.speaking.speakingEntries
import com.zoonk.android.feature.stats.statsEntries
import com.zoonk.android.feature.subscription.subscriptionEntries
import com.zoonk.android.feature.testout.testOutEntries
import com.zoonk.android.feature.today.todayEntries

/**
 * Every route's screen, one call per feature's `<Name>Navigation.kt`, where each lane registers
 * its own routes (with their scene metadata, such as list-detail panes) in place of the
 * placeholders. Nothing else changes here.
 */
fun appEntries(
    app: AppContainer,
    navigator: AppNavigator,
): (NavKey) -> NavEntry<NavKey> =
    entryProvider {
        accountEntries(app, navigator)
        settingsEntries(app, navigator)
        memoryEntries(app, navigator)
        feedbackEntries(app, navigator)
        subscriptionEntries(app, navigator)
        onboardingStartEntries(app, navigator)
        onboardingSetupEntries(app, navigator)
        onboardingCourseEntries(app, navigator)
        planLinkEntries(app, navigator)
        todayEntries(app, navigator)
        sessionEntries(app, navigator)
        recapEntries(app, navigator)
        playerEntries(app, navigator)
        explainEntries(app, navigator)
        practiceBlockEntries(app, navigator)
        mistakesEntries(app, navigator)
        checkpointEntries(app, navigator)
        challengeEntries(app, navigator)
        testOutEntries(app, navigator)
        focusTestEntries(app, navigator)
        essayEntries(app, navigator)
        patternEntries(app, navigator)
        examEntries(app, navigator)
        mockRunnerEntries(app, navigator)
        mockChooserEntries(app, navigator)
        pronunciationEntries(app, navigator)
        languageEntries(app, navigator)
        conversationEntries(app, navigator)
        speakingEntries(app, navigator)
        planEntries(app, navigator)
        goalContentEntries(app, navigator)
        mindMapsEntries(app, navigator)
        buddyEntries(app, navigator)
        catalogEntries(app, navigator)
        statsEntries(app, navigator)
    }
