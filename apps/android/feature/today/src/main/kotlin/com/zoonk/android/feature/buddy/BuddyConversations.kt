package com.zoonk.android.feature.buddy

import android.text.format.DateFormat
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.minimumInteractiveComponentSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.zoonk.android.R
import com.zoonk.android.feature.tutor.BuddyConversation
import com.zoonk.android.feature.tutor.BuddyConversationList
import com.zoonk.android.ui.components.LIST_ITEM_INSET
import com.zoonk.android.ui.components.ListDivider
import com.zoonk.android.ui.components.ListRow
import com.zoonk.android.ui.components.ListRowPlus
import com.zoonk.android.ui.components.ModalBottomSheet
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.components.SectionHeader
import com.zoonk.android.ui.components.rememberExpandedBottomSheetState
import com.zoonk.android.ui.format.DateStyle
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatDate
import com.zoonk.android.ui.format.formatTimeOfDay
import java.time.LocalDate
import java.time.ZoneId
import kotlin.time.Instant

/** Main's `BuddyConversationList`: the goal's conversations, which one is open, and the next page's state. */
@Immutable
internal class BuddyConversationRows(
    val list: BuddyConversationList,
    /** Null while the open conversation has no question yet, so "New conversation" is the open one. */
    val openId: String?,
    val loadingMore: Boolean,
    val moreFailed: Boolean,
)

/** What a tap on the list does. */
internal class BuddyConversationTaps(
    val open: (String) -> Unit,
    val startNew: () -> Unit,
    val showMore: () -> Unit,
)

/** Main's `BuddyConversations`: the list in the pane beside the conversation, where there's room. */
@Composable
internal fun BuddyConversationsPane(
    rows: BuddyConversationRows,
    taps: BuddyConversationTaps,
) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(horizontal = LIST_EDGE, vertical = 24.dp)) {
        item(key = "title", contentType = "title") {
            SectionHeader(
                stringResource(R.string.buddy_page_conversations),
                Modifier.padding(horizontal = LIST_ITEM_INSET).padding(bottom = 8.dp),
            )
        }
        conversationRows(rows, taps)
    }
}

/**
 * Main's `BuddyConversationsSheet` below the pane's width: one button before "…", there once the goal
 * has a conversation and keeping its room before, so the first one's arrival moves nothing.
 */
@Composable
internal fun BuddyConversationsButton(
    hasConversations: Boolean,
    onOpen: () -> Unit,
) {
    if (!hasConversations) {
        Box(Modifier.minimumInteractiveComponentSize())
        return
    }
    IconButton(onClick = onOpen) {
        Icon(
            painterResource(R.drawable.ic_forum),
            contentDescription = stringResource(R.string.buddy_page_conversations),
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

/** The same list in a sheet; a row opens its conversation and closes it. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun BuddyConversationsSheet(
    rows: BuddyConversationRows,
    taps: BuddyConversationTaps,
    onDismiss: () -> Unit,
) {
    val closing =
        BuddyConversationTaps(
            open = {
                onDismiss()
                taps.open(it)
            },
            startNew = {
                onDismiss()
                taps.startNew()
            },
            showMore = taps.showMore,
        )

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberExpandedBottomSheetState()) {
        LazyColumn(Modifier.navigationBarsPadding(), contentPadding = PaddingValues(start = LIST_EDGE, end = LIST_EDGE, bottom = 24.dp)) {
            item(key = "title", contentType = "title") {
                Text(
                    stringResource(R.string.buddy_page_conversations),
                    Modifier.padding(horizontal = LIST_ITEM_INSET).padding(bottom = 12.dp).semantics { heading() },
                    style = MaterialTheme.typography.titleLarge,
                )
            }
            conversationRows(rows, closing)
        }
    }
}

private fun LazyListScope.conversationRows(
    rows: BuddyConversationRows,
    taps: BuddyConversationTaps,
) {
    item(key = "new", contentType = "new") {
        ListRow(
            headline = { Text(stringResource(R.string.buddy_page_new_conversation)) },
            modifier = Modifier.semantics { if (rows.openId == null) selected = true },
            onClick = taps.startNew,
            highlighted = rows.openId == null,
            trailing = { ListRowPlus() },
        )
    }
    itemsIndexed(rows.list.conversations, key = { _, row -> row.id }, contentType = { _, _ -> "conversation" }) { index, conversation ->
        val open = conversation.id == rows.openId
        Column {
            if (index > 0) ListDivider(besideHighlight = open || rows.list.conversations[index - 1].id == rows.openId)
            ConversationRow(conversation, open) { taps.open(conversation.id) }
        }
    }
    if (rows.list.nextCursor != null) {
        item(key = "more", contentType = "more") {
            Column(
                Modifier.fillMaxWidth().padding(horizontal = LIST_ITEM_INSET).padding(top = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (rows.moreFailed) {
                    Text(
                        stringResource(R.string.buddy_page_conversations_more_failed),
                        Modifier.semantics { liveRegion = LiveRegionMode.Polite },
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
                OutlinedButton(onClick = taps.showMore, busy = rows.loadingMore) { Text(stringResource(R.string.buddy_page_show_more)) }
            }
        }
    }
}

@Composable
private fun ConversationRow(
    conversation: BuddyConversation,
    open: Boolean,
    onOpen: () -> Unit,
) {
    ListRow(
        headline = { Text(conversation.title, maxLines = 1, overflow = TextOverflow.Ellipsis) },
        // Main's aria-current: TalkBack says which conversation is the open one.
        modifier = Modifier.semantics { if (open) selected = true },
        onClick = onOpen,
        highlighted = open,
        meta = { Text(lastAsked(conversation.lastAskedAt), maxLines = 1) },
    )
}

/** Today's rows say when, earlier ones which day, as main's rows do. */
@Composable
private fun lastAsked(moment: Instant): String {
    val zone = ZoneId.systemDefault()
    val at =
        java.time.Instant
            .ofEpochMilli(moment.toEpochMilliseconds())
            .atZone(zone)
    val today = LocalDate.now(zone)
    val locale = currentLocale()

    if (at.toLocalDate() == today) {
        return formatTimeOfDay(at.toLocalTime(), locale, DateFormat.is24HourFormat(LocalContext.current))
    }
    return formatDate(at.toLocalDate(), locale, DateStyle.Day, today)
}

/** A highlighted row's corners keep this far from the pane's or sheet's edge, so its words start 24dp in, as the page's other sheets do. */
private val LIST_EDGE = 8.dp
