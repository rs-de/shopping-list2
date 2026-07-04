# Changelog

## 1.10.0 2026-07-05

- Split shopping list into three focused screens: Articles (add/edit),
  Plan (reorder for pickup), Shopping (check off in-store) — fixes the
  rejig column briefly flashing on screen with nothing checked
- Fix offline mode: app JS/CSS were never cached, breaking offline use
  entirely (not just adding — even viewing an existing list failed)
- Faster navigation from the homescreen via page precaching
- Fix iOS Safari never picking up the new app version after a deploy
- Fix stale local data reviving items already removed on another device
- Fix rejig button styling inconsistency and iOS drift of the sticky
  rejig column
- Keep the page title centered when switching between screens

## 1.9.0 2026-07-02

- Local-first: list data stored in IndexedDB; works fully offline after first visit
- Background server sync picks up changes from other devices
- Service Worker: stale-while-revalidate for instant PWA startup (no black screen on iOS)
- Rejig column sticky to viewport — stays visible while scrolling long lists
- Rejig help panel: backdrop overlay, closes on outside click
- PWA homescreen name fixed ("Shopping List" instead of "List")
- Fix SW cache pollution that caused incorrect URL on iOS homescreen install

## 1.8.0 2026-06-28

- Complete rewrite on Remix 3
- Offline-first via Service Worker
- Works without JavaScript
- Rejig — sort articles by pickup position in the supermarket
- Notify users on new app version
- Stale lists inactive for 90+ days are removed automatically
- Security headers and input validation
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
