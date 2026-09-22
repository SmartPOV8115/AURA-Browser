const STORAGE_KEY = "aura-browser-v2";

const defaultState = {
  activeWorkspace: "Monkeytype",
  workspaces: {
    Monkeytype: [
      { name: "Google", url: "https://www.google.com", icon: "G" },
      { name: "ChatGPT", url: "https://chatgpt.com", icon: "AI" },
      { name: "GitHub", url: "https://github.com", icon: "GH" },
      { name: "YouTube", url: "https://youtube.com", icon: "▶" },
      { name: "Spotify", url: "https://spotify.com", icon: "●" },
      { name: "WhatsApp", url: "https://web.whatsapp.com", icon: "WA" },
      { name: "Instagram", url: "https://instagram.com", icon: "IG" },
      { name: "Notion", url: "https://notion.so", icon: "N" },
      { name: "Gmail", url: "https://gmail.com", icon: "M" }
    ],
    AURA: [
      { name: "GitHub", url: "https://github.com", icon: "GH" },
      { name: "ChatGPT", url: "https://chatgpt.com", icon: "AI" },
      { name: "Google", url: "https://www.google.com", icon: "G" }
    ],
    Study: [
      { name: "Google", url: "https://www.google.com", icon: "G" },
      { name: "YouTube", url: "https://youtube.com", icon: "▶" },
      { name: "Notion", url: "https://notion.so", icon: "N" }
    ],
    Projects: [
      { name: "GitHub", url: "https://github.com", icon: "GH" },
      { name: "ChatGPT", url: "https://chatgpt.com", icon: "AI" }
    ],
    Media: [
      { name: "YouTube", url: "https://youtube.com", icon: "▶" },
      { name: "Spotify", url: "https://spotify.com", icon: "●" }
    ]
  }
};

let state = loadState();
let tabs = [];
let activeTabId = null;
let contextTarget = null;

const browserHost = document.getElementById("webviews");
const dashboard = document.getElementById("dashboard");
const quickGrid = document.getElementById("quickGrid");
const workspaceList = document.getElementById("workspaceList");
const tabsEl = document.getElementById("tabs");
const urlInput = document.getElementById("urlInput");
const workspaceTitle = document.createElement("span");
const dashWorkspace = document.getElementById("dashWorkspace");
const dashShortcutCount = document.getElementById("dashShortcutCount");
const commandPalette = document.getElementById("commandPalette");
const commandInput = document.getElementById("commandInput");
const shortcutModal = document.getElementById("shortcutModal");
const shortcutName = document.getElementById("shortcutName");
const shortcutUrl = document.getElementById("shortcutUrl");
const contextMenu = document.getElementById("contextMenu");

function loadState() {
  try {
    return { ...defaultState, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function safeName(value) {
  return String(value).replace(/[<>]/g, "").trim().slice(0, 40);
}

function normalizeUrl(raw) {
  let url = raw.trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.includes(".") && !url.includes(" ")) return "https://" + url;
  return "https://www.google.com/search?q=" + encodeURIComponent(url);
}

function currentWorkspaceShortcuts() {
  return state.workspaces[state.activeWorkspace] || [];
}

function renderShortcuts() {
  quickGrid.innerHTML = "";
  currentWorkspaceShortcuts().forEach((shortcut, index) => {
    const btn = document.createElement("button");
    btn.className = "shortcut";
    btn.textContent = shortcut.icon || shortcut.name.slice(0, 2).toUpperCase();
    btn.title = shortcut.name;
    btn.dataset.index = index;

    btn.addEventListener("click", () => openUrl(shortcut.url, shortcut.name));
    btn.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      contextTarget = { type: "shortcut", index };
      contextMenu.style.left = `${event.clientX}px`;
      contextMenu.style.top = `${event.clientY}px`;
      contextMenu.classList.remove("hidden");
    });

    quickGrid.appendChild(btn);
  });

  dashShortcutCount.textContent = `${currentWorkspaceShortcuts().length} shortcuts`;
}

function renderWorkspaces() {
  workspaceList.innerHTML = "";
  Object.keys(state.workspaces).forEach(name => {
    const btn = document.createElement("button");
    btn.className = "workspace" + (name === state.activeWorkspace ? " active" : "");
    btn.dataset.name = name;
    btn.innerHTML = `<span class="ws-icon">◉</span><span>${safeName(name)}</span>`;
    btn.onclick = () => switchWorkspace(name);
    workspaceList.appendChild(btn);
  });

  dashWorkspace.textContent = state.activeWorkspace;
  renderShortcuts();
}

function switchWorkspace(name) {
  state.activeWorkspace = name;
  saveState();
  closeAllTabs();
  showDashboard();
  renderWorkspaces();
}

function closeAllTabs() {
  tabs.forEach(tab => tab.webview.remove());
  tabs = [];
  activeTabId = null;
  renderTabs();
}

function makeTab(title, url) {
  const id = crypto.randomUUID();
  const webview = document.createElement("webview");
  webview.className = "browser-view";
  webview.src = url;
  webview.partition = "persist:aura";
  webview.setAttribute("allowpopups", "");
  webview.dataset.id = id;

  const tab = { id, title: title || "New Tab", url, webview };
  webview.addEventListener("did-navigate", e => updateTab(tab, e.url));
  webview.addEventListener("did-navigate-in-page", e => updateTab(tab, e.url));
  webview.addEventListener("page-title-updated", e => {
    tab.title = e.title || "Untitled";
    renderTabs();
  });

  browserHost.appendChild(webview);
  tabs.push(tab);
  activateTab(id);
}

function updateTab(tab, url) {
  tab.url = url;
  if (activeTabId === tab.id) urlInput.value = url;
  renderTabs();
}

function activateTab(id) {
  activeTabId = id;
  dashboard.style.display = "none";
  tabs.forEach(tab => tab.webview.classList.toggle("visible", tab.id === id));
  const tab = tabs.find(t => t.id === id);
  if (tab) urlInput.value = tab.url;
  renderTabs();
}

function closeTab(id) {
  const index = tabs.findIndex(t => t.id === id);
  if (index === -1) return;
  tabs[index].webview.remove();
  tabs.splice(index, 1);

  if (activeTabId === id) {
    const next = tabs[index] || tabs[index - 1];
    if (next) activateTab(next.id);
    else showDashboard();
  }
  renderTabs();
}

function renderTabs() {
  tabsEl.innerHTML = "";
  tabs.forEach(tab => {
    const el = document.createElement("div");
    el.className = "tab" + (tab.id === activeTabId ? " active" : "");
    el.onclick = () => activateTab(tab.id);

    const title = document.createElement("span");
    title.textContent = tab.title || "New Tab";

    const close = document.createElement("button");
    close.textContent = "×";
    close.className = "tab-close";
    close.onclick = e => {
      e.stopPropagation();
      closeTab(tab.id);
    };

    el.append(title, close);
    tabsEl.appendChild(el);
  });
}

function showDashboard() {
  activeTabId = null;
  tabs.forEach(tab => tab.webview.classList.remove("visible"));
  dashboard.style.display = "flex";
  renderTabs();
}

function openUrl(rawUrl, title) {
  const url = normalizeUrl(rawUrl);
  if (!url) return;

  const same = tabs.find(t => t.url === url);
  if (same) {
    activateTab(same.id);
    return;
  }
  makeTab(title || url.replace(/^https?:\/\//, "").split("/")[0], url);
}

function openCommand() {
  commandPalette.classList.remove("hidden");
  commandInput.focus();
}

function closeCommand() {
  commandPalette.classList.add("hidden");
  commandInput.value = "";
}

function openShortcutModal() {
  shortcutName.value = "";
  shortcutUrl.value = "";
  shortcutModal.classList.remove("hidden");
  shortcutName.focus();
}

function closeShortcutModal() {
  shortcutModal.classList.add("hidden");
}

document.getElementById("backBtn").onclick = () => {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab?.webview.canGoBack()) tab.webview.goBack();
};

document.getElementById("forwardBtn").onclick = () => {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab?.webview.canGoForward()) tab.webview.goForward();
};

document.getElementById("reloadBtn").onclick = () => {
  const tab = tabs.find(t => t.id === activeTabId);
  tab?.webview.reload();
};

document.getElementById("homeBtn").onclick = showDashboard;
document.getElementById("homeDash").onclick = showDashboard;
document.getElementById("newTab").onclick = showDashboard;
document.getElementById("commandBtn").onclick = openCommand;
document.getElementById("dashCommand").onclick = openCommand;
document.getElementById("addShortcutBtn").onclick = openShortcutModal;

urlInput.addEventListener("keydown", e => {
  if (e.key === "Enter") openUrl(urlInput.value);
});

document.getElementById("saveShortcut").onclick = () => {
  const name = safeName(shortcutName.value);
  const url = normalizeUrl(shortcutUrl.value);
  if (!name || !url) return;

  state.workspaces[state.activeWorkspace].push({
    name,
    url,
    icon: name.slice(0, 2).toUpperCase()
  });
  saveState();
  renderShortcuts();
  closeShortcutModal();
};

document.getElementById("cancelShortcut").onclick = closeShortcutModal;

document.querySelectorAll(".overlay").forEach(overlay => {
  overlay.addEventListener("click", e => {
    if (e.target === overlay) {
      overlay.classList.add("hidden");
      contextMenu.classList.add("hidden");
    }
  });
});

document.querySelectorAll("[data-cmd]").forEach(btn => {
  btn.onclick = () => {
    const map = {
      dashboard: null,
      chatgpt: "https://chatgpt.com",
      github: "https://github.com",
      youtube: "https://youtube.com"
    };

    if (btn.dataset.cmd === "dashboard") showDashboard();
    else openUrl(map[btn.dataset.cmd], btn.textContent.trim());

    closeCommand();
  };
});

document.getElementById("newWorkspace").onclick = () => {
  const name = safeName(prompt("Workspace name:"));
  if (!name || state.workspaces[name]) return;
  state.workspaces[name] = [];
  state.activeWorkspace = name;
  saveState();
  closeAllTabs();
  showDashboard();
  renderWorkspaces();
};

contextMenu.addEventListener("click", e => {
  const action = e.target.dataset.action;
  if (!contextTarget || contextTarget.type !== "shortcut") return;

  const shortcuts = currentWorkspaceShortcuts();
  const target = shortcuts[contextTarget.index];
  if (!target) return;

  if (action === "open") {
    openUrl(target.url, target.name);
  } else if (action === "rename") {
    const newName = safeName(prompt("Rename shortcut:", target.name));
    if (newName) {
      target.name = newName;
      target.icon = newName.slice(0, 2).toUpperCase();
      saveState();
      renderShortcuts();
    }
  } else if (action === "move") {
    const destinations = Object.keys(state.workspaces).filter(x => x !== state.activeWorkspace);
    if (!destinations.length) return;
    const destination = prompt(`Move to workspace:\n${destinations.join(", ")}`, destinations[0]);
    if (destination && state.workspaces[destination]) {
      state.workspaces[destination].push(target);
      shortcuts.splice(contextTarget.index, 1);
      saveState();
      renderShortcuts();
    }
  } else if (action === "remove") {
    shortcuts.splice(contextTarget.index, 1);
    saveState();
    renderShortcuts();
  }

  contextMenu.classList.add("hidden");
  contextTarget = null;
});

document.addEventListener("click", e => {
  if (!contextMenu.contains(e.target)) contextMenu.classList.add("hidden");
});

document.getElementById("settingsBtn").onclick = () => {
  alert("Settings layer reserved for the next AURA build.");
};

document.getElementById("minBtn").onclick = () => window.electronAPI?.minimize?.();
document.getElementById("closeBtn").onclick = () => window.close();

document.addEventListener("keydown", e => {
  if (e.ctrlKey && e.code === "Space") {
    e.preventDefault();
    commandPalette.classList.contains("hidden") ? openCommand() : closeCommand();
  }
  if (e.key === "Escape") {
    closeCommand();
    closeShortcutModal();
    contextMenu.classList.add("hidden");
  }
  if (e.ctrlKey && e.key.toLowerCase() === "l") {
    e.preventDefault();
    urlInput.focus();
    urlInput.select();
  }
  if (e.ctrlKey && e.key.toLowerCase() === "t") {
    e.preventDefault();
    showDashboard();
  }
});

const hour = new Date().getHours();
document.getElementById("greeting").textContent =
  hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

renderWorkspaces();