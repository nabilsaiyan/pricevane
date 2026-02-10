# Brand marks

Official single-colour silhouettes from the Simple Icons distribution, pinned
at v15 (a few taken from the upstream repo where the npm build omits them).
LinkedIn and Playwright are deliberately absent: both have been withdrawn from
that distribution, and an approximation drawn here would be worse than leaving
them out.

These are other companies' trademarks. Two rules:

* **Only show a mark for something that is actually wired.** `BRANDS` in
  src/components/landing/Brands.tsx carries a `live` flag per entry and the UI
  labels anything unbuilt as planned. A logo grid that does not distinguish the
  two is a claim of integrations that do not exist.
* **A mark is not an endorsement.** Nothing here may be presented as a
  partnership, sponsorship or approval.

The files carry no `fill`, so CSS paints them through `mask` and each one takes
its own official hex from the `--bc` custom property. Marks whose brand colour
is black are painted in the page's foreground instead, because black on a
near-black ground is not a logo, it is a hole.
