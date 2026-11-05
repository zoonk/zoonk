import {
  type CertificateFacts,
  type OwnedCertificateFacts,
} from "@zoonk/core/certificates/contract";
import { getCertificateLinks } from "@zoonk/utils/certificate-links";

/** Native apps draw no links of their own: every certificate the API returns carries them. */
export function withCertificateLinks<Facts extends CertificateFacts>(facts: Facts) {
  const { imageUrls, linkedInUrl, url } = getCertificateLinks(facts);
  return { ...facts, imageUrls, linkedInUrl, url };
}

/** A locked certificate has no public page or pictures until the learner has Plus. */
export function withOwnedCertificateLinks(facts: OwnedCertificateFacts) {
  return facts.locked
    ? { ...facts, imageUrls: null, linkedInUrl: null, url: null }
    : withCertificateLinks(facts);
}
