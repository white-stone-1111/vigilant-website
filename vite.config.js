import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";

/**
 * Serve docs pages on extensionless URLs, like a normal site:
 *   /documentation               → documentation/index.html
 *   /documentation/api/reference → documentation/api/reference.html
 * No redirects — the pages use root-absolute asset paths
 * (/documentation/docs.css), so they work on any URL form.
 */
function extensionlessDocsUrls() {
  const handler = (req, res, next) => {
    const url = (req.url || "").split("?")[0].split("#")[0];

    if (url === "/documentation" || url === "/documentation/") {
      req.url = "/documentation/index.html";
    } else if (
      url.startsWith("/documentation/") &&
      !/\.[a-zA-Z0-9]+$/.test(url)
    ) {
      const candidate = path.join(
        process.cwd(),
        url.replace(/\/$/, "") + ".html"
      );
      if (fs.existsSync(candidate)) {
        req.url = url.replace(/\/$/, "") + ".html";
      } else {
        // Missing docs page → real 404 instead of falling through
        // to the root index.html (which looks like the main site).
        res.writeHead(404, { "Content-Type": "text/html" });
        res.end(
          "<!doctype html><title>404</title><h1>404 — docs page not found</h1><p><a href=\"/documentation/\">Back to docs</a></p>"
        );
        return;
      }
    }

    next();
  };

  return {
    name: "extensionless-docs-urls",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

/**
 * Copy the documentation folder into dist/ on build. Vercel serves the
 * build output, so without this /documentation 404s in production even
 * though it works locally.
 */
function copyDocumentation() {
  return {
    name: "copy-documentation",
    closeBundle() {
      const src = path.resolve(__dirname, "documentation");
      const out = path.resolve(__dirname, "dist/documentation");
      fs.cpSync(src, out, { recursive: true });
      console.log("  copied documentation/ → dist/documentation/");
    },
  };
}

export default defineConfig({
  plugins: [extensionlessDocsUrls(), copyDocumentation()],
});
