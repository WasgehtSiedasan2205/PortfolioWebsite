/* Portfolio — main.js
   Classic deferred script (works from file://). Each init function bails out
   quietly if its markup is missing. */
(() => {
  "use strict";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ------------------------------------------------------------ Header */
  function initHeader() {
    const header = $(".site-header");
    if (!header) return;
    let ticking = false;
    const update = () => {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
      ticking = false;
    };
    window.addEventListener("scroll", () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ------------------------------------------------------------ Reveal */
  function initReveal() {
    const items = $$(".reveal");
    if (!items.length) return;
    if (!("IntersectionObserver" in window) || reducedMotion.matches) {
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
    if (!links.length || !("IntersectionObserver" in window)) return;
    const byId = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
    const sections = [...byId.keys()].map((id) => document.getElementById(id)).filter(Boolean);

    const setActive = (id) => {
      links.forEach((a) => a.removeAttribute("aria-current"));
      const link = id && byId.get(id);
      if (!link) return;
      link.setAttribute("aria-current", "true");
      // Keep the active pill visible in the horizontally scrolling mobile nav.
      const strip = link.parentElement;
      if (strip.scrollWidth > strip.clientWidth) {
        strip.scrollTo({ left: link.offsetLeft - strip.clientWidth / 2 + link.offsetWidth / 2, behavior: reducedMotion.matches ? "auto" : "smooth" });
      }
    };

    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActive(entry.target.id);
      }
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach((s) => io.observe(s));

    // Clear the highlight when scrolled back up into the hero.
    const hero = $(".hero");
    if (hero) {
      new IntersectionObserver(([e]) => { if (e.isIntersecting) setActive(null); }, { rootMargin: "-45% 0px -50% 0px" }).observe(hero);
    }
  }

  /* ------------------------------------------------------------ Syntax highlight */
  const GD_KEYWORDS = new Set("func var const if elif else for in while return extends class_name class and or not match break continue pass signal enum static self super await as is preload true false null".split(" "));
  const SHADER_KEYWORDS = new Set("shader_type render_mode uniform varying flat smooth void return if else for while in out inout const discard true false".split(" "));
  const SHADER_TYPES = new Set("float int uint bool vec2 vec3 vec4 ivec2 ivec3 ivec4 mat2 mat3 mat4 sampler2D sampler2DArray sampler3D samplerCube spatial canvas_item".split(" "));
  const GD_TYPES = new Set("int float bool void".split(" "));

  const escapeHtml = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  function highlight(code, lang) {
    const isShader = lang === "gdshader";
    const re = isShader
      ? /(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*")|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)/g
      : /(#[^\n]*)|("(?:[^"\\\n]|\\.)*")|(@\w+)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)/g;
    let out = "";
    let last = 0;
    let m;
    while ((m = re.exec(code))) {
      out += escapeHtml(code.slice(last, m.index));
      last = re.lastIndex;
      const [tok] = m;
      let cls = "";
      if (m[1]) cls = "c";
      else if (m[2]) cls = "s";
      else if (!isShader && m[3]) cls = "a";
      else if (isShader ? m[3] : m[4]) cls = "n";
      else {
        const next = code.slice(last).match(/^\s*\(/);
        if ((isShader ? SHADER_KEYWORDS : GD_KEYWORDS).has(tok)) cls = "k";
        else if ((isShader ? SHADER_TYPES : GD_TYPES).has(tok) || (/^[A-Z]/.test(tok) && /[a-z]/.test(tok))) cls = "t";
        else if (/^[A-Z][A-Z0-9_]+$/.test(tok)) cls = "a";
        else if (next) cls = "f";
      }
      out += cls ? `<span class="tok-${cls}">${escapeHtml(tok)}</span>` : escapeHtml(tok);
    }
    return out + escapeHtml(code.slice(last));
  }

  function initCode() {
    const run = () => $$("code[data-lang]").forEach((el) => {
      el.innerHTML = highlight(el.textContent, el.dataset.lang);
    });
    if ("requestIdleCallback" in window) requestIdleCallback(run, { timeout: 1500 });
    else setTimeout(run, 200);
  }

  /* ------------------------------------------------------------ YouTube facade */
  function initVideos() {
    const isFile = location.protocol === "file:";
    $$(".video[data-yt-id]").forEach((box) => {
      const id = (box.dataset.ytId || "").trim();
      const title = box.dataset.ytTitle || "Video";
      const btn = $(".video__btn", box);
      const caption = $(".video__caption", box);
      if (!btn) return;

      if (!/^[\w-]{11}$/.test(id)) {
        btn.disabled = true;
        btn.setAttribute("aria-label", `${title} — video coming soon`);
        if (caption) caption.textContent = `${caption.textContent} · coming soon`;
        return;
      }

      const poster = new Image();
      poster.className = "video__poster";
      poster.alt = "";
      poster.loading = "lazy";
      poster.decoding = "async";
      poster.src = `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      box.insertBefore(poster, btn);
      btn.setAttribute("aria-label", `Play video: ${title}`);

      btn.addEventListener("click", () => {
        document.dispatchEvent(new CustomEvent("media:exclusive", { detail: box }));
        // YouTube refuses embeds without a referrer (file://) — open the video instead.
        if (isFile) {
          window.open(`https://www.youtube.com/watch?v=${id}`, "_blank", "noopener");
          return;
        }
        const iframe = document.createElement("iframe");
        iframe.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`;
        iframe.title = title;
        iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
        iframe.allowFullscreen = true;
        iframe.referrerPolicy = "strict-origin-when-cross-origin";
        box.replaceChildren(iframe);
        iframe.focus();
      }, { once: !isFile });
    });
  }

  /* ------------------------------------------------------------ Audio player */
  function initPlayer() {
    const root = $("[data-player]");
    const audio = root && $("[data-audio]", root);
    if (!audio) return;

    const tracks = $$(".track", root);
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
    if (!tracks.length) return;

    let index = 0;
    let loaded = -1;
    let scrubbing = false;
    let raf = 0;

    const fmt = (s) => {
      if (!Number.isFinite(s) || s < 0) return "0:00";
      const m = Math.floor(s / 60);
      return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
    };
    const say = (msg) => { ui.status.textContent = msg; };
    const fallbackDuration = (i) => ($(".track__dur", tracks[i]) || {}).textContent || "0:00";

    function paintProgress() {
      raf = 0;
      if (scrubbing) return;
      const d = audio.duration;
      const pct = Number.isFinite(d) && d > 0 ? audio.currentTime / d : 0;
      ui.seek.value = String(Math.round(pct * 1000));
      ui.seek.style.setProperty("--pct", `${pct * 100}%`);
      ui.current.textContent = fmt(audio.currentTime);
    }
    const schedulePaint = () => { if (!raf) raf = requestAnimationFrame(paintProgress); };

    function select(i) {
      index = (i + tracks.length) % tracks.length;
      const t = tracks[index];
      tracks.forEach((el) => el.removeAttribute("aria-current"));
      t.setAttribute("aria-current", "true");
      ui.title.textContent = t.dataset.title || "";
      ui.ctx.textContent = t.dataset.ctx || "";
      ui.duration.textContent = fallbackDuration(index);
      ui.current.textContent = "0:00";
      ui.seek.value = "0";
      ui.seek.style.setProperty("--pct", "0%");
      setMediaSession(t);
    }

    function load(i) {
      select(i);
      say("");
      ui.seek.disabled = true;
      audio.src = tracks[index].dataset.src;
      loaded = index;
    }

    function play() {
      if (loaded !== index) load(index);
      document.dispatchEvent(new CustomEvent("media:exclusive", { detail: root }));
      const p = audio.play();
      if (p && typeof p.catch === "function") {
        p.catch((err) => {
          if (err && err.name === "NotAllowedError") say("Playback was blocked — press play again.");
        });
      }
    }
    const pause = () => audio.pause();
    const toggle = () => (audio.paused || loaded !== index ? play() : pause());
    const step = (dir) => {
      const wasPlaying = !audio.paused;
      load(index + dir);
      if (wasPlaying) play();
    };

    function setMediaSession(t) {
      if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t.dataset.title || "",
        artist: document.querySelector(".hero__name")?.textContent.trim() || "",
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

    // Controls
    ui.toggle.addEventListener("click", toggle);
    ui.prev.addEventListener("click", () => step(-1));
    ui.next.addEventListener("click", () => step(1));
    root.querySelector(".tracks").addEventListener("click", (e) => {
      const btn = e.target.closest(".track__btn");
      if (!btn) return;
      const i = tracks.indexOf(btn.closest(".track"));
      if (i === index && loaded === index) toggle();
      else { load(i); play(); }
    });

    ui.seek.addEventListener("input", () => {
      scrubbing = true;
      const pct = Number(ui.seek.value) / 1000;
      ui.seek.style.setProperty("--pct", `${pct * 100}%`);
      if (Number.isFinite(audio.duration)) ui.current.textContent = fmt(pct * audio.duration);
    });
    ui.seek.addEventListener("change", () => {
      if (Number.isFinite(audio.duration)) audio.currentTime = (Number(ui.seek.value) / 1000) * audio.duration;
      scrubbing = false;
    });

    // Media events
    audio.addEventListener("play", () => { root.classList.add("is-playing"); ui.toggle.setAttribute("aria-label", "Pause"); });
    audio.addEventListener("pause", () => { root.classList.remove("is-playing"); ui.toggle.setAttribute("aria-label", "Play"); });
    audio.addEventListener("loadedmetadata", () => {
      ui.seek.disabled = false;
      ui.duration.textContent = fmt(audio.duration);
    });
    audio.addEventListener("timeupdate", schedulePaint);
    audio.addEventListener("ended", () => {
      if (index < tracks.length - 1) { load(index + 1); play(); }
      else { audio.currentTime = 0; schedulePaint(); }
    });
    audio.addEventListener("error", () => {
      if (!audio.getAttribute("src")) return;
      const t = tracks[index];
      t.classList.add("is-missing");
      root.classList.remove("is-playing");
      ui.seek.disabled = true;
      say(`"${t.dataset.title}" could not be loaded — add ${t.dataset.src.split("/").pop()} to assets/audio/.`);
    });

    // Only one medium at a time.
    document.addEventListener("media:exclusive", (e) => { if (e.detail !== root) pause(); });

    select(0);
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
  initYear();
  initCode();
})();
