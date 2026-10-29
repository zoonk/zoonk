package com.zoonk.android.feature.tutor

import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedCard
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.zoonk.android.R
import com.zoonk.android.feature.conversation.PracticeConversation
import com.zoonk.android.feature.subscription.PlusMark
import com.zoonk.android.feature.subscription.PlusNotice
import com.zoonk.android.navigation.AppRoute
import com.zoonk.android.ui.components.KindDot
import com.zoonk.android.ui.components.LearnKind
import com.zoonk.android.ui.components.OutlinedButton
import com.zoonk.android.ui.format.currentLocale
import com.zoonk.android.ui.format.formatList
import com.zoonk.android.ui.theme.zoonk
import com.zoonk.api.models.TutorToolOffer
import com.zoonk.api.models.TutorToolOfferOneOf
import com.zoonk.api.models.TutorToolOfferOneOf1
import com.zoonk.api.models.TutorToolOfferOneOf3
import com.zoonk.api.models.TutorToolOfferOneOf4
import com.zoonk.api.models.TutorToolOfferOneOf5
import com.zoonk.api.models.TutorToolOfferOneOf6
import com.zoonk.api.models.TutorToolOfferOneOf7
import com.zoonk.api.models.TutorToolOfferOneOfCourse

/** A place or practice the buddy offers under its answer; each opens only from the learner's tap. */
@Composable
internal fun TutorOffer(
    offer: TutorToolOffer,
    routes: TutorRoutes,
    modifier: Modifier = Modifier,
) {
    when (offer) {
        is TutorToolOffer.TutorToolOfferOneOfValue -> {
            StartGoalOffer(offer.value, routes, modifier)
        }

        is TutorToolOffer.TutorToolOfferOneOf1Value -> {
            ChapterTestOffer(offer.value, routes, modifier)
        }

        is TutorToolOffer.TutorToolOfferOneOf2Value -> {
            OfferCard(
                title = stringResource(R.string.tutor_offer_choose_focus),
                description = stringResource(R.string.tutor_offer_choose_focus_description),
                tile = { OfferIcon(R.drawable.ic_target) },
                modifier = modifier,
            ) { OfferButton(stringResource(R.string.tutor_offer_choose)) { routes.open(AppRoute.Plan(focus = "choose")) } }
        }

        is TutorToolOffer.TutorToolOfferOneOf3Value -> {
            ConversationCallOffer(offer.value, routes, modifier)
        }

        is TutorToolOffer.TutorToolOfferOneOf4Value -> {
            MockExamOffer(offer.value, routes, modifier)
        }

        is TutorToolOffer.TutorToolOfferOneOf5Value -> {
            EssayOffer(offer.value, routes, modifier)
        }

        is TutorToolOffer.TutorToolOfferOneOf6Value -> {
            MistakesOffer(offer.value, routes, modifier)
        }

        is TutorToolOffer.TutorToolOfferOneOf7Value -> {
            PronunciationOffer(offer.value, routes, modifier)
        }

        is TutorToolOffer.TutorToolOfferOneOf8Value -> {
            PlaceOffer(
                R.string.tutor_offer_stats,
                R.string.tutor_offer_stats_description,
                R.drawable.ic_bar_chart,
                AppRoute.Statistics,
                routes,
                modifier,
            )
        }

        is TutorToolOffer.TutorToolOfferOneOf9Value -> {
            PlaceOffer(
                R.string.tutor_offer_logbook,
                R.string.tutor_offer_logbook_description,
                R.drawable.ic_event_note,
                AppRoute.Logbook,
                routes,
                modifier,
            )
        }

        is TutorToolOffer.TutorToolOfferOneOf10Value -> {
            PlaceOffer(
                R.string.tutor_offer_memory,
                R.string.tutor_offer_memory_description,
                R.drawable.ic_psychology,
                AppRoute.Memory,
                routes,
                modifier,
            )
        }

        is TutorToolOffer.TutorToolOfferOneOf11Value -> {
            val subscribed = offer.value.subscribed
            OfferCard(
                title = stringResource(R.string.tutor_offer_plus),
                description =
                    stringResource(if (subscribed) R.string.tutor_offer_plus_subscribed else R.string.tutor_offer_plus_description),
                tile = { OfferIcon(R.drawable.ic_auto_awesome) },
                modifier = modifier,
            ) {
                OfferButton(stringResource(if (subscribed) R.string.tutor_offer_manage else R.string.tutor_offer_see_plus), routes.seePlus)
            }
        }
    }
}

@Composable
private fun StartGoalOffer(
    offer: TutorToolOfferOneOf,
    routes: TutorRoutes,
    modifier: Modifier,
) {
    val locked = offer.access == TutorToolOfferOneOf.Access.PLUS_REQUIRED

    OfferCard(
        title = stringResource(R.string.tutor_offer_start_goal),
        description = stringResource(R.string.tutor_offer_goal, offer.goal),
        tile = { OfferIcon(R.drawable.ic_add) },
        modifier = modifier,
        locked = locked,
    ) {
        if (locked) {
            PlusNotice(onSeePlus = routes.seePlus, inset = true, description = stringResource(R.string.tutor_offer_one_goal))
        } else {
            OfferButton(stringResource(R.string.tutor_offer_start)) { routes.open(AppRoute.StartGoal(goal = offer.goal)) }
        }
        offer.course?.let { CatalogCourseRow(it) { routes.open(AppRoute.CatalogCourse(it.id.toString())) } }
    }
}

@Composable
private fun CatalogCourseRow(
    course: TutorToolOfferOneOfCourse,
    onOpen: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        HorizontalDivider()
        Text(
            stringResource(R.string.tutor_offer_catalog_course),
            Modifier.padding(top = 8.dp),
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.labelMedium,
        )
        Row(
            Modifier
                .fillMaxWidth()
                .clip(MaterialTheme.shapes.medium)
                .clickable(onClick = onOpen)
                .padding(vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            CourseImage(course.imageUrl)
            Column(Modifier.weight(1f)) {
                Text(course.title, style = MaterialTheme.typography.titleSmall)
                course.description?.let {
                    Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                }
            }
            Icon(
                painterResource(R.drawable.ic_chevron_right),
                contentDescription = null,
                modifier = Modifier.align(Alignment.CenterVertically),
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

/** Main's subject icon: the course's picture on white, or a book where it has none. */
@Composable
private fun CourseImage(imageUrl: String?) {
    val shape = Modifier.size(COURSE_IMAGE_SIZE).clip(MaterialTheme.shapes.medium)

    if (imageUrl != null) {
        AsyncImage(model = imageUrl, contentDescription = null, modifier = shape.background(Color.White), contentScale = ContentScale.Crop)
    } else {
        Box(shape.background(MaterialTheme.colorScheme.surfaceContainerHigh), contentAlignment = Alignment.Center) {
            Icon(painterResource(R.drawable.ic_library_books), contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

/** The test screen starts it from its own button, as it does from Today. */
@Composable
private fun ChapterTestOffer(
    offer: TutorToolOfferOneOf1,
    routes: TutorRoutes,
    modifier: Modifier,
) {
    val lessons = offer.lessonsLeft.toInt()

    OfferCard(
        title = stringResource(R.string.tutor_offer_chapter_test, offer.chapterTitle),
        description = pluralStringResource(R.plurals.tutor_offer_chapter_test_lessons, lessons, lessons),
        tile = { OfferIcon(R.drawable.ic_fast_forward) },
        modifier = modifier,
    ) { OfferButton(stringResource(R.string.tutor_offer_take_test)) { routes.open(AppRoute.TestOut(offer.chapterId.toString())) } }
}

@Composable
private fun ConversationCallOffer(
    offer: TutorToolOfferOneOf3,
    routes: TutorRoutes,
    modifier: Modifier,
) {
    val character = offer.call.character

    OfferCard(
        title = offer.unitTitle,
        description =
            if (character != null) {
                stringResource(R.string.tutor_offer_call_with, character.name, character.role)
            } else {
                stringResource(R.string.tutor_offer_call)
            },
        tile = { KindDot(LearnKind.Conversation) },
        modifier = modifier,
    ) { PracticeConversation(offer.call, offer.chapterId, offer.goalId, routes.startCall, routes.open) }
}

@Composable
private fun MockExamOffer(
    offer: TutorToolOfferOneOf4,
    routes: TutorRoutes,
    modifier: Modifier,
) {
    val locked = offer.access == TutorToolOfferOneOf4.Access.PLUS_REQUIRED

    OfferCard(
        title = stringResource(R.string.tutor_offer_mock),
        description =
            stringResource(if (offer.subjects.isEmpty()) R.string.tutor_offer_mock_description else R.string.tutor_offer_mock_by_subject),
        tile = { KindDot(LearnKind.Mock) },
        modifier = modifier,
        locked = locked,
    ) {
        if (locked) {
            PlusNotice(onSeePlus = routes.seePlus, inset = true, description = stringResource(R.string.tutor_offer_mock_plus))
        } else {
            OfferButton(stringResource(R.string.tutor_offer_choose)) { routes.open(AppRoute.MockChooser) }
        }
    }
}

@Composable
private fun EssayOffer(
    offer: TutorToolOfferOneOf5,
    routes: TutorRoutes,
    modifier: Modifier,
) {
    val locked = offer.access == TutorToolOfferOneOf5.Access.PLUS_REQUIRED
    val cadence =
        when (offer.cadence) {
            TutorToolOfferOneOf5.Cadence.WEEKLY -> R.string.tutor_offer_essay_weekly
            TutorToolOfferOneOf5.Cadence.BIWEEKLY -> R.string.tutor_offer_essay_biweekly
            TutorToolOfferOneOf5.Cadence.FINAL_WEEKS -> R.string.tutor_offer_essay_final_weeks
        }

    OfferCard(
        title = offer.subject,
        description = stringResource(cadence),
        tile = { KindDot(LearnKind.Essay) },
        modifier = modifier,
        locked = locked,
    ) {
        if (locked) {
            PlusNotice(onSeePlus = routes.seePlus, inset = true, description = stringResource(R.string.tutor_offer_essay_plus))
        } else {
            OfferButton(stringResource(R.string.tutor_offer_open)) { routes.open(AppRoute.Subject(offer.subjectKey)) }
        }
    }
}

@Composable
private fun MistakesOffer(
    offer: TutorToolOfferOneOf6,
    routes: TutorRoutes,
    modifier: Modifier,
) {
    val count = offer.`open`.toInt()

    OfferCard(
        title = stringResource(R.string.tutor_offer_mistakes),
        description = pluralStringResource(R.plurals.tutor_offer_mistakes_open, count, count),
        tile = { KindDot(LearnKind.Mistakes) },
        modifier = modifier,
    ) { OfferButton(stringResource(R.string.tutor_offer_open)) { routes.open(AppRoute.Mistakes) } }
}

@Composable
private fun PronunciationOffer(
    offer: TutorToolOfferOneOf7,
    routes: TutorRoutes,
    modifier: Modifier,
) {
    val count = offer.count.toInt()

    OfferCard(
        title = pluralStringResource(R.plurals.tutor_offer_pronunciation, count, count),
        description = formatList(offer.words, currentLocale()),
        tile = { OfferIcon(R.drawable.ic_mic, tint = MaterialTheme.zoonk.warning) },
        modifier = modifier,
    ) { OfferButton(stringResource(R.string.tutor_offer_practice)) { routes.open(AppRoute.Pronunciation(offer.goalId.toString())) } }
}

@Composable
private fun PlaceOffer(
    @StringRes title: Int,
    @StringRes description: Int,
    @DrawableRes icon: Int,
    route: AppRoute,
    routes: TutorRoutes,
    modifier: Modifier,
) {
    OfferCard(
        title = stringResource(title),
        description = stringResource(description),
        tile = { OfferIcon(icon) },
        modifier = modifier,
    ) { OfferButton(stringResource(R.string.tutor_offer_open)) { routes.open(route) } }
}

@Composable
private fun OfferCard(
    title: String,
    description: String,
    tile: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    locked: Boolean = false,
    content: @Composable ColumnScope.() -> Unit,
) {
    OutlinedCard(modifier.widthIn(max = TUTOR_CARD_MAX_WIDTH).fillMaxWidth()) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                val titleLine =
                    with(LocalDensity.current) {
                        MaterialTheme.typography.titleSmall.lineHeight
                            .toDp()
                    }
                Box(Modifier.size(OFFER_ICON_SIZE, titleLine), contentAlignment = Alignment.Center) { tile() }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalArrangement = Arrangement.spacedBy(4.dp),
                        itemVerticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(title, Modifier.semantics { heading() }, style = MaterialTheme.typography.titleSmall)
                        if (locked) PlusMark()
                    }
                    Text(description, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                }
            }
            content()
        }
    }
}

@Composable
private fun OfferIcon(
    @DrawableRes icon: Int,
    tint: Color = MaterialTheme.colorScheme.onSurfaceVariant,
) {
    Icon(painterResource(icon), contentDescription = null, modifier = Modifier.size(OFFER_ICON_SIZE), tint = tint)
}

@Composable
private fun OfferButton(
    label: String,
    onClick: () -> Unit,
) {
    OutlinedButton(
        onClick = onClick,
    ) { Text(label) }
}

internal val TUTOR_CARD_MAX_WIDTH = 520.dp
private val OFFER_ICON_SIZE = 20.dp
private val COURSE_IMAGE_SIZE = 44.dp
