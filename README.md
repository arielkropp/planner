# Trip Planner

A static, client-side travel planner. Open the [live site](https://arielkropp.github.io/planner/).

## Architecture

The deployed app is a modular static web application with no runtime dependencies (Vite is a development-only tool):

- **`index.html`**: Page shell (head, theme bootstrap) that composes the app from the folders below with `<!-- @include ... -->` directives.
- **`pages/`**: One HTML file per page (`itinerary.html`, `packing.html`, `work.html`).
- **`dialogs/`**: One HTML file per dialog.
- **`layout/`**: Shared shell pieces: SVG icon symbols, the sidebar, and the service worker registration scripts.
- **`css/`**: Modular stylesheets organized by design system and domain:
  - `variables.css`: Design tokens, colors, motion settings, and dark theme variables.
  - `base.css`: CSS reset, typography, buttons, and shell layout.
  - `glass.css`: Optical glass materials, jewel buttons, and specular sheen effects.
  - `dialogs.css`: Modal dialogs, inputs, and custom date/timezone pickers.
  - `itinerary.css`: Toolbar, viewpicker lens, schedule list, and calendar grids.
  - `packing.css`: Progress bar, quick add form, search bar, and item table.
  - `work.css`: Work log metrics, coverage accordion, and log table.
  - `responsive.css`: Breakpoints, touch targets, and mobile navigation.
  - `main.css`: Master stylesheet aggregating all modules.
- **`js/`**: Native ES modules (`type="module"`) split by problem space:
  - `constants.js`: Date bounds, defaults, and configuration tables.
  - `router.js`: Hash-based client router with view scroll preservation.
  - `state/`: Persistent store, validation, and migration handlers.
  - `utils/`: Date arithmetic, timezones, currency formatting, and DOM helpers.
  - `components/`: Modal dialogs, confirmations, and theme manager.
  - `features/itinerary/`: Schedule agenda, monthly/weekly calendars, item modal, and .ics export.
  - `features/packing/`: Filter toggles, quick add, table editor, and preset templates.
  - `features/work/`: Workday calculations, leave balance, coverage grid, and table editor.
  - `features/settings/`: JSON backup/restore and mobile drawer.
  - `app.js`: Application bootstrap and coordinator.
- **`scripts/`**: `html-includes.mjs` (include assembler shared by the dev server and the build) and `build.mjs` (writes the deployable site to `dist/`).
- **`tests/`**: Unit test suite powered by Node's built-in test runner, including a build test that checks the assembled site.

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

`npm run build` alone writes the site to `dist/` (git-ignored). JS and CSS are copied unbundled, so the file list in `service-worker.js` must keep matching `js/` and `css/`; the build test fails if it references a missing file. When adding a page or dialog, create a file in `pages/` or `dialogs/` and add an `<!-- @include pages/your-file.html -->` line to `index.html`. Include paths are relative to the project root, and `build-only` / `dev-only` after the path limits an include to the build or the dev server.

## Running tests

Run the automated test suite with Node's native test runner (no `npm install` needed):

```bash
npm test
```

## Privacy

The deployed site and its source code are public. The app has no sign-in or server-side storage: itinerary, packing, and work-log data stay in the current browser's local storage and are not synced to other devices. Anyone using the same browser profile can access saved data, so avoid entering sensitive details on a shared device.

## Offline use

After you first open the site while online and the service worker finishes installing, the app shell (including all modular scripts and stylesheets) is cached. The planner can then be reopened and used offline. Your data continues to be stored in that browser's local storage. Offline support requires a browser that supports service workers; the optional web font may fall back to a system font while offline.

## Deployment

This private repository is the development source. Work on the `dev` branch (the **Tests** workflow runs on every push and pull request), then merge into `main` when ready. Every push to `main` runs the test suite, builds the site (`node scripts/build.mjs`, which assembles `index.html` from its included files) and publishes the result to the public `planner` repository, whose GitHub Pages workflow deploys it. You can also publish manually via **Actions → Publish to public planner → Run workflow**. The publish step stamps the service worker cache name with the commit so browsers pick up new versions.

The workflow pushes to the public repository's `main` branch using a write-enabled deploy key: the private key is stored here as the `PLANNER_DEPLOY_KEY` Actions secret, and the public key is registered under `arielkropp/planner` → Settings → Deploy keys. GitHub Pages (source: GitHub Actions) is enabled on the public repository only.
