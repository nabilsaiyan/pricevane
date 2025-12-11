# Provider marks — empty slots

`Providers` in src/components/landing/Chips.tsx renders one slot per model
vendor. Each slot loads `/providers/<id>.svg` as a background image. The files
are deliberately absent:

    anthropic.svg    Claude   — wired today (src/lib/matching/claude.ts)
    openai.svg       GPT      — declared, not implemented
    google.svg       Gemini   — declared, not implemented

These are other companies' trademarks. Download the official mark from each
vendor's brand page, drop it in here under the filename above, and the slot
fills with no other change. Do not substitute an approximation.

Two things to keep honest while only Anthropic is wired: the `soon` flag on
the unimplemented providers must stay, and displaying a mark must not be
dressed up as a partnership or an endorsement.
