"use client";

import { IconX } from "@tabler/icons-react";
import { Button } from "@zoonk/ui/components/button";
import { Input, InputError, InputSuccess } from "@zoonk/ui/components/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@zoonk/ui/components/input-group";
import { Label } from "@zoonk/ui/components/label";
import { Textarea } from "@zoonk/ui/components/textarea";
import { SubmitButton } from "@zoonk/ui/patterns/buttons/submit";
import { toSlug } from "@zoonk/utils/validation";
import Image from "next/image";
import { useExtracted } from "next-intl";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { type UpdatePageState, updatePageAction } from "./actions";

type EditFormProps = {
  slug: string;
  name: string;
  description: string | null;
  website: string | null;
  image: string | null;
  xUrl: string | null;
  instagramUrl: string | null;
  linkedinUrl: string | null;
  threadsUrl: string | null;
  youtubeUrl: string | null;
  tiktokUrl: string | null;
  githubUrl: string | null;
};

const initialState: UpdatePageState = {
  status: "idle",
};

export function EditForm(props: EditFormProps) {
  const t = useExtracted();
  const router = useRouter();
  const [state, formAction] = useActionState(updatePageAction, initialState);
  const [newSlug, setNewSlug] = useState(props.slug);
  const [imagePreview, setImagePreview] = useState<string | null>(props.image);
  const [removeImage, setRemoveImage] = useState(false);

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewSlug(toSlug(e.target.value));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setRemoveImage(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setRemoveImage(true);
    // Reset file input
    const fileInput = document.getElementById("image") as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  // Redirect on success
  useEffect(() => {
    if (state.status === "success") {
      const targetSlug = state.newSlug || props.slug;
      router.push(`/p/${targetSlug}`);
    }
  }, [state.status, state.newSlug, props.slug, router]);

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-6">
      <input name="slug" type="hidden" value={props.slug} />
      <input name="currentImage" type="hidden" value={props.image || ""} />
      <input name="removeImage" type="hidden" value={String(removeImage)} />

      {/* Basic Info */}
      <div className="flex flex-col gap-6">
        <h2 className="font-semibold text-lg">{t("Basic Information")}</h2>

        <div className="flex flex-col gap-2">
          <Label htmlFor="name">{t("Page name")}</Label>
          <Input
            defaultValue={props.name}
            id="name"
            name="name"
            required
            type="text"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="newSlug">{t("Page URL")}</Label>
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <InputGroupText>zoonk.com/p/</InputGroupText>
            </InputGroupAddon>
            <InputGroupInput
              id="newSlug"
              name="newSlug"
              onChange={handleSlugChange}
              required
              type="text"
              value={newSlug}
            />
          </InputGroup>
          <p className="text-muted-foreground text-sm">
            {t("This will appear in the link:")} zoonk.com/p/{newSlug}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="description">{t("Description")}</Label>
          <Textarea
            defaultValue={props.description || ""}
            id="description"
            name="description"
            placeholder={t(
              "Tell people about your business or organization...",
            )}
            rows={4}
          />
        </div>
      </div>

      {/* Image */}
      <div className="flex flex-col gap-6">
        <h2 className="font-semibold text-lg">{t("Logo / Image")}</h2>

        {imagePreview && !removeImage && (
          <div className="relative size-32">
            <Image
              alt={t("Page image")}
              className="rounded-lg object-cover"
              fill
              src={imagePreview}
            />
            <Button
              className="-right-2 -top-2 absolute size-8"
              onClick={handleRemoveImage}
              size="icon"
              type="button"
              variant="destructive"
            >
              <IconX className="size-4" />
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="image">{t("Upload new image")}</Label>
          <Input
            accept="image/*"
            id="image"
            name="image"
            onChange={handleImageChange}
            type="file"
          />
        </div>
      </div>

      {/* Links */}
      <div className="flex flex-col gap-6">
        <h2 className="font-semibold text-lg">{t("Links")}</h2>

        <div className="flex flex-col gap-2">
          <Label htmlFor="website">{t("Website")}</Label>
          <Input
            defaultValue={props.website || ""}
            id="website"
            name="website"
            placeholder="https://example.com"
            type="url"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="xUrl">X</Label>
            <Input
              defaultValue={props.xUrl || ""}
              id="xUrl"
              name="xUrl"
              placeholder="https://x.com/username"
              type="url"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="instagramUrl">Instagram</Label>
            <Input
              defaultValue={props.instagramUrl || ""}
              id="instagramUrl"
              name="instagramUrl"
              placeholder="https://instagram.com/username"
              type="url"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="linkedinUrl">LinkedIn</Label>
            <Input
              defaultValue={props.linkedinUrl || ""}
              id="linkedinUrl"
              name="linkedinUrl"
              placeholder="https://linkedin.com/company/name"
              type="url"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="threadsUrl">Threads</Label>
            <Input
              defaultValue={props.threadsUrl || ""}
              id="threadsUrl"
              name="threadsUrl"
              placeholder="https://threads.net/@username"
              type="url"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="youtubeUrl">YouTube</Label>
            <Input
              defaultValue={props.youtubeUrl || ""}
              id="youtubeUrl"
              name="youtubeUrl"
              placeholder="https://youtube.com/@channel"
              type="url"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tiktokUrl">TikTok</Label>
            <Input
              defaultValue={props.tiktokUrl || ""}
              id="tiktokUrl"
              name="tiktokUrl"
              placeholder="https://tiktok.com/@username"
              type="url"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="githubUrl">GitHub</Label>
            <Input
              defaultValue={props.githubUrl || ""}
              id="githubUrl"
              name="githubUrl"
              placeholder="https://github.com/username"
              type="url"
            />
          </div>
        </div>
      </div>

      {state.status === "error" && state.message && (
        <InputError>{state.message}</InputError>
      )}

      {state.status === "success" && (
        <InputSuccess>{t("Page updated successfully!")}</InputSuccess>
      )}

      <div className="flex gap-4">
        <SubmitButton>{t("Save changes")}</SubmitButton>
        <Button
          onClick={() => router.push(`/p/${props.slug}`)}
          type="button"
          variant="ghost"
        >
          {t("Cancel")}
        </Button>
      </div>
    </form>
  );
}
