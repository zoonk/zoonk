import { getSocialProfiles } from "@zoonk/ui/lib/social-profiles";

const SOCIAL_LINKS = getSocialProfiles("en");

export function SocialLinks() {
  return (
    <nav className="-mx-3.5 grid w-fit grid-cols-5 sm:grid-cols-9" aria-label="Social media">
      {SOCIAL_LINKS.map((link) => (
        <a
          key={link.label}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={link.label}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex size-11 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-[3px]"
        >
          <link.icon size={16} />
        </a>
      ))}
    </nav>
  );
}
