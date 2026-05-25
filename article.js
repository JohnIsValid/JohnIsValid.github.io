const articleContainer = document.querySelector(".article-reader");

const escapeHtml = (value) =>
  value.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[char];
  });

const stripFrontMatter = (content) => content.replace(/^---[\s\S]*?---\s*/, "");

const readMeta = (content, key) => {
  const match = content.match(new RegExp(`^${key}:\\s*(.+)$`, "im"));
  return match ? match[1].trim() : "";
};

const getArticleFileName = () => new URLSearchParams(window.location.search).get("file") || "";

const isSafeMarkdownFile = (fileName) =>
  fileName &&
  fileName.toLowerCase().endsWith(".md") &&
  !fileName.includes("/") &&
  !fileName.includes("\\") &&
  !fileName.includes("..");

const getInlineMarkdown = (text) =>
  escapeHtml(text)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

const closeLists = (stack, targetDepth = 0) => {
  let html = "";

  while (stack.length > targetDepth) {
    html += "</ul>";
    stack.pop();
  }

  return html;
};

const renderMarkdown = (markdown) => {
  const lines = stripFrontMatter(markdown).split(/\r?\n/);
  const listStack = [];
  let html = "";

  lines.forEach((line) => {
    if (!line.trim()) {
      html += closeLists(listStack);
      return;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      html += closeLists(listStack);
      const level = Math.min(heading[1].length + 1, 6);
      html += `<h${level}>${getInlineMarkdown(heading[2].trim())}</h${level}>`;
      return;
    }

    const listItem = line.match(/^(\s*)[-*+]\s+(.+)$/);
    if (listItem) {
      const depth = Math.floor(listItem[1].replace(/\t/g, "    ").length / 4) + 1;
      html += closeLists(listStack, depth);

      while (listStack.length < depth) {
        html += "<ul>";
        listStack.push("ul");
      }

      html += `<li>${getInlineMarkdown(listItem[2].trim())}</li>`;
      return;
    }

    html += closeLists(listStack);
    html += `<p>${getInlineMarkdown(line.trim())}</p>`;
  });

  html += closeLists(listStack);
  return html;
};

const renderArticle = (fileName, markdown) => {
  const title = readMeta(markdown, "title") || fileName.replace(/\.md$/i, "");
  document.title = `${title} - 周瀚翔的个人主页`;
  articleContainer.innerHTML = `
    <header class="article-reader-title">
      <p class="eyebrow">Markdown Article</p>
      <h1>${escapeHtml(title)}</h1>
    </header>
    <div class="article-markdown">
      ${renderMarkdown(markdown)}
    </div>
  `;
};

const loadArticle = async () => {
  if (!articleContainer) return;

  const fileName = getArticleFileName();

  if (!isSafeMarkdownFile(fileName)) {
    articleContainer.innerHTML = '<p class="article-reader-status">没有找到要读取的文章。</p>';
    return;
  }

  try {
    const response = await fetch(`md/${encodeURIComponent(fileName)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("文章读取失败");

    renderArticle(fileName, await response.text());
  } catch {
    articleContainer.innerHTML = '<p class="article-reader-status">文章读取失败，请检查 md 文件是否存在。</p>';
  }
};

loadArticle();
