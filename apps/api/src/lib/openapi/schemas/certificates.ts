import { certificateFactsShape, ownedCertificateShape } from "@zoonk/core/certificates/contract";
import { z } from "zod";

const certificateLinksShape = {
  imageUrls: z
    .object({
      link: z.url().meta({ description: "1200 × 630, the picture a shared link unfurls with" }),
      post: z.url().meta({ description: "1080 × 1350, to upload as a social post" }),
      print: z
        .url()
        .meta({ description: "The certificate itself, landscape, for print and saving" }),
      screen: z
        .url()
        .meta({
          description:
            "The same certificate at screen size (2246 × 1588), for every on-screen display; print and saving use print",
        }),
    })
    .meta({
      description:
        "PNG pictures of the certificate, public (no auth header). They change when the learner's name changes",
      id: "CertificateImageUrls",
    }),
  linkedInUrl: z
    .url()
    .meta({
      description:
        "Opens LinkedIn's form to add the certificate to the learner's profile; LinkedIn may not prefill it, so also show the name, issuer, issue date, ID and URL to copy",
    }),
  url: z.url().meta({ description: "The certificate's public verification page" }),
};

export const certificateSchema = z
  .object({ ...certificateFactsShape, ...certificateLinksShape })
  .meta({
    description: "A certificate as anyone with its link sees it, with its page and pictures",
    id: "Certificate",
  });

const ownedCertificateSchema = z
  .object({
    ...ownedCertificateShape,
    imageUrls: certificateLinksShape.imageUrls.nullable(),
    linkedInUrl: certificateLinksShape.linkedInUrl.nullable(),
    url: certificateLinksShape.url.nullable(),
  })
  .meta({
    description:
      "One of the learner's own certificates; its page, pictures and LinkedIn link are null exactly while it's `locked`",
    id: "OwnedCertificate",
  });

export const certificateListResponseSchema = z
  .object({
    certificates: z
      .array(ownedCertificateSchema)
      .meta({ description: "Latest finished first; empty until the learner earns one" }),
  })
  .meta({ id: "CertificateList" });

export const goalCertificatesResponseSchema = z
  .object({
    certificates: z
      .array(ownedCertificateSchema)
      .meta({
        description:
          "Every certificate of the goal's levels and of its plan the learner holds, in level order with the plan's last, including any just written and a level certified in another goal",
      }),
  })
  .meta({ id: "GoalCertificates" });
