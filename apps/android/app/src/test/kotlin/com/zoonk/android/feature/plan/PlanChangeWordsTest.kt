package com.zoonk.android.feature.plan

import androidx.activity.ComponentActivity
import androidx.compose.runtime.Composable
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithContentDescription
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.zoonk.android.ui.theme.ZoonkTheme
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.time.LocalDate

private const val NBSP = '\u00A0'

@RunWith(AndroidJUnit4::class)
@Config(qualifiers = "en")
class PlanChangeWordsTest {
    @get:Rule
    val compose = createAndroidComposeRule<ComponentActivity>()

    /** Each read's words, from one composition: a test sets its content once. */
    private fun words(vararg reads: @Composable () -> String?): List<String?> {
        var said = emptyList<String?>()
        compose.setContent { said = reads.map { it() } }
        compose.waitForIdle()
        return said
    }

    @Test
    fun aLearnersChangeSaysWhatItDidAndAWaitingOneWhatItWouldSet() {
        val minutes = """[{"kind":"setDailyMinutes","minutes":40}]"""

        assertEquals(
            listOf(
                "Daily time changed to 40$NBSP" + "min.",
                "Daily time: 40$NBSP" + "min",
                "No deadline: you study everything at your own pace.",
            ),
            words(
                { planChangeSentence(planChange(minutes)) },
                { planChangeSentence(planChange(minutes, status = "proposed")) },
                { planChangeSentence(planChange("""[{"kind":"setTargetDate","targetDate":null}]""")) },
            ),
        )
    }

    @Test
    fun aChangeTheLearnerNeverTookSaysWhatItWouldHaveSet() {
        val minutes = """[{"kind":"setDailyMinutes","minutes":20}]"""

        assertEquals(
            listOf("Daily time: 20$NBSP" + "min", "Daily time: 20$NBSP" + "min"),
            words(
                { planChangeSentence(planChange(minutes, status = "declined")) },
                { planChangeSentence(planChange(minutes, status = "replaced")) },
            ),
        )
    }

    @Test
    fun everyKindOfDeclinedChangeReadsAsASuggestion() {
        assertEquals(
            listOf("Leave out of the plan: Algebra.", "Harder material.", "More practice."),
            words(
                { planChangeSentence(planChange("""[{"kind":"skipAreas","areas":["Algebra"]}]""", status = "declined")) },
                { planChangeSentence(planChange("""[{"kind":"setDifficultyBias","bias":"harder"}]""", status = "declined")) },
                { planChangeSentence(planChange("""[{"kind":"setPracticeBias","bias":"morePractice"}]""", status = "replaced")) },
            ),
        )
    }

    @Test
    fun aWrittenReasonIsShownAsWritten() {
        assertEquals(
            listOf("Your buddy moved it."),
            words({ planChangeSentence(planChange(extra = """"reason":"Your buddy moved it."""")) }),
        )
    }

    @Test
    fun aFocusNamesTheLearnersOwnWordsForAPart() {
        val change =
            planChange(
                """[{"kind":"focusAreas","areas":["Math","History"],"parts":[{"area":"Math","name":"geometry","skillIds":["s"]}]}]""",
            )

        assertEquals(listOf("More time for geometry and History."), words({ planChangeSentence(change) }))
    }

    @Test
    fun missedDaysSayWhatComesFirstAndThePhasesNewEnd() {
        val change =
            planChange(
                kind = "missedDays",
                source = "system",
                effect = effect(""""phaseEnds":[{"name":"Data structures","before":"2026-11-10","after":"2026-11-14"}]"""),
            )

        assertEquals(
            listOf(
                "Lessons left from earlier days come first, and the rest of your plan moved later. Data structures ends November 14 instead of November 10.",
            ),
            words({ planChangeSentence(change) }),
        )
    }

    @Test
    fun lessonsLeftOutAreNamedOrGivenAsExamples() {
        val named = effect(""""lessonsAdded":2,"lessonsRemoved":3,"lessonsLeftOut":["Sets","Tuples","Loops"]""")
        val examples = effect(""""lessonsRemoved":5,"lessonsLeftOut":["Sets","Tuples","Loops","Maps"]""")

        assertEquals(
            listOf(
                "Adds 2 lessons and leaves out 3: Sets, Tuples, and Loops.",
                "Leaves out 5 lessons, such as Sets, Tuples, and Loops.",
                "2 more lessons and 3 fewer: Sets, Tuples, and Loops.",
            ),
            words(
                { lessonsText(planChange(effect = named).effect) },
                { lessonsText(planChange(effect = examples).effect) },
                { lessonsText(planChange(effect = named).effect, byDate = false) },
            ),
        )
    }

    @Test
    fun besideADiffTheLessonsLeftOutAreNamedWithoutTheirCount() {
        val named = effect(""""lessonsAdded":2,"lessonsRemoved":3,"lessonsLeftOut":["Sets","Tuples","Loops"]""")
        val examples = effect(""""lessonsRemoved":5,"lessonsLeftOut":["Sets","Tuples","Loops","Maps"]""")

        assertEquals(
            listOf("Lessons left out: Sets, Tuples, and Loops.", "Lessons left out include Sets, Tuples, and Loops."),
            words(
                { planChangeFootnote(planChange(effect = named).effect) },
                { lessonsText(planChange(effect = examples).effect, named = true) },
            ),
        )
    }

    @Test
    fun lessonsSwappedWithinASkillKeepTheirCountBesideADiff() {
        val swapped = effect(""""lessonsRemoved":0,"lessonsLeftOut":["Sets","Tuples","Loops","Maps","Files"]""")

        assertEquals(
            listOf("Lessons left out: Sets, Tuples, Loops and 2 more."),
            words({ lessonsText(planChange(effect = swapped).effect, named = true) }),
        )
    }

    @Test
    fun appliedLinesSayWhenTodaysSessionTakesIt() {
        val change = planChange(extra = """"todaySession":"unchanged"""")

        assertEquals(
            listOf("It's in your plan from your next study day. Today's session stays as it is."),
            words({ planChangeAppliedLine(change.todaySession) }),
        )
    }

    @Test
    fun aPlanWhoseDateTheChangeRemovedSaysTheMonthItEnds() {
        val change =
            planChange(
                """[{"kind":"setTargetDate","targetDate":null}]""",
                effect = effect(""""endDateBefore":"2027-01-31","endDateAfter":"2027-04-02""""),
            )

        assertEquals(
            listOf("You finish around April 2027."),
            words({ planChangeAppliedEffect(change, targetDate = null, fullCourse = false) }),
        )
    }

    @Test
    fun theDiffShowsNowAndAfterTheChangeExceptOnItsLessonLines() {
        val change = planChange(effect = effect(""""lessonsAdded":2,"endDateBefore":"2027-01-10","endDateAfter":"2027-01-20""""))
        compose.setContent { ZoonkTheme { PlanEffectDiff(change.effect, goalDate = GoalDateMove(LocalDate.of(2027, 2, 1), null)) } }

        compose.onNodeWithContentDescription("Adds 2 lessons").assertExists()
        compose.onNodeWithContentDescription("Now: Plan ends January${NBSP}10,${NBSP}2027").assertExists()
        compose.onNodeWithContentDescription("After the change: Plan ends January${NBSP}20,${NBSP}2027").assertExists()
    }
}
