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

    // A thin band in the middle of the viewport decides which section is "current".
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActive(entry.target.id);
      }
    }, { rootMargin: "-45% 0px -50% 0px" });
    targets.forEach((s) => io.observe(s));
  }

  /* ------------------------------------------------------------ Syntax highlight */
  const GD_KEYWORDS = new Set("func var const if elif else for in while return extends class_name class and or not match break continue pass signal enum static self super await as is preload true false null".split(" "));
  const GD_TYPES = new Set("int float bool void".split(" "));
  const SHADER_KEYWORDS = new Set("shader_type render_mode uniform varying flat smooth void return if else for while in out inout const discard true false".split(" "));
  const SHADER_TYPES = new Set("float int uint bool vec2 vec3 vec4 ivec2 ivec3 ivec4 mat2 mat3 mat4 sampler2D sampler2DArray sampler3D samplerCube spatial canvas_item".split(" "));

  const escapeHtml = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  // Groups: 1 comment · 2 string · 3 annotation (GDScript only) · 4 number · 5 identifier
  const TOKEN_RE = {
    gdscript: /(#[^\n]*)|("(?:[^"\\\n]|\\.)*")|(@\w+)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)/g,
    gdshader: /(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*")|(@\w+)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)/g,
  };

  function highlight(code, lang) {
    const re = TOKEN_RE[lang];
    if (!re) return escapeHtml(code);
    const isShader = lang === "gdshader";
    const keywords = isShader ? SHADER_KEYWORDS : GD_KEYWORDS;
    const types = isShader ? SHADER_TYPES : GD_TYPES;
    re.lastIndex = 0;

    let out = "";
    let last = 0;
    let m;
    while ((m = re.exec(code))) {
      out += escapeHtml(code.slice(last, m.index));
      last = re.lastIndex;
      const tok = m[0];
      let cls = "";
      if (m[1]) cls = "c";
      else if (m[2]) cls = "s";
      else if (m[3]) cls = "a";
      else if (m[4]) cls = "n";
      else if (keywords.has(tok)) cls = "k";
      else if (types.has(tok) || (/^[A-Z]/.test(tok) && /[a-z]/.test(tok))) cls = "t";
      else if (/^[A-Z][A-Z0-9_]+$/.test(tok)) cls = "a";
      else if (/^\s*\(/.test(code.slice(last, last + 8))) cls = "f";
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
        box.classList.add("is-pending");
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

    function paintProgress() {
      raf = 0;
      if (scrubbing) return;
      const d = audio.duration;
      setProgress(Number.isFinite(d) && d > 0 ? audio.currentTime / d : 0);
      ui.current.textContent = fmt(audio.currentTime);
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
      t.classList.add("is-missing");
      $(".track__btn", t).disabled = true;
      console.warn(`[audio] Missing file: ${t.dataset.src}`);
    }

    function refreshAvailability() {
      const anyAvailable = tracks.some((_, i) => isAvailable(i));
      root.classList.toggle("is-empty", !anyAvailable);
      ui.toggle.disabled = !anyAvailable;
      ui.prev.disabled = ui.next.disabled = tracks.filter((_, i) => isAvailable(i)).length < 2;
      if (!anyAvailable) {
        say("Tracks are being mastered — coming soon.");
        ui.title.textContent = "Coming soon";
        ui.ctx.textContent = `${tracks.length} tracks in preparation`;
      } else if (!isAvailable(index) && audio.paused) {
        select(nextAvailable(index, 1, true));
      }
    }

    // Check which files exist (metadata only) and fill in their real durations.
    function probe() {
      if (probed) return;
      probed = true;
      let pending = tracks.length;
      const done = () => { if (--pending === 0) refreshAvailability(); };
      tracks.forEach((t, i) => {
        const a = new Audio();
        a.preload = "metadata";
        a.addEventListener("loadedmetadata", () => {
          if (Number.isFinite(a.duration)) {
            durEl(i).textContent = fmt(a.duration);
            if (i === index) ui.duration.textContent = fmt(a.duration);
          }
          a.removeAttribute("src");
          done();
        }, { once: true });
        a.addEventListener("error", () => { markMissing(i); done(); }, { once: true });
        a.src = t.dataset.src;
      });
    }
    if (hasIO) {
      const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); probe(); } }, { rootMargin: "600px 0px" });
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
      if (Number.isFinite(audio.duration)) ui.current.textContent = fmt(pct * audio.duration);
    });
    ui.seek.addEventListener("change", () => {
      if (Number.isFinite(audio.duration)) audio.currentTime = (Number(ui.seek.value) / 1000) * audio.duration;
      endScrub();
    });
    ["pointerup", "pointercancel", "blur"].forEach((type) => ui.seek.addEventListener(type, endScrub));

    // Media events
    audio.addEventListener("play", () => { root.classList.add("is-playing"); ui.toggle.setAttribute("aria-label", "Pause"); });
    audio.addEventListener("pause", () => { root.classList.remove("is-playing"); ui.toggle.setAttribute("aria-label", "Play"); });
    audio.addEventListener("loadedmetadata", () => {
      ui.seek.disabled = false;
      ui.duration.textContent = fmt(audio.duration);
    });
    audio.addEventListener("timeupdate", schedulePaint);
    audio.addEventListener("ended", () => {
      const i = nextAvailable(index, 1, false);
      if (i >= 0) { load(i); play(); }
      else { audio.currentTime = 0; schedulePaint(); }
    });
    audio.addEventListener("error", () => {
      if (!audio.getAttribute("src")) return;
      const failed = index;
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
