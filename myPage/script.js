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
const musicProgress = document.querySelector(".music-progress");
const musicPlayer = document.querySelector(".music-player");
const startupScreen = document.querySelector(".startup-screen");
const musicTip = document.querySelector(".music-tip");
const musicTipCountdown = document.querySelector(".music-tip-countdown");
const musicTipButton = document.querySelector(".music-tip-button");
const resourceList = document.querySelector(".resource-list");
const showMoreResources = document.querySelector(".show-more-resources");
const pageSections = Array.from(document.querySelectorAll(".page-section"));
const pageLinks = Array.from(document.querySelectorAll('.brand, .nav-links a[href^="#"]'));
const pagePrev = document.querySelector(".page-prev");
const pageNext = document.querySelector(".page-next");
const pageDots = document.querySelector(".page-dots");
const maxVolume = 0.75;
const articleListLimit = 4;
let articleCards = [];
let markdownFiles = [];
let selectedArticleCategory = "all";
let isArticleListExpanded = false;
let activePageIndex = 0;

const updateMapParallax = () => {
  document.body.style.setProperty("--map-shift", `${activePageIndex * window.innerHeight}px`);
};

window.addEventListener("resize", updateMapParallax, { passive: true });
updateMapParallax();

const getSectionHash = (section) => {
  if (!section) return "#top";
  return section.id ? `#${section.id}` : "#top";
};

const getPageIndexFromHash = (hash) => {
  if (!hash || hash === "#top") return 0;

  const targetIndex = pageSections.findIndex((section) => getSectionHash(section) === hash);
  return targetIndex >= 0 ? targetIndex : 0;
};

const updatePageDots = () => {
  if (!pageDots) return;

  pageDots.innerHTML = pageSections
    .map((section, index) => {
      const title = section.dataset.pageTitle || `第 ${index + 1} 页`;
      const activeClass = index === activePageIndex ? " is-active" : "";
      return `<button class="page-dot${activeClass}" type="button" data-page-index="${index}" aria-label="${title}"></button>`;
    })
    .join("");

  pageDots.querySelectorAll(".page-dot").forEach((dot) => {
    dot.addEventListener("click", () => {
      showPage(Number(dot.dataset.pageIndex));
    });
  });
};

const updatePageNavigation = () => {
  pageSections.forEach((section, index) => {
    const isActive = index === activePageIndex;
    section.classList.toggle("is-active", isActive);
    section.setAttribute("aria-hidden", isActive ? "false" : "true");
  });

  pageLinks.forEach((link) => {
    link.classList.toggle("is-active", getPageIndexFromHash(link.hash) === activePageIndex);
  });

  if (pagePrev) pagePrev.disabled = activePageIndex === 0;
  if (pageNext) pageNext.disabled = activePageIndex === pageSections.length - 1;

  updatePageDots();
  updateMapParallax();
};

const showPage = (index, shouldUpdateHash = true) => {
  if (!pageSections.length) return;

  activePageIndex = Math.min(Math.max(index, 0), pageSections.length - 1);
  updatePageNavigation();

  if (shouldUpdateHash) {
    const nextHash = getSectionHash(pageSections[activePageIndex]);
    history.replaceState(null, "", nextHash);
  }
};

pageLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    const targetIndex = getPageIndexFromHash(link.hash);
    event.preventDefault();
    showPage(targetIndex);
  });
});

pagePrev?.addEventListener("click", () => showPage(activePageIndex - 1));
pageNext?.addEventListener("click", () => showPage(activePageIndex + 1));

window.addEventListener("keydown", (event) => {
  if (event.defaultPrevented) return;
  if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(document.activeElement?.tagName)) return;

  if (event.key === "ArrowDown" || event.key === "PageDown" || event.key === " ") {
    event.preventDefault();
    showPage(activePageIndex + 1);
  }

  if (event.key === "ArrowUp" || event.key === "PageUp") {
    event.preventDefault();
    showPage(activePageIndex - 1);
  }
});

showPage(getPageIndexFromHash(window.location.hash), false);

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

const hasAudioDuration = () => audio && Number.isFinite(audio.duration) && audio.duration > 0;

const syncMusicProgressDuration = () => {
  if (!musicProgress || !hasAudioDuration()) return;

  musicProgress.max = String(audio.duration);
};

const updateMusicProgress = () => {
  if (!audio || !musicProgress || !hasAudioDuration()) return;

  syncMusicProgressDuration();
  musicProgress.value = String(audio.currentTime);
};

if (audio && playToggle && volumeToggle && restartButton && volumeSlider && musicProgress) {
  audio.volume = Number(volumeSlider.value) / 100;
  audio.load();

  let musicTipRemainingSeconds = 3;
  let musicTipTimer;
  let isMusicTipClosed = false;
  let isSeekingMusic = false;

  const hideMusicTip = () => {
    isMusicTipClosed = true;
    window.clearInterval(musicTipTimer);
    musicTip?.classList.add("is-hidden");
  };

  const updateMusicTipCountdown = () => {
    if (!musicTipCountdown) return;

    musicTipCountdown.textContent = `${musicTipRemainingSeconds}秒`;
  };

  const startMusicTipCountdown = () => {
    if (isMusicTipClosed) return;

    musicTipRemainingSeconds = 3;
    updateMusicTipCountdown();
    musicTip?.classList.remove("is-hidden");

    musicTipTimer = window.setInterval(() => {
      musicTipRemainingSeconds -= 1;
      updateMusicTipCountdown();

      if (musicTipRemainingSeconds <= 0) {
        hideMusicTip();
      }
    }, 1000);
  };

  const playAudio = async () => {
    hideMusicTip();
    await audio.play();
  };

  musicTipButton?.addEventListener("click", hideMusicTip);

  if (startupScreen) {
    startupScreen.addEventListener("animationend", (event) => {
      if (event.target !== startupScreen) return;

      startupScreen.classList.add("is-finished");
      startMusicTipCountdown();
    });
  } else {
    startMusicTipCountdown();
  }

  playToggle.addEventListener("click", async () => {
    if (audio.paused) {
      await playAudio();
    } else {
      audio.pause();
    }

    setPlayIcon();
  });

  restartButton.addEventListener("click", async () => {
    audio.currentTime = 0;
    updateMusicProgress();

    if (audio.paused) {
      await playAudio();
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

  const seekMusic = () => {
    if (!hasAudioDuration()) return;

    audio.currentTime = Math.min(Number(musicProgress.value), audio.duration);
    updateMusicProgress();
  };

  const seekMusicFromPointer = (event) => {
    if (!hasAudioDuration()) return;

    const progressBox = musicProgress.getBoundingClientRect();
    const progressRatio = Math.min(
      Math.max((event.clientX - progressBox.left) / progressBox.width, 0),
      1
    );

    audio.currentTime = progressRatio * audio.duration;
    updateMusicProgress();
  };

  musicProgress.addEventListener("pointerdown", (event) => {
    isSeekingMusic = true;
    musicProgress.setPointerCapture?.(event.pointerId);
    seekMusicFromPointer(event);
  });

  musicProgress.addEventListener("pointermove", (event) => {
    if (!isSeekingMusic) return;

    seekMusicFromPointer(event);
  });

  musicProgress.addEventListener("input", () => {
    isSeekingMusic = true;
    seekMusic();
  });

  musicProgress.addEventListener("change", () => {
    seekMusic();
    isSeekingMusic = false;
  });

  window.addEventListener("pointerup", () => {
    if (!isSeekingMusic) return;
    isSeekingMusic = false;
  });

  window.addEventListener("pointercancel", () => {
    isSeekingMusic = false;
  });

  audio.addEventListener("play", setPlayIcon);
  audio.addEventListener("pause", setPlayIcon);
  audio.addEventListener("ended", setPlayIcon);
  audio.addEventListener("timeupdate", () => {
    if (!isSeekingMusic) {
      updateMusicProgress();
    }
  });
  audio.addEventListener("loadedmetadata", updateMusicProgress);
  audio.addEventListener("durationchange", updateMusicProgress);
  setPlayIcon();
  setVolumeIcon();
  updateMusicProgress();
}
