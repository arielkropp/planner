# Trip Planner

A static, client-side travel planner. Open the [live site](https://arielkropp.github.io/planner/).

## Architecture

The deployed app is a modular static web application with no runtime dependencies (Vite is a development-only tool).

It has three **screens**: Itinerary, Packing and Work log (`#itinerary`, `#packing`, `#work`). It also has two **platforms**, desktop and mobile. The two platforms are similar but independent: each one owns its markup, styles and UI code. Only the logic is shared. `index.html` is a single shell that holds one inert `<template>` per platform. `js/boot.js` mounts the one that matches the viewport (breakpoint: 760px) and swaps it live when the window crosses that width, so the two UIs never share a document.

```
index.html          Shell: head, theme bootstrap, stylesheet links and the two platform templates
icon.svg            Source app icon (the build converts this into requisite PWA icons)
manifest.webmanifest Web app manifest for PWA installation
html/
  shared/           SVG icon symbols
  dev/              Service worker registration (build) and cleanup (dev server)
  desktop/          app.html, shell/ (sidebar), screens/, dialogs/
  mobile/           Same shape, with its own markup
css/
  shared/           Design tokens, base elements, glass materials, motion preferences
  desktop/          Sidebar layout, plus dialog and screen styles
  mobile/           Bottom tab bar and settings drawer, plus dialog and screen styles
js/
  boot.js           Picks the platform, mounts it and swaps it live
  shared/           Logic used by both platforms (no platform UI)
    constants.js, platform.js, router.js
    state/          Persistent store, validation, migrations, view state (survives a platform swap)
    domain/         Pure logic: work calculations, itinerary ordering, .ics export, backup
    utils/          Date arithmetic, timezones, currency formatting, DOM helpers
    components/     Dialogs and theme manager
  desktop/          app.js (mount), shell/, screens/{itinerary,packing,work}/
  mobile/           Same shape, plus shell/settings-drawer.js
scripts/            html-includes.mjs (include assembler) and build.mjs (writes dist/)
tests/              Node's built-in test runner, including a build test that checks the assembled site
```

### Adding or changing a screen

A screen is one HTML file and one JS folder **per platform**, plus an entry in `SCREENS` (`js/shared/constants.js`):

1. Add `html/<platform>/screens/<name>.html` (a `<section data-screen="<name>">`) and include it from `html/<platform>/app.html`.
2. Add `js/<platform>/screens/<name>/index.js` and initialise it from `js/<platform>/app.js`.
3. Put anything both platforms need (calculations, formatting) in `js/shared/` rather than importing across platforms.

The build test checks that both platforms offer the same screens, dialogs and element ids.

## Local development

The app runs in the browser as native ES modules, so it needs an HTTP server. [Vite](https://vite.dev) provides one that assembles `index.html` from its included files on the fly and reloads the page whenever one changes (CSS and JS are served as-is). Requires Node 22.12 or newer.

```bash
npm install      # once
npm run dev      # http://localhost:8000, assembles includes and reloads on change
```

The dev server does not register the service worker and clears any left over from a production build, so edits are never masked by cached files.

To check exactly what gets deployed, including the service worker and offline behaviour:

```bash
npm run preview  # builds into dist/ and serves it at http://localhost:4173
```

`npm run build` alone writes the site to `dist/` (git-ignored). JS and CSS are copied unbundled, `icon.svg` is automatically converted into the standard 192x192, 512x512, and maskable PNG formats, and the build writes the list of files the service worker precaches into `dist/service-worker.js`, so there is no list to maintain; the build test checks that every listed file exists. `index.html` pulls in the `html/` fragments with `<!-- @include html/... -->` directives. Include paths are relative to the project root, an include must sit alone on its line, and `build-only` / `dev-only` after the path limits it to the build or the dev server.

## Running tests

Run the automated test suite with Node's native test runner (no `npm install` needed):

```bash
npm test
```

## Privacy

The deployed site and its source code are public. The app has no sign-in or server-side storage: itinerary, packing, and work-log data stay in the current browser's local storage and are not synced to other devices. Anyone using the same browser profile can access saved data, so avoid entering sensitive details on a shared device.

## Offline use

After you first open the site while online and the service worker finishes installing, the app shell (including all modular scripts, stylesheets and icons) is cached. The planner can then be reopened and used offline. Your data continues to be stored in that browser's local storage. You can also install the app to your home screen from the browser menu (Firefox: "Install" or "Add to Home screen"); installed apps launch directly into the offline shell without relying on the address bar. Offline support requires a browser that supports service workers; the optional web font may fall back to a system font while offline.

## Deployment

This private repository is the development source. Work on the `dev` branch (the **Tests** workflow runs on every push and pull request), then merge into `main` when ready. Every push to `main` runs the test suite, builds the site (`node scripts/build.mjs`, which assembles `index.html` from its included files) and publishes the result to the public `planner` repository, whose GitHub Pages workflow deploys it. You can also publish manually via **Actions → Publish to public planner → Run workflow**. The publish step stamps the service worker cache name with the commit so browsers pick up new versions.

The workflow pushes to the public repository's `main` branch using a write-enabled deploy key: the private key is stored here as the `PLANNER_DEPLOY_KEY` Actions secret, and the public key is registered under `arielkropp/planner` → Settings → Deploy keys. GitHub Pages (source: GitHub Actions) is enabled on the public repository only.
