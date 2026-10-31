# Portfolio

Static, dependency-free portfolio site. Open `index.html` directly in a browser or host the folder on any static host (GitHub Pages, Netlify, …).

```
index.html            all content
assets/css/styles.css design tokens + layout
assets/js/main.js     reveal, nav state, video facades, audio player, code highlighting
assets/audio/         music files (see assets/audio/README.md)
assets/img/           images, GIFs, videos
```

## Replacing placeholders

| What | Where | How |
| --- | --- | --- |
| Name, email, LinkedIn | `index.html` | Search for `Your Name`, `hello@example.com`, `your-handle`. |
| Portrait | Hero `<figure class="hero__portrait">` | Replace the inner `.panel` with the `<img>` from the HTML comment above it. |
| YouTube videos | `<div class="video" data-yt-id="">` | Put the 11-character video ID into `data-yt-id`. Empty = "coming soon". |
| GIF previews (blue panels) | `<figure class="panel panel--gif">` | Replace the inner `.panel__inner` with `<video src="assets/img/x.webm" autoplay muted loop playsinline></video>` (lighter than GIF) or an `<img>`, and remove `role`/`aria-label` from the figure. The media fills the panel automatically. |
| Images (red panels) | `<figure class="panel panel--img">` | Same: replace `.panel__inner` with `<img src="assets/img/x.jpg" alt="…" loading="lazy" decoding="async">`. |
| Metrics | `<ul class="metrics">` | Replace `—` values and remove the `data-todo` attribute. |
| Source / build links | `<span class="link-arrow link-arrow--soon">` | Change to `<a class="link-arrow" href="…">`. |
| Résumé | Contact section | Swap the `is-soon` span for the commented `<a>` once `assets/resume.pdf` exists. |
| Music | `assets/audio/` + track list in `index.html` | Durations are read from the files automatically. |

Note: YouTube blocks embeds on `file://` pages, so locally the video opens in a new tab; on a real host it plays inline.
