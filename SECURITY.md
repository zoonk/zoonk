# Security Policy

_Based on [Supabase's security policy](https://supabase.com/.well-known/security.txt)._

## Out of scope vulnerabilities

- Clickjacking on pages with no sensitive actions.
- Unauthenticated/logout/login CSRF.
- Attacks requiring MITM or physical access to a user's device.
- Attacks requiring social engineering.
- Any activity that could lead to the disruption of our service (DoS).
- Content spoofing and text injection issues without showing an attack vector/without being able to modify HTML/CSS.
- Email spoofing.
- Missing DNSSEC, CAA, CSP headers.
- Lack of Secure or HTTP only flag on non-sensitive cookies.
- Deadlinks.
- User enumeration.

## Testing guidelines

- Do not run automated scanners on other customer projects. Running automated scanners can run up costs for our users. Aggressively configured scanners might inadvertently disrupt services, exploit vulnerabilities, lead to system instability or breaches and violate Terms of Service from our upstream providers. Our own security systems won't be able to distinguish hostile reconnaissance from whitehat research. If you wish to run an automated scanner, notify us at security@zoonk.org and only run it on your own Zoonk project. Do NOT attack projects of other customers.
- Do not take advantage of the vulnerability or problem you have discovered, for example by downloading more data than necessary to demonstrate the vulnerability or deleting or modifying other people's data.

## Supported versions

Zoonk applies bug fixes only to the latest version.

## Announcements

[Security advisories will be published on GitHub](https://github.com/zoonk/zoonk/security).

## Reporting a vulnerability

[Please disclose security vulnerabilities privately via GitHub](https://github.com/zoonk/zoonk/security).

## Bug bounty program

We do not offer a bug bounty program at this time.
