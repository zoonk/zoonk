package com.zoonk.android.feature.warmup

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.data.AnalyticsEvent
import com.zoonk.android.data.LocalEventTracker
import com.zoonk.android.data.TrackShown
import com.zoonk.android.data.collectShown
import com.zoonk.android.data.value
import com.zoonk.android.ui.components.AnswerOption
import com.zoonk.android.ui.components.AnswerOptionGroup
import com.zoonk.android.ui.components.AnswerResult
import com.zoonk.android.ui.components.FeedbackTone
import com.zoonk.android.ui.components.FeedbackVerdict
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.api.models.WarmUpDeck
import com.zoonk.api.models.WarmUpDeckCardsInner
import com.zoonk.api.models.WarmUpDeckCardsInnerOptionsInner

/**
 * Main's `WarmUpCard`: under a wait's timeline, a quick question about the learner's subject. One tap shows the right
 * answer and why, then the next card, until the work is ready; nothing shows until the deck has loaded, or when the
 * learner already guessed every card.
 */
@Composable
fun WarmUpCard(
    warmUpId: String?,
    warmUps: WarmUpStore,
    surface: AnalyticsEvent.WarmUpSurface,
    hold: ReadyHold,
    modifier: Modifier = Modifier,
) {
    warmUpId ?: return
    val state by warmUps.decks[warmUpId].collectShown()
    val deck = state.value ?: return
    key(warmUpId) { DeckCard(deck, warmUpId, warmUps, surface, hold, modifier) }
}

@Composable
private fun DeckCard(
    deck: WarmUpDeck,
    warmUpId: String,
    warmUps: WarmUpStore,
    surface: AnalyticsEvent.WarmUpSurface,
    hold: ReadyHold,
    modifier: Modifier,
) {
    var index by rememberSaveable { mutableIntStateOf(warmUps.next(warmUpId)) }
    val card = deck.cards.getOrNull(index) ?: return
    TrackShown(AnalyticsEvent.WarmUpShown(surface, deck.cards.size))
    val tracker = LocalEventTracker.current
    var picked by rememberSaveable { mutableStateOf<String?>(null) }
    var tapped by remember { mutableStateOf<Tap?>(null) }
    val reveal = remember { BringIntoViewRequester() }
    val nextGuess = remember { FocusRequester() }
    val firstAnswer = remember { FocusRequester() }
    val goesOn = picked != null && !hold.holding && warmUps.next(warmUpId) < deck.cards.size

    LaunchedEffect(tapped) {
        when (tapped) {
            Tap.Answer -> {
                reveal.bringIntoView()
                if (goesOn) nextGuess.requestFocus()
            }

            Tap.Next -> {
                firstAnswer.requestFocus()
            }

            null -> {}
        }
    }

    OutlinedCard(modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Title()
            Guess(card, picked, reveal, firstAnswer) { option ->
                picked = option.id
                tapped = Tap.Answer
                warmUps.answered(warmUpId, index)
                hold.guess()
                tracker.track(AnalyticsEvent.WarmUpAnswered(surface, card.id, index + 1, option.correct))
            }
            when {
                goesOn -> {
                    OutlinedButton(
                        onClick = {
                            index = warmUps.next(warmUpId)
                            picked = null
                            tapped = Tap.Next
                        },
                        modifier = Modifier.focusRequester(nextGuess),
                    ) { Text(stringResource(R.string.warm_up_next)) }
                }

                picked != null && !hold.holding -> {
                    DeckEnd()
                }
            }
        }
    }
}

/** What the learner's last tap on the card showed, so the reveal comes into view and focus goes on from there. */
private enum class Tap { Answer, Next }

@Composable
private fun Title() {
    Row(
        Modifier.semantics(mergeDescendants = true) { heading() },
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            painterResource(R.drawable.ic_auto_awesome),
            contentDescription = null,
            modifier = Modifier.size(18.dp),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Text(
            stringResource(R.string.warm_up_title),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelLarge,
        )
    }
}

/** The answers lock at the first tap, which shows the right one and why; a guess is never wrong, only shown its answer. */
@Composable
private fun Guess(
    card: WarmUpDeckCardsInner,
    picked: String?,
    reveal: BringIntoViewRequester,
    firstAnswer: FocusRequester,
    onPick: (WarmUpDeckCardsInnerOptionsInner) -> Unit,
) {
    Text(card.question, style = MaterialTheme.typography.titleMedium)
    AnswerOptionGroup(Modifier.semantics { contentDescription = card.question }) {
        card.options.forEachIndexed { index, option ->
            val chosen = picked == option.id
            AnswerOption(
                marker = index + 1,
                picked = chosen,
                result =
                    when {
                        picked == null -> null
                        option.correct -> AnswerResult.Right
                        chosen -> AnswerResult.Guess
                        else -> null
                    },
                onClick = { onPick(option) },
                modifier = if (index == 0) Modifier.focusRequester(firstAnswer) else Modifier,
                enabled = picked == null,
                guessed = true,
            ) { Text(option.text, style = MaterialTheme.typography.bodyLarge) }
        }
    }

    if (picked == null) {
        Text(
            stringResource(R.string.warm_up_guess_hint),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
        )
        return
    }

    val right = card.options.any { it.id == picked && it.correct }
    Column(
        Modifier.bringIntoViewRequester(reveal).semantics(mergeDescendants = true) { liveRegion = LiveRegionMode.Polite },
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        FeedbackVerdict(
            text = stringResource(if (right) R.string.player_verdict_guess_right else R.string.player_verdict_guess),
            tone = if (right) FeedbackTone.Right else FeedbackTone.Neutral,
            icon = if (right) null else R.drawable.ic_auto_awesome,
        )
        Text(card.reveal, style = MaterialTheme.typography.bodyLarge)
    }
}

@Composable
private fun DeckEnd() {
    Text(
        stringResource(R.string.warm_up_deck_end),
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodyMedium,
    )
}
