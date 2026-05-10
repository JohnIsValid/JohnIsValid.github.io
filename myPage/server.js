const fs = require("fs");
const http = require("http");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT) || 8000;
const host = "127.0.0.1";
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".wav": "audio/wav",
};

const sendDirectory = (targetPath, response) => {
  fs.readdir(targetPath, (error, names) => {
    if (error) {
      response.writeHead(500);
      response.end("Directory read failed");
      return;
    }

    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(
      names
        .map((name) => `<a href="${encodeURIComponent(name)}">${name}</a>`)
        .join("\n")
    );
  });
};

const sendFile = (request, response, targetPath, stats) => {
  const contentType = mimeTypes[path.extname(targetPath)] || "application/octet-stream";
  const range = request.headers.range;

  if (!range) {
    response.writeHead(200, {
      "Accept-Ranges": "bytes",
      "Content-Length": stats.size,
      "Content-Type": contentType,
    });
    fs.createReadStream(targetPath).pipe(response);
    return;
  }

  const rangeMatch = range.match(/^bytes=(\d*)-(\d*)$/);
  if (!rangeMatch) {
    response.writeHead(416, { "Content-Range": `bytes */${stats.size}` });
    response.end();
    return;
  }

  let start = rangeMatch[1] ? Number(rangeMatch[1]) : 0;
  let end = rangeMatch[2] ? Number(rangeMatch[2]) : stats.size - 1;

  if (!rangeMatch[1] && rangeMatch[2]) {
    const suffixLength = Number(rangeMatch[2]);
    start = Math.max(stats.size - suffixLength, 0);
    end = stats.size - 1;
  }

  if (start >= stats.size || end >= stats.size || start > end) {
    response.writeHead(416, { "Content-Range": `bytes */${stats.size}` });
    response.end();
    return;
  }

  response.writeHead(206, {
    "Accept-Ranges": "bytes",
    "Content-Length": end - start + 1,
    "Content-Range": `bytes ${start}-${end}/${stats.size}`,
    "Content-Type": contentType,
  });
  fs.createReadStream(targetPath, { start, end }).pipe(response);
};

const server = http.createServer((request, response) => {
  const requestUrl = new URL(request.url, `http://${host}:${port}`);
  const requestPath = decodeURIComponent(requestUrl.pathname);
  const targetPath = path.join(root, requestPath === "/" ? "index.html" : requestPath);

  if (!targetPath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.stat(targetPath, (error, stats) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    if (stats.isDirectory()) {
      sendDirectory(targetPath, response);
      return;
    }

    sendFile(request, response, targetPath, stats);
  });
});

server.listen(port, host, () => {
  console.log(`Homepage is running at http://${host}:${port}`);
});
