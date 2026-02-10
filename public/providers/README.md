# Provider marks

`Providers` in src/components/landing/Chips.tsx and the provider picker in
src/app/app/settings/page.tsx each render one slot per model vendor, filled
from the file named after the vendor id:

    anthropic.svg    Claude   — wired today (src/lib/matching/claude.ts)
    openai.svg       GPT      — declared, not implemented
    google.svg       Gemini   — declared, not implemented

These are the official single-colour marks, taken from the Simple Icons
distribution of each vendor's published silhouette. They carry no `fill`, so
CSS paints them through `mask` (see `.provmark::after` in globals.css) and they
take whatever text colour is in force. Do not substitute an approximation, and
do not recolour them into a shared palette.

Two things to keep honest while only Anthropic is wired: the `soon` flag on the
unimplemented providers must stay, and displaying a mark must not be dressed up
as a partnership or an endorsement.
