# Changelog

## 1.8.0 2026-06-28

- Complete rewrite on Remix 3 (new server framework)
- Offline-first via Service Worker — asset caching with version-keyed invalidation
- All mutations work without JavaScript (native HTML form POST fallbacks)
- Article sort order (rejig) — drag to reorder, persisted server-side via sortKey
- SW update notification with persistent action toast
- Native share sheet on mobile; clipboard + toast fallback for copy-link
- Auto-create list on valid-ID miss; explicit recreate flow with toast
- Stale list cleanup — lists inactive for 90 days are deleted automatically
- Gzip/brotli compression middleware
- Security headers (CSP, X-Frame-Options, etc.) and server-side input validation
- Typed i18n translation keys
- Lighthouse 100/100/100/100
- Deployed to fly.io

## 1.7.0 2023-08-31

- Add clear list button

## 1.6.1 2023-08-29

- Minor SEO
- Add some handling of potential service errors

## 1.6.0 2023-08-26

- added optimistic updates of all mutations
- migrated to Remix (from Next.js)

## 1.5.1 2023-08-17

- Add about page, linked in footer
- Add privacy and imprint page, linked in footer
- Add link to github repository in footer

## 1.4.0 2023-08-12

- Enable snappy page transitions
- Optimize background image scale on small devices
- Reload app, if shopping list or app version has changed
- Add widget to quickly change sequence of articles

## 1.3.0 2023-08-10

- Add "Buy me a coffee" link to navbar
- Add "Share" Button

## 1.2.0 2023-08-08

- Show link to current List on landing page, instead of create new button
- Enhance Progressive Web App (PWA) capabilities
- Change general layout and styling (e.g. background image)

## 1.1.1 2023-08-01

- Add rate limit on create list
- Add loading spinners to some submit buttons

## 1.0.1 2023-07-30

### Initial release of Minimum Viable Product based on web technologies

- User can create a Shopping List and share it with other users.
- Every user with access to the list can add, change or remove articles.
- No authentication or authorization must be required.
- No cookies or sessions must be used.
- No tracking or analytics must be used.
