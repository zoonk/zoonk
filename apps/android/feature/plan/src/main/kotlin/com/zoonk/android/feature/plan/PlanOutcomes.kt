package com.zoonk.android.feature.plan

import androidx.compose.runtime.Stable
import com.zoonk.android.data.Visit
import java.util.UUID

/** Who asked for a plan save, which decides what its answer does besides changing the plan. */
internal sealed interface PlanAsker {
    /** A sheet's [opening], which shows what its save did ([PlanViewModel.sheetAnswers]). */
    data class Sheet(
        val opening: UUID,
    ) : PlanAsker

    /** A suggestion the learner applied: it shows its answer with Undo, or that it didn't save. */
    data class Suggestion(
        val item: SlotItem,
    ) : PlanAsker

    /** An exam choice made from its suggestion, which shows the change it applied. */
    data class SuggestedChoice(
        val item: SlotItem.Choice,
    ) : PlanAsker

    /** The fit offer's lessons, added once its check showed today's numbers: a failure says so in the app's snackbar. */
    data object FitLessons : PlanAsker

    /** A save whose failure the app's snackbar says. */
    data object SaysFailure : PlanAsker

    /** The aim's picker, which closes once the aim applied. */
    data object AimPicker : PlanAsker

    /** Move date, after which the keyboard goes to the time picked. */
    data object MoveDate : PlanAsker
}

/** Who asked for the time that covers everything, and so acts on what was found. */
internal sealed interface TimeAsker {
    data object MoveDate : TimeAsker

    data class Coverage(
        val intent: CoverageIntent,
    ) : TimeAsker

    /** [request] tells a search put off or superseded from the one the suggestion waits for. */
    data class PastDate(
        val request: Int,
    ) : TimeAsker
}

/** What the search found for the ask marked [ask]. */
internal data class TimeFound<A : Any>(
    val ask: A,
    val outcome: TimeToCoverOutcome,
)

/** What a plan save or search leads to on the screen that asked, held for the visit that asked. */
@Stable
internal class PlanOutcomes(
    visit: Visit = Visit(),
) {
    /** The aim's pick applied: its picker closes. */
    val aimPicked = visit.outcome<Unit>()

    /** The language's country saved: its picker closes. */
    val regionSaved = visit.outcome<Unit>()

    /** The content country saved: its question and picker close. */
    val countrySaved = visit.outcome<Unit>()

    /** Move date saved the date: the keyboard goes to the time picked. */
    val dateMoved = visit.outcome<Unit>()

    val moveDateFound = visit.outcome<TimeToCoverOutcome>()

    val coverageFound = visit.outcome<TimeFound<CoverageIntent>>()

    val pastDateFound = visit.outcome<TimeFound<Int>>()

    fun found(
        started: Int,
        asker: TimeAsker,
        outcome: TimeToCoverOutcome,
    ) = when (asker) {
        TimeAsker.MoveDate -> moveDateFound.send(started, outcome)
        is TimeAsker.Coverage -> coverageFound.send(started, TimeFound(asker.intent, outcome))
        is TimeAsker.PastDate -> pastDateFound.send(started, TimeFound(asker.request, outcome))
    }
}
