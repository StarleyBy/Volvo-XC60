# CS Helper — Cardiac Surgery Pocket Reference

A progressive web app (PWA) for clinical use in a cardiac surgery department.  
Hosted on GitHub Pages · Works offline · Mobile-friendly.

## Features

- 📋 **References** — Echo norms, ECG norms, drug formulary
- 🧮 **Calculators** — Insulin basis-bolus, heparin infusion, drug dilution, IV rates
- 📊 **Scales** — CHA₂DS₂-VASc, HAS-BLED, NYHA
- 📄 **Protocols** — Department-specific clinical protocols
- 🗒️ **Cheat Sheets** — Renal failure, cirrhosis, carotid Doppler, PRISM setup
- 🏷️ **ICD-9 Codes** — Searchable diagnoses and procedures for cardiac surgery
- ✏️ **Editor** (`redact.html`) — Markdown editor with live preview (admin only)

## Access

| Role  | Password | Access |
|-------|----------|--------|
| Admin | `456755` | Full access + editor link + hidden pages |
| User  | `0455`   | Visible pages only, all calculators |

> Passwords are stored client-side (GitHub Pages limitation). Do not use for sensitive data storage.

## Structure

```
/
├── index.html          # Main app shell
├── redact.html         # Markdown editor (admin)
├── app.js              # App logic
├── app.css             # Styles (light + dark theme)
├── sw.js               # Service Worker (offline)
├── manifest.json       # PWA manifest
├── app-manifest.yml    # Content registry (navigation tree)
└── books/
    ├── calculators/    # Interactive HTML calculators
    ├── references/     # Markdown reference pages
    ├── scales/         # Clinical scoring scales
    ├── protocols/      # Department protocols
    ├── cheatsheets/    # Quick reference sheets
    └── icd/            # ICD-9 JSON databases
```

## 🛠 Development & Content Management

### Manifest Auto-Builder
To avoid manual errors in `app-manifest.yml`, use the automatic builder. It scans the `books/` directories and generates the manifest based on file metadata.

1.  **Add/Update files** in the `books/` subfolders.
2.  **Add metadata** to your files:
    -   **Markdown (.md):** Use standard frontmatter at the top.
    -   **HTML (.html):** Add a comment block in the `<head>`:
        ```html
        <!--
        metadata:
          title: "My Custom Title"
          tags: [tag1, tag2]
          visible: true
        -->
        ```
3.  **Run the builder:**
    ```bash
    node build-manifest.js
    ```
4.  The `app-manifest.yml` will be updated automatically with correct formatting.

### Manual Structure
If you prefer manual editing, the structure is defined in `app-manifest.yml`. Be extremely careful with YAML indentation.

### Theme & Styling
The app uses a CSS variable-based theme system. Styles are defined in `app.css`. HTML pages automatically inherit the look and feel through the main app shell when rendered.

## Dependencies (CDN-free, bundled)

Place in `/libs/`:
- [`marked.min.js`](https://github.com/markedjs/marked) — Markdown rendering
- [`js-yaml.min.js`](https://github.com/nodeca/js-yaml) — YAML manifest parsing

## GitHub Pages Setup

1. Go to repository Settings → Pages
2. Source: Deploy from branch `main`, folder `/` (root)
3. Access at `https://<username>.github.io/CS-Helper/`

## PWA Installation

On mobile: open in browser → "Add to Home Screen".  
On desktop (Chrome/Edge): install icon in address bar.
