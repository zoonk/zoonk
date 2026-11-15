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

    /** The aim's picker, which closes once the aim applied, while the editor opening that asked lasts. */
    data object AimPicker : PlanAsker

    /** Move date, after which the keyboard goes to the time picked, while the editor opening that asked lasts. */
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

/** [asker]'s search, asked while its opening's visit was the one numbered [started]. */
internal class TimeAsk(
    val asker: TimeAsker,
    val started: Int,
)

/**
 * What a plan save or search leads to on whatever asked, held for that asker's visit: the Plan's, or an
 * opening inside it, which ends when it closes, so what it asked never reaches a later opening.
 */
@Stable
internal class PlanOutcomes(
    visit: Visit = Visit(),
) {
    /** The Adjust plan editor's opening, whose pickers and Move date ask: it ends when the editor closes. */
    val editor = visit.opening()

    /** The suggestion slot's item while its sheet or panel shows, whose searches ask: it ends when that goes. */
    val suggestion = visit.opening()

    /** A save that didn't, said in the app's snackbars, since the bar or menu that asked can be gone by then. */
    val saveFailed = visit.outcome<Unit>()

    /** The aim's pick applied: its picker closes. */
    val aimPicked = editor.outcome<Unit>()

    /** The language's country saved: its picker closes. */
    val regionSaved = editor.outcome<Unit>()

    /** The content country saved: its question and picker close. */
    val countrySaved = editor.outcome<Unit>()

    /** Move date saved the date: the keyboard goes to the time picked. */
    val dateMoved = editor.outcome<Unit>()

    val moveDateFound = editor.outcome<TimeToCoverOutcome>()

    val coverageFound = suggestion.outcome<TimeFound<CoverageIntent>>()

    val pastDateFound = suggestion.outcome<TimeFound<Int>>()

    fun ask(asker: TimeAsker) =
        TimeAsk(
            asker,
            when (asker) {
                TimeAsker.MoveDate -> editor.number
                is TimeAsker.Coverage, is TimeAsker.PastDate -> suggestion.number
            },
        )

    fun found(
        ask: TimeAsk,
        outcome: TimeToCoverOutcome,
    ) = when (val asker = ask.asker) {
        TimeAsker.MoveDate -> moveDateFound.send(ask.started, outcome)
        is TimeAsker.Coverage -> coverageFound.send(ask.started, TimeFound(asker.intent, outcome))
        is TimeAsker.PastDate -> pastDateFound.send(ask.started, TimeFound(asker.request, outcome))
    }
}
