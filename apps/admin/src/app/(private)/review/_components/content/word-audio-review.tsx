"use client";

import { type Word } from "@zoonk/db";
import { Badge } from "@zoonk/ui/components/badge";

export function WordAudioReview({ item }: { item: Word }) {
  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <h2 className="text-4xl font-bold">{item.word}</h2>
      <p className="text-muted-foreground text-lg">{item.translation}</p>

      <div className="flex gap-2">
        <Badge variant="outline">{item.targetLanguage}</Badge>
        <Badge variant="outline">{item.userLanguage}</Badge>
      </div>

      {item.audioUrl && (
        <audio controls src={item.audioUrl} className="w-full max-w-md">
          <track kind="captions" />
        </audio>
      )}
    </div>
  );
}
