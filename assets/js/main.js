/* Portfolio — main.js
   Classic deferred script (works from file://). Each init function bails out
   quietly if its markup is missing. */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const hasIO = "IntersectionObserver" in window;

  /* Only one medium plays at a time: every player announces itself here. */
  const claimMedia = (owner) => document.dispatchEvent(new CustomEvent("media:exclusive", { detail: owner }));
  const onMediaClaim = (owner, pause) => document.addEventListener("media:exclusive", (e) => { if (e.detail !== owner) pause(); });

  /* ------------------------------------------------------------ Header */
  function initHeader() {
    const header = $(".site-header");
    if (!header) return;
    let ticking = false;
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      header.classList.toggle("is-scrolled", window.scrollY > 8);
      header.style.setProperty("--progress", max > 0 ? Math.max(0, Math.min(1, window.scrollY / max)).toFixed(4) : "0");
      ticking = false;
    };
    const queue = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    };
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue, { passive: true });
    update();
  }

  /* ------------------------------------------------------------ Reveal */
  function initReveal() {
    const items = $$(".reveal");
    if (!items.length) return;
    if (!hasIO || reducedMotion.matches) {
      items.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    items.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------ Active nav */
  function initNav() {
    const links = $$(".nav__links a[href^='#']");
    if (!links.length || !hasIO) return;
    const byId = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
    const targets = [...byId.keys()].map((id) => document.getElementById(id)).filter(Boolean);
    const hero = $(".hero");
    if (hero) targets.unshift(hero);

    const setActive = (id) => {
      links.forEach((a) => {
        if (a === byId.get(id)) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
      });
    };

    // A thin band in the middle of the viewport decides which section is "current";
    // the short last section wins while the footer is half visible.
    let bandId = "";
    let footerOwns = false;
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        bandId = entry.target.id;
        if (!footerOwns) setActive(bandId);
      }
    }, { rootMargin: "-45% 0px -50% 0px" });
    targets.forEach((s) => io.observe(s));

    const footer = $(".site-footer");
    if (footer && byId.has("contact")) {
      new IntersectionObserver(([e]) => {
        footerOwns = e.intersectionRatio >= 0.5;
        setActive(footerOwns ? "contact" : bandId);
      }, { threshold: [0, 0.5] }).observe(footer);
    }
  }

  /* ------------------------------------------------------------ YouTube facade */
  function initVideos() {
    const isFile = location.protocol === "file:";

    $$(".video[data-yt-id]").forEach((box) => {
      const id = (box.dataset.ytId || "").trim();
      const title = box.dataset.ytTitle || "Video";
      const btn = $(".video__btn", box);
      if (!btn) return;

      // Pending ("coming soon") is the static HTML default; only upgrade when a valid ID exists.
      if (!/^[\w-]{11}$/.test(id)) return;
      box.classList.remove("is-pending");
      btn.disabled = false;

      const poster = new Image();
      poster.className = "video__poster";
      poster.alt = "";
      poster.loading = "lazy";
      poster.decoding = "async";
      poster.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      box.insertBefore(poster, btn);
      btn.setAttribute("aria-label", `Play video: ${title}${isFile ? " (opens in a new tab)" : ""}`);

      let iframe = null;
      onMediaClaim(box, () => {
        // Requires enablejsapi=1; harmless no-op if the player isn't ready yet.
        iframe?.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "pauseVideo", args: [] }), "*");
      });

      btn.addEventListener("click", () => {
        claimMedia(box);
        // YouTube refuses embeds without a referrer (file://) — open the video instead.
        if (isFile) {
          window.open(`https://www.youtube.com/watch?v=${id}`, "_blank", "noopener");
          return;
        }
        iframe = document.createElement("iframe");
        iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1&enablejsapi=1`;
        iframe.title = title;
        iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
        iframe.allowFullscreen = true;
        iframe.referrerPolicy = "strict-origin-when-cross-origin";
        box.replaceChildren(iframe);
        iframe.focus();
      });
    });
  }

  /* ------------------------------------------------------------ Audio player */
  function initPlayer() {
    const root = $("[data-player]");
    const audio = root && $("[data-audio]", root);
    const tracks = root ? $$(".track", root) : [];
    if (!audio || !tracks.length) return;

    const ui = {
      toggle: $("[data-action='toggle']", root),
      prev: $("[data-action='prev']", root),
      next: $("[data-action='next']", root),
      seek: $("[data-seek]", root),
      current: $("[data-current]", root),
      duration: $("[data-duration]", root),
      title: $("[data-title]", root),
      ctx: $("[data-ctx]", root),
      status: $("[data-status]", root),
    };

    let index = 0;
    let loaded = -1;      // index whose file is currently in <audio>
    let scrubbing = false;
    let raf = 0;
    let probed = false;

    const fmt = (s) => {
      if (!Number.isFinite(s) || s < 0) return "0:00";
      const m = Math.floor(s / 60);
      return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
    };
    const say = (msg) => { ui.status.textContent = msg; };
    const durEl = (i) => $(".track__dur > span", tracks[i]);
    const isAvailable = (i) => !tracks[i].classList.contains("is-missing");

    function nextAvailable(from, dir, wrap) {
      for (let n = 1; n <= tracks.length; n++) {
        let i = from + dir * n;
        if (wrap) i = (i + tracks.length) % tracks.length;
        else if (i < 0 || i >= tracks.length) return -1;
        if (isAvailable(i)) return i;
      }
      return -1;
    }

    function setProgress(pct) {
      ui.seek.value = String(Math.round(pct * 1000));
      ui.seek.style.setProperty("--pct", `${pct * 100}%`);
    }
    const setSeekText = (seconds) => {
      const d = Number.isFinite(audio.duration) ? audio.duration : 0;
      ui.seek.setAttribute("aria-valuetext", `${fmt(seconds)} of ${fmt(d)}`);
    };

    function paintProgress() {
      raf = 0;
      if (scrubbing) return;
      const d = audio.duration;
      setProgress(Number.isFinite(d) && d > 0 ? audio.currentTime / d : 0);
      ui.current.textContent = fmt(audio.currentTime);
      setSeekText(audio.currentTime);
    }
    const schedulePaint = () => { if (!raf) raf = requestAnimationFrame(paintProgress); };

    function select(i) {
      index = i;
      const t = tracks[index];
      tracks.forEach((el) => el.removeAttribute("aria-current"));
      t.setAttribute("aria-current", "true");
      ui.title.textContent = t.dataset.title || "";
      ui.ctx.textContent = t.dataset.ctx || "";
      ui.duration.textContent = durEl(index)?.textContent || "0:00";
      ui.current.textContent = "0:00";
      setProgress(0);
      ui.seek.setAttribute("aria-valuetext", `0:00 of ${ui.duration.textContent}`);
      setMediaSession(t);
    }

    function unload() {
      loaded = -1;
      scrubbing = false;
      audio.removeAttribute("src");
      audio.load();
      ui.seek.disabled = true;
    }

    function load(i) {
      select(i);
      say("");
      scrubbing = false;
      ui.seek.disabled = true;
      audio.src = tracks[index].dataset.src;
      loaded = index;
    }

    function play() {
      if (!isAvailable(index)) return;
      if (loaded !== index) load(index);
      claimMedia(root);
      const p = audio.play();
      if (p && typeof p.catch === "function") {
        p.catch((err) => {
          if (err && err.name === "NotAllowedError") say("Playback was blocked by the browser — press play again.");
        });
      }
    }
    const pause = () => audio.pause();
    const toggle = () => (audio.paused || loaded !== index ? play() : pause());

    function step(dir) {
      const i = nextAvailable(index, dir, true);
      if (i < 0 || i === index) return;
      const wasPlaying = !audio.paused;
      load(i);
      if (wasPlaying) play();
    }

    function setMediaSession(t) {
      if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.dataset.title || "",
        artist: $(".hero__name")?.textContent.trim() || "",
        album: t.dataset.ctx || "",
      });
    }
    if ("mediaSession" in navigator) {
      const ms = navigator.mediaSession;
      const safe = (action, fn) => { try { ms.setActionHandler(action, fn); } catch (_) { /* unsupported */ } };
      safe("play", play);
      safe("pause", pause);
      safe("previoustrack", () => step(-1));
      safe("nexttrack", () => step(1));
    }

    function markMissing(i) {
      const t = tracks[i];
      if (t.classList.contains("is-missing")) return;
      t.classList.add("is-missing");
      $(".track__btn", t).disabled = true;
      console.warn(`[audio] Missing file: ${t.dataset.src}`);
    }

    function setPlaybackState(state) {
      if ("mediaSession" in navigator) navigator.mediaSession.playbackState = state;
    }

    function refreshAvailability() {
      const available = tracks.filter((_, i) => isAvailable(i)).length;
      root.classList.toggle("is-empty", available === 0);
      ui.toggle.disabled = available === 0;
      ui.prev.disabled = ui.next.disabled = available < 2;
      if (available === 0) {
        say("Tracks are being mastered — coming soon.");
        ui.title.textContent = "Coming soon";
        ui.ctx.textContent = `${tracks.length} tracks in preparation`;
        ui.duration.textContent = "0:00";
        if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
        setPlaybackState("none");
      } else if (!isAvailable(index) && audio.paused) {
        if (loaded === index) unload();
        select(nextAvailable(index, 1, true));
      }
    }

    // Check which files exist (metadata only, one at a time) and fill in their real durations.
    // A per-track timeout keeps the queue moving where browsers ignore preload (e.g. iOS on cellular);
    // a timeout is inconclusive, so only a real media error marks a track missing.
    function probe() {
      if (probed) return;
      probed = true;
      let i = -1;
      let current = null;
      let timer = 0;

      const finish = () => {
        clearTimeout(timer);
        if (current) { current.removeAttribute("src"); current.load(); current = null; }
      };
      const nextProbe = () => {
        finish();
        i += 1;
        if (i >= tracks.length) return;
        if (!isAvailable(i)) { nextProbe(); return; }   // already failed during playback
        const idx = i;
        const a = (current = new Audio());
        a.preload = "metadata";
        a.addEventListener("loadedmetadata", () => {
          if (a !== current) return;
          if (Number.isFinite(a.duration) && a.duration > 0) {
            durEl(idx).textContent = fmt(a.duration);
            if (idx === index && loaded !== index) ui.duration.textContent = fmt(a.duration);
          }
          nextProbe();
        });
        a.addEventListener("error", () => {
          if (a !== current) return;
          markMissing(idx);
          refreshAvailability();
          nextProbe();
        });
        timer = setTimeout(() => { if (a === current) nextProbe(); }, 8000);
        a.src = tracks[idx].dataset.src;
      };
      nextProbe();
    }
    if (hasIO) {
      const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); probe(); } }, { rootMargin: "200px 0px" });
      io.observe(root);
    } else {
      probe();
    }

    // Controls
    ui.toggle.addEventListener("click", toggle);
    ui.prev.addEventListener("click", () => step(-1));
    ui.next.addEventListener("click", () => step(1));
    $(".tracks", root).addEventListener("click", (e) => {
      const btn = e.target.closest(".track__btn");
      if (!btn || btn.disabled) return;
      const i = tracks.indexOf(btn.closest(".track"));
      if (i === index && loaded === index) toggle();
      else { load(i); play(); }
    });

    const endScrub = () => { scrubbing = false; schedulePaint(); };
    ui.seek.addEventListener("input", () => {
      scrubbing = true;
      const pct = Number(ui.seek.value) / 1000;
      ui.seek.style.setProperty("--pct", `${pct * 100}%`);
      if (Number.isFinite(audio.duration)) {
        ui.current.textContent = fmt(pct * audio.duration);
        setSeekText(pct * audio.duration);
      }
    });
    ui.seek.addEventListener("change", () => {
      if (Number.isFinite(audio.duration)) audio.currentTime = (Number(ui.seek.value) / 1000) * audio.duration;
      endScrub();
    });
    ["pointerup", "pointercancel", "blur"].forEach((type) => ui.seek.addEventListener(type, endScrub));

    // Media events
    const setBuffering = (on) => root.classList.toggle("is-buffering", on);
    audio.addEventListener("play", () => { root.classList.add("is-playing"); ui.toggle.setAttribute("aria-label", "Pause"); setPlaybackState("playing"); });
    audio.addEventListener("pause", () => { root.classList.remove("is-playing"); ui.toggle.setAttribute("aria-label", "Play"); setPlaybackState("paused"); setBuffering(false); });
    audio.addEventListener("waiting", () => setBuffering(true));
    audio.addEventListener("playing", () => setBuffering(false));
    const syncDuration = () => {
      if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
      ui.seek.disabled = false;
      ui.duration.textContent = fmt(audio.duration);
      setSeekText(audio.currentTime);
    };
    audio.addEventListener("loadedmetadata", syncDuration);
    audio.addEventListener("durationchange", syncDuration);
    audio.addEventListener("timeupdate", schedulePaint);
    audio.addEventListener("ended", () => {
      const i = nextAvailable(index, 1, false);
      if (i >= 0) { load(i); play(); }
      else { audio.currentTime = 0; schedulePaint(); }
    });
    audio.addEventListener("error", () => {
      const failed = loaded;
      if (!audio.getAttribute("src") || failed < 0) return;
      setBuffering(false);
      root.classList.remove("is-playing");
      ui.toggle.setAttribute("aria-label", "Play");
      unload();
      markMissing(failed);
      refreshAvailability();
      if (!root.classList.contains("is-empty")) say(`"${tracks[failed].dataset.title}" is unavailable right now.`);
    });

    onMediaClaim(root, pause);
    select(0);
  }

  /* ------------------------------------------------------------ Panel media */
  // Real images/videos inside placeholder panels fade in once loaded; on failure the placeholder stays.
  // Looping preview videos (GIF replacements) only play while visible and never under reduced motion.
  function initPanelMedia() {
    const videoIO = hasIO ? new IntersectionObserver((entries) => {
      for (const { target, isIntersecting } of entries) {
        if (isIntersecting && !reducedMotion.matches) target.play().catch(() => {});
        else target.pause();
      }
    }, { threshold: 0.25 }) : null;

    $$(".panel > img, .panel > picture > img, .panel > video").forEach((media) => {
      const panel = media.closest(".panel");
      const loaded = () => panel.classList.add("is-loaded");
      const failed = () => {
        const desc = $(".panel__desc", panel);
        if (desc) desc.textContent = "Preview unavailable";
        console.warn(`[media] Failed to load: ${media.currentSrc || media.getAttribute("src")}`);
      };

      if (media.tagName === "VIDEO") {
        media.muted = true;
        media.playsInline = true;
        media.removeAttribute("autoplay");
        if (media.readyState >= 2) loaded();
        else media.addEventListener("loadeddata", loaded, { once: true });
        // With <source> children the error fires on the last source, not on the video.
        ($("source:last-of-type", media) || media).addEventListener("error", failed, { once: true });
        if (videoIO) videoIO.observe(media);
        return;
      }

      if (media.complete) (media.naturalWidth > 0 ? loaded : failed)();
      else {
        media.addEventListener("load", loaded, { once: true });
        media.addEventListener("error", failed, { once: true });
      }
    });
  }

  /* ------------------------------------------------------------ Misc */
  function initYear() {
    const el = $("[data-year]");
    if (el) el.textContent = String(new Date().getFullYear());
  }

  initHeader();
  initReveal();
  initNav();
  initVideos();
  initPlayer();
  initPanelMedia();
  initYear();
})();
