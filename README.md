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
| GIF previews (blue panels) | `<figure class="panel panel--gif">` | Replace the inner `.panel__inner` with a looping video and remove `role`/`aria-label` from the figure (see below). |
| Images (red panels) | `<figure class="panel panel--img">` | Replace `.panel__inner` with an `<img>` or `<picture>` (see below) and remove `role`/`aria-label`. |
| Metrics | `<ul class="metrics">` | Replace `—` values and remove the `data-todo` attribute. |
| Source / build links | `<span class="link-arrow link-arrow--soon">` | Change to `<a class="link-arrow" href="…">`. |
| Résumé | Contact section | Swap the `is-soon` span for the commented `<a>` once `assets/resume.pdf` exists. |
| Music | `assets/audio/` + track list in `index.html` | Durations are read from the files automatically. |

Note: YouTube blocks embeds on `file://` pages, so locally the video opens in a new tab; on a real host it plays inline.

## Media guidelines

**Images** (column is ~640 px wide on desktop): export 640 px and 1280 px wide versions as AVIF + WebP.

```html
<picture>
  <source type="image/avif" srcset="assets/img/e36-640.avif 640w, assets/img/e36-1280.avif 1280w" sizes="(max-width: 64rem) 100vw, 640px">
  <img src="assets/img/e36-1280.webp" srcset="assets/img/e36-640.webp 640w, assets/img/e36-1280.webp 1280w"
       sizes="(max-width: 64rem) 100vw, 640px" width="1280" height="720" alt="BMW E36, three-quarter front render" loading="lazy" decoding="async">
</picture>
```

The hero portrait displays at max 256 px: export 256×320 and 512×640, keep `fetchpriority="high"` and no `loading="lazy"`.

**GIF replacements**: use short muted video loops, not GIFs (10–20× smaller). Provide MP4 (H.264) + WebM, a poster frame, and `preload="none"`. The script plays them only while visible and never with reduced motion.

```html
<video muted loop playsinline preload="none" poster="assets/img/ocean-poster.webp" width="1280" height="720">
  <source src="assets/img/ocean.webm" type="video/webm">
  <source src="assets/img/ocean.mp4" type="video/mp4">
</video>
```

**Social preview**: create `assets/img/social-preview.jpg` (1200×630, name + role + one strong frame), then un-comment the `og:image` tags in `<head>` and switch `twitter:card` to `summary_large_image`.

## Deploying

GitHub Pages: Settings → Pages → deploy from `main` / root. URLs in `<head>`, `404.html`, `robots.txt` and `sitemap.xml` assume `https://wasgehtsiedasan2205.github.io/PortfolioWebsite/`.
After changing CSS/JS, bump the `?v=` number on both references in `index.html` (and `404.html`) so visitors don't get stale files.
