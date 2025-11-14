"use client";

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
import { IconX } from "@tabler/icons-react";
import { useExtracted } from "next-intl";
import Image from "next/image";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { updatePageAction, type UpdatePageState } from "./actions";

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
      <input type="hidden" name="slug" value={props.slug} />
      <input type="hidden" name="currentImage" value={props.image || ""} />
      <input type="hidden" name="removeImage" value={String(removeImage)} />

      {/* Basic Info */}
      <div className="flex flex-col gap-6">
        <h2 className="font-semibold text-lg">{t("Basic Information")}</h2>

        <div className="flex flex-col gap-2">
          <Label htmlFor="name">{t("Page name")}</Label>
          <Input
            id="name"
            name="name"
            required
            type="text"
            defaultValue={props.name}
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
              required
              type="text"
              value={newSlug}
              onChange={handleSlugChange}
            />
          </InputGroup>
          <p className="text-muted-foreground text-sm">
            {t("This will appear in the link:")} zoonk.com/p/{newSlug}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="description">{t("Description")}</Label>
          <Textarea
            id="description"
            name="description"
            rows={4}
            defaultValue={props.description || ""}
            placeholder={t(
              "Tell people about your business or organization...",
            )}
          />
        </div>
      </div>

      {/* Image */}
      <div className="flex flex-col gap-6">
        <h2 className="font-semibold text-lg">{t("Logo / Image")}</h2>

        {imagePreview && !removeImage && (
          <div className="relative size-32">
            <Image
              src={imagePreview}
              alt={t("Page image")}
              fill
              className="rounded-lg object-cover"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -right-2 -top-2 size-8"
              onClick={handleRemoveImage}
            >
              <IconX className="size-4" />
            </Button>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="image">{t("Upload new image")}</Label>
          <Input
            id="image"
            name="image"
            type="file"
            accept="image/*"
            onChange={handleImageChange}
          />
        </div>
      </div>

      {/* Links */}
      <div className="flex flex-col gap-6">
        <h2 className="font-semibold text-lg">{t("Links")}</h2>

        <div className="flex flex-col gap-2">
          <Label htmlFor="website">{t("Website")}</Label>
          <Input
            id="website"
            name="website"
            type="url"
            defaultValue={props.website || ""}
            placeholder="https://example.com"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="xUrl">X</Label>
            <Input
              id="xUrl"
              name="xUrl"
              type="url"
              defaultValue={props.xUrl || ""}
              placeholder="https://x.com/username"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="instagramUrl">Instagram</Label>
            <Input
              id="instagramUrl"
              name="instagramUrl"
              type="url"
              defaultValue={props.instagramUrl || ""}
              placeholder="https://instagram.com/username"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="linkedinUrl">LinkedIn</Label>
            <Input
              id="linkedinUrl"
              name="linkedinUrl"
              type="url"
              defaultValue={props.linkedinUrl || ""}
              placeholder="https://linkedin.com/company/name"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="threadsUrl">Threads</Label>
            <Input
              id="threadsUrl"
              name="threadsUrl"
              type="url"
              defaultValue={props.threadsUrl || ""}
              placeholder="https://threads.net/@username"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="youtubeUrl">YouTube</Label>
            <Input
              id="youtubeUrl"
              name="youtubeUrl"
              type="url"
              defaultValue={props.youtubeUrl || ""}
              placeholder="https://youtube.com/@channel"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tiktokUrl">TikTok</Label>
            <Input
              id="tiktokUrl"
              name="tiktokUrl"
              type="url"
              defaultValue={props.tiktokUrl || ""}
              placeholder="https://tiktok.com/@username"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="githubUrl">GitHub</Label>
            <Input
              id="githubUrl"
              name="githubUrl"
              type="url"
              defaultValue={props.githubUrl || ""}
              placeholder="https://github.com/username"
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
          type="button"
          variant="ghost"
          onClick={() => router.push(`/p/${props.slug}`)}
        >
          {t("Cancel")}
        </Button>
      </div>
    </form>
  );
}
