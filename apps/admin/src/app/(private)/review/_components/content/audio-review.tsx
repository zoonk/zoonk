import { Badge } from "@zoonk/ui/components/badge";
import { PlayAudioInline } from "../play-audio-inline";

export function AudioReview({
  item,
}: {
  item: {
    id: string;
    text: string;
    label: string;
    audioUrl: string | null;
    targetLanguage: string;
    romanization: string | null;
  };
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{item.label}</Badge>
        <span className="text-muted-foreground text-sm">{item.targetLanguage}</span>
      </div>

      <p className="text-2xl font-semibold">{item.text}</p>

      {item.romanization && <p className="text-muted-foreground text-sm">{item.romanization}</p>}

      {item.audioUrl && (
        <div className="flex justify-center py-4">
          <PlayAudioInline audioUrl={item.audioUrl} />
        </div>
      )}
    </div>
  );
}
