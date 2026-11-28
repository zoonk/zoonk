import { TIME_ZONE_COOKIE } from "@/lib/learner/learner-time-zone";

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/** Written again when a tab comes back in another zone, as after a flight. */
const SCRIPT = `(()=>{const w=()=>{const z=Intl.DateTimeFormat().resolvedOptions().timeZone;const c=${JSON.stringify(`${TIME_ZONE_COOKIE}=`)}+z;if(z&&!document.cookie.split("; ").includes(c))document.cookie=c+";path=/;max-age=${ONE_YEAR_SECONDS};samesite=lax"+(location.protocol==="https:"?";secure":"")};w();document.addEventListener("visibilitychange",w)})()`;

export function TimeZoneCookieScript() {
  return (
    <script
      // oxlint-disable-next-line react/no-danger -- A fixed script that must run before the page's next request.
      dangerouslySetInnerHTML={{ __html: SCRIPT }}
    />
  );
}
