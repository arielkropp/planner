# Argentina Trip Planner

A static, client-side travel planner. Open the [live site](https://arielkropp.github.io/planner/).

## Architecture

The project is built as a zero-dependency, modular static web application:

- **`index.html`**: Semantic document structure and SVG symbol definitions.
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
- **`tests/`**: Unit test suite powered by Node's built-in test runner.

## Local development

Modern browsers require HTTP or HTTPS to load native ES modules due to CORS policies. Run a local server from the project directory:

```bash
# Using Python
python3 -m http.server 8000

# Or using Node / npx
npx serve .
```

Open `http://localhost:8000` in your browser.

## Running tests

Run the automated test suite with Node's native test runner (zero external dependencies required):

```bash
node --test tests/*.test.js
```

## Privacy

The deployed site and its source code are public. The app has no sign-in or server-side storage: itinerary, packing, and work-log data stay in the current browser's local storage and are not synced to other devices. Anyone using the same browser profile can access saved data, so avoid entering sensitive details on a shared device.

## Offline use

After you first open the site while online and the service worker finishes installing, the app shell (including all modular scripts and stylesheets) is cached. The planner can then be reopened and used offline. Your data continues to be stored in that browser's local storage. Offline support requires a browser that supports service workers; the optional web font may fall back to a system font while offline.

## Deployment

This private repository is the development source. To publish a tested snapshot to the public `planner` repository, run **Actions → Publish to public planner → Run workflow**. The workflow runs the test suite, then updates the public site's files; the public repository's GitHub Pages workflow deploys the result.

The workflow pushes to the public repository's `main` branch using a write-enabled deploy key: the private key is stored here as the `PLANNER_DEPLOY_KEY` Actions secret, and the public key is registered under `arielkropp/planner` → Settings → Deploy keys. GitHub Pages (source: GitHub Actions) is enabled on the public repository only.
