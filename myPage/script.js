const filterButtons = document.querySelectorAll(".filter");
const articleGrid = document.querySelector(".article-grid");
const markdownPreview = document.querySelector(".markdown-preview");
const showMoreArticles = document.querySelector(".show-more-articles");
const copyButtons = document.querySelectorAll(".copy-button");
const audio = document.querySelector(".bg-audio");
const playToggle = document.querySelector(".play-toggle");
const volumeToggle = document.querySelector(".volume-toggle");
const restartButton = document.querySelector(".restart-button");
const volumeSlider = document.querySelector(".volume-slider");
const musicPlayer = document.querySelector(".music-player");
const resourceList = document.querySelector(".resource-list");
const showMoreResources = document.querySelector(".show-more-resources");
const maxVolume = 0.75;
const articleListLimit = 4;
let articleCards = [];
let markdownFiles = [];
let selectedArticleCategory = "all";
let isArticleListExpanded = false;

const updateMapParallax = () => {
  document.body.style.setProperty("--map-shift", `${window.scrollY}px`);
};

window.addEventListener("scroll", updateMapParallax, { passive: true });
updateMapParallax();

const categoryLabels = {
  "open-world": "大世界",
  level: "关卡",
  system: "系统",
  narrative: "叙事",
};

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

const getTitle = (fileName) => fileName.replace(/\.md$/i, "");

const getExcerpt = (content) => {
  const cleanContent = stripFrontMatter(content)
    .replace(/^#{1,6}\s+.+$/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleanContent ? `${cleanContent.slice(0, 76)}${cleanContent.length > 76 ? "..." : ""}` : "点击预览这篇 Markdown 文章。";
};

const renderMarkdown = (content) => {
  const lines = stripFrontMatter(content).split(/\r?\n/);
  let html = "";
  let inList = false;

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      return;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    const listItem = trimmed.match(/^[-*+]\s+(.+)$/);

    if (heading) {
      if (inList) {
        html += "</ul>";
        inList = false;
      }

      const level = Math.min(heading[1].length + 1, 4);
      html += `<h${level}>${escapeHtml(heading[2])}</h${level}>`;
      return;
    }

    if (listItem) {
      if (!inList) {
        html += "<ul>";
        inList = true;
      }

      html += `<li>${escapeHtml(listItem[1])}</li>`;
      return;
    }

    if (inList) {
      html += "</ul>";
      inList = false;
    }

    html += `<p>${escapeHtml(trimmed)}</p>`;
  });

  if (inList) {
    html += "</ul>";
  }

  return html;
};

const revealCards = () => {
  articleCards.forEach((card) => card.classList.add("is-visible"));
};

const observeCards = () => {
  if (!("IntersectionObserver" in window)) {
    revealCards();
    return;
  }

  const cardObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add("is-visible");
        cardObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.18 }
  );

  articleCards.forEach((card) => cardObserver.observe(card));
};

const showArticle = async (file) => {
  if (!markdownPreview) return;

  articleCards.forEach((card) => {
    card.classList.toggle("is-active", card.dataset.file === file.url);
  });

  markdownPreview.innerHTML = '<p class="article-empty">正在打开文章...</p>';

  try {
    const response = await fetch(file.url);
    if (!response.ok) throw new Error("文章读取失败");

    const content = await response.text();
    markdownPreview.innerHTML = `
      <div class="markdown-preview-title">
        <span>${categoryLabels[file.category] || file.category}</span>
        <h3>${escapeHtml(file.title)}</h3>
      </div>
      <div class="markdown-body">${renderMarkdown(content)}</div>
    `;
  } catch {
    markdownPreview.innerHTML = '<p class="article-empty">这篇文章暂时无法预览，请确认网页是通过本地服务器打开的。</p>';
  }
};

const renderArticleCards = () => {
  if (!articleGrid) return;

  if (!markdownFiles.length) {
    articleGrid.innerHTML = '<p class="article-empty">md 文件夹里还没有 Markdown 文件。</p>';
    return;
  }

  articleGrid.innerHTML = markdownFiles
    .map(
      (file) => `
        <button class="article-card" type="button" data-category="${file.category}" data-file="${file.url}">
          <span class="article-tag">${categoryLabels[file.category] || file.category}</span>
          <h3>${escapeHtml(file.title)}</h3>
          <p>${escapeHtml(file.excerpt)}</p>
        </button>
      `
    )
    .join("");

  articleCards = Array.from(document.querySelectorAll(".article-card"));
  articleCards.forEach((card) => {
    const file = markdownFiles.find((item) => item.url === card.dataset.file);
    card.addEventListener("click", () => showArticle(file));
  });

  observeCards();
  updateArticleVisibility();
  showArticle(markdownFiles[0]);
};

const updateArticleVisibility = () => {
  const filteredCards = articleCards.filter(
    (card) =>
      selectedArticleCategory === "all" || card.dataset.category === selectedArticleCategory
  );

  articleCards.forEach((card) => {
    const matchesCategory =
      selectedArticleCategory === "all" || card.dataset.category === selectedArticleCategory;
    const filteredIndex = filteredCards.indexOf(card);
    const exceedsLimit = filteredIndex >= articleListLimit;

    card.classList.toggle("is-hidden", !matchesCategory);
    card.classList.toggle("is-collapsed", matchesCategory && !isArticleListExpanded && exceedsLimit);
  });

  if (!showMoreArticles) return;

  const hasMoreArticles = filteredCards.length > articleListLimit;
  showMoreArticles.hidden = !hasMoreArticles;
  showMoreArticles.textContent = isArticleListExpanded ? "收起文章" : "查看更多文章";
};

const loadManifestLinks = async () => {
  const response = await fetch("md/articles.json", { cache: "no-store" });
  if (!response.ok) throw new Error("文章清单读取失败");

  const manifest = await response.json();

  return manifest
    .filter((file) => file.fileName && file.url)
    .map((file) => {
      const url = new URL(file.url, new URL("md/", window.location.href));

      return {
        fileName: file.fileName,
        url: url.href,
      };
    });
};

const loadDirectoryLinks = async () => {
  const directoryResponse = await fetch("md/");
  if (!directoryResponse.ok) throw new Error("目录读取失败");

  const directoryHtml = await directoryResponse.text();
  const directoryDocument = new DOMParser().parseFromString(directoryHtml, "text/html");

  return Array.from(directoryDocument.querySelectorAll("a"))
    .map((link) => decodeURIComponent(link.getAttribute("href") || ""))
    .filter((href) => href.toLowerCase().endsWith(".md"))
    .map((href) => {
      const url = new URL(href, new URL("md/", window.location.href));
      const pathParts = url.pathname.split("/");
      const fileName = decodeURIComponent(pathParts[pathParts.length - 1]);
      return { fileName, url: url.href };
    });
};

const loadMarkdownFiles = async () => {
  if (!articleGrid) return;

  try {
    let links = [];

    try {
      links = await loadManifestLinks();
    } catch {
      links = await loadDirectoryLinks();
    }

    markdownFiles = await Promise.all(
      links.map(async (file) => {
        const response = await fetch(file.url);
        const content = await response.text();
        const category = readMeta(content, "category") || "level";

        return {
          ...file,
          category,
          title: readMeta(content, "title") || getTitle(file.fileName),
          excerpt: readMeta(content, "excerpt") || getExcerpt(content),
        };
      })
    );

    renderArticleCards();
  } catch {
    articleGrid.innerHTML = '<p class="article-empty">请用本地服务器打开网页，页面才能自动读取 md 文件夹。</p>';
  }
};

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedArticleCategory = button.dataset.filter;
    isArticleListExpanded = false;

    filterButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");

    updateArticleVisibility();
  });
});

if (showMoreArticles) {
  showMoreArticles.addEventListener("click", () => {
    isArticleListExpanded = !isArticleListExpanded;
    updateArticleVisibility();
  });
}

loadMarkdownFiles();

copyButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    const originalText = button.textContent;

    try {
      await navigator.clipboard.writeText(button.dataset.copy);
      button.textContent = "已复制";
    } catch {
      button.textContent = "复制失败";
    }

    setTimeout(() => {
      button.textContent = originalText;
    }, 1600);
  });
});

if (resourceList && showMoreResources) {
  showMoreResources.addEventListener("click", () => {
    const isExpanded = resourceList.classList.toggle("is-expanded");
    showMoreResources.textContent = isExpanded ? "收起" : "查看更多";
  });
}

const setPlayIcon = () => {
  if (!audio || !playToggle) return;

  playToggle.innerHTML = audio.paused
    ? '<i class="bi bi-play-fill" aria-hidden="true"></i>'
    : '<i class="bi bi-pause-fill" aria-hidden="true"></i>';
  playToggle.setAttribute("aria-label", audio.paused ? "播放音乐" : "暂停音乐");
  musicPlayer?.classList.toggle("is-playing", !audio.paused);
};

const setVolumeIcon = () => {
  if (!audio || !volumeToggle) return;

  volumeToggle.innerHTML = audio.muted
    ? '<i class="bi bi-volume-mute-fill" aria-hidden="true"></i>'
    : '<i class="bi bi-volume-up-fill" aria-hidden="true"></i>';
  volumeToggle.setAttribute("aria-label", audio.muted ? "取消静音" : "静音");
};

if (audio && playToggle && volumeToggle && restartButton && volumeSlider) {
  audio.volume = Number(volumeSlider.value) / 100;

  const autoplay = audio.play();
  if (autoplay) {
    autoplay.catch(() => {
      setPlayIcon();
    });
  }

  playToggle.addEventListener("click", async () => {
    if (audio.paused) {
      await audio.play();
    } else {
      audio.pause();
    }

    setPlayIcon();
  });

  restartButton.addEventListener("click", async () => {
    audio.currentTime = 0;

    if (audio.paused) {
      await audio.play();
    }

    setPlayIcon();
  });

  volumeToggle.addEventListener("click", () => {
    audio.muted = !audio.muted;
    setVolumeIcon();
  });

  volumeSlider.addEventListener("input", () => {
    audio.volume = Math.min(Number(volumeSlider.value) / 100, maxVolume);

    if (audio.volume > 0 && audio.muted) {
      audio.muted = false;
    }

    setVolumeIcon();
  });

  audio.addEventListener("play", setPlayIcon);
  audio.addEventListener("pause", setPlayIcon);
  setPlayIcon();
  setVolumeIcon();
}
