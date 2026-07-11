# Engineering Paradigms Realized in shopping-list2

Key properties of a well-built web application that this project embodies.

---

## 1. Optimistic UI with a durable local write-buffer

Mutations apply to the UI immediately; the server remains the authoritative
source of state. Unsynced edits are held durably so they survive a reload or
a dropped connection, and are reconciled with the server once connectivity
returns — superseding in-flight requests and verifying against a possibly
stale cache along the way.

## 2. Progressive enhancement

Every list action works as a plain HTML form submission, independent of
JavaScript. JavaScript layers optimistic, instant feedback on top of that
baseline rather than replacing it — interactive UI state (like revealing a
delete bar) is driven by native CSS selectors instead of requiring script.

## 3. Resource-aware offline caching

The service worker applies a different caching strategy per resource type:
instant-with-background-refresh for pages, cache-first for immutable static
assets, network-first for anything that must never go stale. Each deploy
invalidates its own cache automatically, without a manual version bump.

## 4. Installable, platform-correct PWA

The app can be added to the home screen and launches like a native app —
manifest, icons, theme color, and the platform-specific metadata (like
iOS's launch splash screen) that a generic manifest alone doesn't cover.
Updates announce themselves via an in-app prompt instead of surprising the
user mid-session.

## 5. Performance and quality gated by CI, not opinion

Lighthouse runs against a real production build with hard minimum scores
for performance, accessibility, best practices, and SEO — a regression
fails the build rather than shipping quietly. Static assets are cached
immutably and served compressed.

## 6. Security headers applied uniformly

Every response carries CSP, frame, content-type, and referrer protections
by default, so a new route can't accidentally ship without them. Mutating
endpoints validate input server-side regardless of client-side checks, and
abusive request bursts are rate-limited.

## 7. Server-resolved internationalization

The user's language is determined once, server-side, from their browser's
language preference, and delivered as typed, pre-resolved strings — no
i18n runtime ships to the browser, and the type system enforces that every
locale defines the same set of keys.

## 8. Minimal, reproducible deployment

Single-region deployment with the app's data on a persistent volume,
database migrations run automatically before each rollout, and idle
capacity scales to zero. No infrastructure beyond what the app needs.

## 9. Concurrency edge cases treated as regressions

Race conditions and offline edge cases — competing edits, stale local
state, interrupted requests — are covered by automated tests, not just
manual verification, so a fixed bug stays fixed.

## 10. Anonymous, URL-shareable access

A list has no owner, password, or account — its unguessable URL is the only
credential, and anyone with the link can view and edit it from any device.
Sharing is just sending that link; there's nothing to sign up for on either
end.

## 11. Self-limiting data lifecycle

Without accounts, the app still avoids unbounded growth: inactive lists
expire automatically, and a stale link to a deleted list recreates it
quietly instead of erroring.

## 12. Framework-free, consistent design system

Visual design is plain CSS built on a systematic color scale that adapts
to light/dark mode automatically, with no UI framework dependency.
Interactive elements meet baseline touch-target sizing and avoid layout
shift.

## 13. Accessible by construction

Decorative icons are hidden from assistive tech, interactive controls carry
accessible names, and dynamic status (toasts, verification spinners) is
exposed via live regions — accessibility is treated as a UI property to get
right, not just a Lighthouse score to hit.

## 14. Graceful failure at every layer

Unknown routes and server errors render proper, styled pages instead of a
blank screen or a stack trace; network failures during a mutation surface
as a clear, dismissible message rather than a silent no-op.
