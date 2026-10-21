/* ============================================================
   Endors Docs — shared behavior
   - theme toggle (persisted in localStorage, respects OS pref)
   - copy buttons on code blocks
   - tabs in code groups
   - mobile sidebar drawer
   - TOC scroll-spy
   - hover anchor links on headings
   - tiny regex highlighter for <code class="language-*">
   ============================================================ */

(function () {
  "use strict";

  /* ---------------- Theme ---------------- */

  var root = document.documentElement;

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    try { localStorage.setItem("endors-docs-theme", theme); } catch (e) {}
  }

  document.querySelectorAll(".theme-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var current = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
      applyTheme(current === "dark" ? "light" : "dark");
    });
  });

  /* ---------------- Copy buttons ---------------- */

  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var block = btn.closest(".code-block");
      var code = block && block.querySelector("pre code");
      if (!code) return;
      var text = code.innerText;
      var done = function () {
        btn.classList.add("copied");
        var label = btn.querySelector("span");
        if (label) {
          var prev = label.textContent;
          label.textContent = "Copied";
          setTimeout(function () {
            label.textContent = prev;
            btn.classList.remove("copied");
          }, 1600);
        } else {
          setTimeout(function () { btn.classList.remove("copied"); }, 1600);
        }
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, done);
      } else {
        var ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch (e) {}
        document.body.removeChild(ta);
        done();
      }
    });
  });

  /* ---------------- Code group tabs ---------------- */

  document.querySelectorAll(".code-group").forEach(function (group) {
    var tabs = group.querySelectorAll(".code-tab");
    var panels = group.querySelectorAll(".code-block");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var target = tab.getAttribute("data-tab");
        tabs.forEach(function (t) {
          t.setAttribute("aria-selected", t === tab ? "true" : "false");
        });
        panels.forEach(function (p) {
          p.hidden = p.getAttribute("data-panel") !== target;
        });
      });
    });
  });

  /* ---------------- Mobile sidebar ---------------- */

  var openBtn = document.querySelector(".sidebar-open-btn");
  var backdrop = document.querySelector(".sidebar-backdrop");

  function closeSidebar() {
    document.body.classList.remove("sidebar-open");
  }

  if (openBtn) {
    openBtn.addEventListener("click", function () {
      document.body.classList.toggle("sidebar-open");
    });
  }
  if (backdrop) {
    backdrop.addEventListener("click", closeSidebar);
  }
  document.querySelectorAll(".sidebar-nav a").forEach(function (a) {
    a.addEventListener("click", closeSidebar);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeSidebar();
  });

  /* ---------------- Heading anchors ---------------- */

  document.querySelectorAll(".docs-content h2[id], .docs-content h3[id], .docs-content h4[id]").forEach(function (h) {
    h.classList.add("heading-anchor");
    var a = document.createElement("a");
    a.className = "anchor-link";
    a.href = "#" + h.id;
    a.setAttribute("aria-label", "Link to this section");
    a.textContent = "#";
    h.prepend(a);
  });

  /* ---------------- TOC scroll-spy ---------------- */

  var tocLinks = Array.prototype.slice.call(document.querySelectorAll(".toc-list a"));
  if (tocLinks.length && "IntersectionObserver" in window) {
    var map = {};
    tocLinks.forEach(function (link) {
      var id = link.getAttribute("href").slice(1);
      var el = document.getElementById(id);
      if (el) map[id] = link;
    });
    var visible = new Set();
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      });
      var first = null;
      Object.keys(map).forEach(function (id) {
        if (visible.has(id)) {
          var el = document.getElementById(id);
          if (!first || el.getBoundingClientRect().top < first.getBoundingClientRect().top) {
            first = el;
          }
        }
      });
      tocLinks.forEach(function (l) { l.classList.remove("active"); });
      if (first && map[first.id]) map[first.id].classList.add("active");
    }, { rootMargin: "-10% 0px -75% 0px", threshold: 0 });

    Object.keys(map).forEach(function (id) {
      observer.observe(document.getElementById(id));
    });
  }

  /* ---------------- Tiny syntax highlighter ----------------
     Deliberately minimal: strings, comments, numbers,
     keywords, function calls, object keys. Runs only on
     <code class="language-js|json|bash|http|ts|python">. */

  var KEYWORDS = {
    js: /\b(const|let|var|function|return|await|async|new|import|from|export|if|else|for|while|class|extends|try|catch|throw|typeof|null|undefined|true|false)\b/g,
    ts: /\b(const|let|var|function|return|await|async|new|import|from|export|if|else|for|while|class|extends|try|catch|throw|typeof|null|undefined|true|false|type|interface|string|number|boolean)\b/g,
    python: /\b(def|return|import|from|if|else|elif|for|while|class|try|except|raise|None|True|False|with|as|lambda|print)\b/g,
    json: /\b(true|false|null)\b/g,
    bash: /\b(curl|echo|export|cd|npm|npx|node|git)\b/g,
    http: /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|HTTP)\b/g
  };

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function tok(cls, text) {
    return '<span class="tok-' + cls + '">' + text + "</span>";
  }

  /* Tokenize plain source text and emit HTML in one pass —
     no regex-over-HTML, so spans can never nest or break. */
  function highlight(code, lang) {
    var kw = KEYWORDS[lang] || null;
    var isJson = lang === "json";
    var commentStart = lang === "python" || lang === "bash" ? "#" : "//";
    var re = /("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\/\/[^\n]*|#[^\n]*)|\b(\d[\d_]*(?:\.\d+)?)\b|\b([A-Za-z_$][\w$]*)\b/g;
    var out = "";
    var last = 0;
    var m;
    while ((m = re.exec(code)) !== null) {
      out += esc(code.slice(last, m.index));
      if (m[1] !== undefined) {
        // string — in JSON, promote to a key when followed by a colon
        var s = m[1];
        if (isJson) {
          var rest = code.slice(m.index + s.length);
          if (/^\s*:/.test(rest)) {
            out += tok("p", esc(s));
            last = m.index + s.length;
            continue;
          }
        }
        out += tok("s", esc(s));
      } else if (m[2] !== undefined) {
        // comment — only when this language uses this comment marker
        var c = m[2];
        if (c.charAt(0) === "/" && commentStart !== "//") {
          out += esc(c); // "#" language: a stray // is not a comment
        } else {
          out += tok("c", esc(c));
        }
      } else if (m[3] !== undefined) {
        out += tok("n", esc(m[3]));
      } else if (m[4] !== undefined) {
        var word = m[4];
        var after = code.charAt(m.index + word.length);
        if (kw) kw.lastIndex = 0;
        if (kw && kw.test(word)) {
          out += tok("k", esc(word));
        } else if (after === "(" && !isJson) {
          out += tok("f", esc(word));
        } else {
          out += esc(word);
        }
      }
      last = m.index + m[0].length;
    }
    out += esc(code.slice(last));
    return out;
  }

  document.querySelectorAll('pre code[class*="language-"]').forEach(function (codeEl) {
    var lang = (codeEl.className.match(/language-(\w+)/) || [])[1];
    if (!lang || !(lang in KEYWORDS)) return;
    var raw = codeEl.textContent;
    try {
      codeEl.innerHTML = highlight(raw, lang);
    } catch (e) {
      /* leave plain on any failure */
    }
  });

  /* ---------------- Search box (filter nav) ---------------- */

  var searchInput = document.querySelector(".sidebar-search input");
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      var q = searchInput.value.trim().toLowerCase();
      document.querySelectorAll(".sidebar-nav .nav-item").forEach(function (item) {
        var match = !q || item.textContent.toLowerCase().indexOf(q) !== -1;
        item.style.display = match ? "" : "none";
      });
      document.querySelectorAll(".sidebar-nav .nav-section").forEach(function (section) {
        var anyVisible = Array.prototype.some.call(
          section.querySelectorAll(".nav-item"),
          function (i) { return i.style.display !== "none"; }
        );
        section.style.display = anyVisible ? "" : "none";
      });
    });
    // "/" focuses search
    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && !/^(input|textarea|select)$/i.test(document.activeElement.tagName)) {
        e.preventDefault();
        searchInput.focus();
      }
    });
  }
})();
