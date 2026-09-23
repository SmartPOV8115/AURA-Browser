const STORAGE_KEY = "aura-browser-v4";

const DEFAULT_SHORTCUTS = {
  Monkeytype: [
    ["Google", "https://www.google.com", "G"],
    ["ChatGPT", "https://chatgpt.com", "AI"],
    ["GitHub", "https://github.com", "GH"],
    ["YouTube", "https://youtube.com", "▶"],
    ["Spotify", "https://spotify.com", "●"],
    ["WhatsApp", "https://web.whatsapp.com", "WA"],
    ["Instagram", "https://instagram.com", "IG"],
    ["Notion", "https://notion.so", "N"],
    ["Gmail", "https://gmail.com", "M"]
  ],
  AURA: [
    ["GitHub", "https://github.com", "GH"],
    ["ChatGPT", "https://chatgpt.com", "AI"],
    ["Google", "https://www.google.com", "G"]
  ],
  Study: [
    ["Google", "https://www.google.com", "G"],
    ["YouTube", "https://youtube.com", "▶"],
    ["Notion", "https://notion.so", "N"]
  ],
  Projects: [
    ["GitHub", "https://github.com", "GH"],
    ["ChatGPT", "https://chatgpt.com", "AI"]
  ],
  Media: [
    ["YouTube", "https://youtube.com", "▶"],
    ["Spotify", "https://spotify.com", "●"]
  ]
};

function defaultState() {
  const workspaces = {};
  for (const [name, items] of Object.entries(DEFAULT_SHORTCUTS)) {
    workspaces[name] = {
      shortcuts: items.map(([n, u, i]) => ({ name: n, url: u, icon: i })),
      tabs: []
    };
  }
  return {
    activeWorkspace: "Monkeytype",
    sidebarCollapsed: false,
    workspaces
  };
}

let state = loadState();
let tabs = [];
let activeTabId = null;

const sidebar = document.getElementById("sidebar");
const browserHost = document.getElementById("webviews");
const dashboard = document.getElementById("dashboard");
const quickGrid = document.getElementById("quickGrid");
const tabList = document.getElementById("tabList");
const workspaceList = document.getElementById("workspaceList");
const urlInput = document.getElementById("urlInput");
const pageTitle = document.getElementById("pageTitle");
const dashWorkspace = document.getElementById("dashWorkspace");
const dashShortcutCount = document.getElementById("dashShortcutCount");
const dashTabCount = document.getElementById("dashTabCount");
const workspaceSubtitle = document.getElementById("workspaceSubtitle");
const commandPalette = document.getElementById("commandPalette");
const commandInput = document.getElementById("commandInput");
const commandResults = document.getElementById("commandResults");
const shortcutModal = document.getElementById("shortcutModal");
const shortcutName = document.getElementById("shortcutName");
const shortcutUrl = document.getElementById("shortcutUrl");
const workspaceModal = document.getElementById("workspaceModal");
const workspaceName = document.getElementById("workspaceName");
const contextMenu = document.getElementById("contextMenu");

function loadState() {
  try {
    const v4 = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (v4?.workspaces) return v4;
    return migrateState();
  } catch {
    return migrateState();
  }
}

function migrateState() {
  const old = localStorage.getItem("aura-browser-v3") || localStorage.getItem("aura-browser-v2");
  const next = defaultState();

  if (!old) return next;

  try {
    const parsed = JSON.parse(old);
    if (parsed.workspaces) {
      for (const [name, value] of Object.entries(parsed.workspaces)) {
        const shortcuts = Array.isArray(value) ? value : (value.shortcuts || []);
        const tabs = Array.isArray(value.tabs) ? value.tabs : [];
        next.workspaces[name] = { shortcuts, tabs };
      }
    }
    next.activeWorkspace = parsed.activeWorkspace || next.activeWorkspace;
    next.sidebarCollapsed = Boolean(parsed.sidebarCollapsed);
  } catch {
    return next;
  }

  return next;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function safeName(v) {
  return String(v ?? "").replace(/[<>]/g, "").trim().slice(0, 40);
}

function normalizeUrl(raw) {
  let url = String(raw ?? "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.includes(".") && !url.includes(" ")) return "https://" + url;
  return "https://www.google.com/search?q=" + encodeURIComponent(url);
}

function workspace() {
  return state.workspaces[state.activeWorkspace];
}

function shortcuts() {
  return workspace()?.shortcuts || [];
}

function currentStoredTabs() {
  return workspace()?.tabs || [];
}

function faviconText(title) {
  const clean = safeName(title);
  if (!clean) return "•";
  const parts = clean.split(/\s+/);
  return parts.length > 1
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : clean.slice(0, 2).toUpperCase();
}

function renderShortcuts() {
  quickGrid.innerHTML = "";

  shortcuts().forEach((item, index) => {
    const btn = document.createElement("button");
    btn.className = "shortcut";
    btn.textContent = item.icon || faviconText(item.name);
    btn.title = item.name;

    btn.onclick = () => openUrl(item.url, item.name);

    btn.addEventListener("contextmenu", e => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, [
        ["Open", () => openUrl(item.url, item.name)],
        ["Rename", () => renameShortcut(index)],
        ["Move to workspace", () => moveShortcut(index)],
        ["Remove", () => removeShortcut(index)]
      ]);
    });

    quickGrid.appendChild(btn);
  });

  dashShortcutCount.textContent = `${shortcuts().length} shortcuts`;
}

function renderTabs() {
  tabList.innerHTML = "";

  tabs.forEach(tab => {
    const row = document.createElement("div");
    row.className = "tab-item" + (tab.id === activeTabId ? " active" : "");
    row.draggable = true;

    const icon = document.createElement("span");
    icon.className = "tab-icon";
    icon.textContent = faviconText(tab.title);

    const title = document.createElement("span");
    title.className = "tab-title";
    title.textContent = tab.title || "New Tab";

    const close = document.createElement("button");
    close.className = "tab-close";
    close.textContent = "×";
    close.onclick = e => {
      e.stopPropagation();
      closeTab(tab.id);
    };

    row.append(icon, title, close);

    row.onclick = () => activateTab(tab.id);

    row.addEventListener("contextmenu", e => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, [
        ["Focus", () => activateTab(tab.id)],
        ["Pin to shortcuts", () => pinShortcut(tab.url, tab.title)],
        ["Close", () => closeTab(tab.id)]
      ]);
    });

    row.addEventListener("dragstart", () => {
      row.dataset.dragId = tab.id;
    });

    row.addEventListener("dragover", e => e.preventDefault());

    row.addEventListener("drop", e => {
      e.preventDefault();
      const fromId = e.dataTransfer.getData("text/plain") || row.dataset.dragId;
      if (!fromId || fromId === tab.id) return;

      const from = tabs.findIndex(t => t.id === fromId);
      const to = tabs.findIndex(t => t.id === tab.id);
      if (from < 0 || to < 0) return;

      const [moved] = tabs.splice(from, 1);
      tabs.splice(to, 0, moved);
      saveCurrentTabs();
      renderTabs();
    });

    row.addEventListener("dragstart", e => {
      e.dataTransfer.setData("text/plain", tab.id);
    });

    tabList.appendChild(row);
  });

  dashTabCount.textContent = `${tabs.length} TAB${tabs.length === 1 ? "" : "S"}`;
}

function renderWorkspaces() {
  workspaceList.innerHTML = "";

  Object.keys(state.workspaces).forEach(name => {
    const btn = document.createElement("button");
    btn.className = "workspace" + (name === state.activeWorkspace ? " active" : "");
    btn.innerHTML = `<span class="workspace-dot"></span><span>${safeName(name)}</span>`;
    btn.onclick = () => switchWorkspace(name);

    btn.addEventListener("contextmenu", e => {
      e.preventDefault();

      const items = [
        ["Switch", () => switchWorkspace(name)],
        ["Rename", () => renameWorkspace(name)]
      ];

      if (Object.keys(state.workspaces).length > 1) {
        items.push(["Delete", () => deleteWorkspace(name)]);
      }

      showContextMenu(e.clientX, e.clientY, items);
    });

    workspaceList.appendChild(btn);
  });

  dashWorkspace.textContent = state.activeWorkspace;
  workspaceSubtitle.textContent = `${state.activeWorkspace} workspace is ready.`;
  renderShortcuts();
  renderTabs();
}

function saveCurrentTabs() {
  if (!workspace()) return;
  workspace().tabs = tabs.map(t => ({
    title: t.title,
    url: t.url
  }));
  saveState();
}

function clearTabs() {
  tabs.forEach(t => t.webview.remove());
  tabs = [];
  activeTabId = null;
  renderTabs();
}

function switchWorkspace(name) {
  if (!state.workspaces[name]) return;

  saveCurrentTabs();
  clearTabs();

  state.activeWorkspace = name;
  saveState();

  renderWorkspaces();
  showDashboard();
  restoreWorkspaceTabs();
}

function restoreWorkspaceTabs() {
  const stored = currentStoredTabs();
  if (!stored.length) {
    showDashboard();
    return;
  }

  stored.slice(0, 10).forEach(item => createTab(item.title, item.url));

  if (tabs.length) activateTab(tabs[0].id);
}

function createTab(title, url) {
  const id = crypto.randomUUID();

  const webview = document.createElement("webview");
  webview.className = "browser-view";
  webview.src = url;
  webview.partition = "persist:aura";
  webview.setAttribute("allowpopups", "");
  webview.dataset.id = id;

  const tab = {
    id,
    title: title || "New Tab",
    url,
    webview
  };

  webview.addEventListener("did-navigate", e => updateTab(tab, e.url));
  webview.addEventListener("did-navigate-in-page", e => updateTab(tab, e.url));

  webview.addEventListener("page-title-updated", e => {
    if (e.title) tab.title = e.title;
    if (activeTabId === tab.id) updatePageChrome(tab);
    renderTabs();
    saveCurrentTabs();
  });

  browserHost.appendChild(webview);
  tabs.push(tab);
  activateTab(id);
}

function updateTab(tab, url) {
  tab.url = url;
  if (tab.id === activeTabId) updatePageChrome(tab);
  renderTabs();
  saveCurrentTabs();
}

function updatePageChrome(tab) {
  pageTitle.textContent = tab.title || "AURA";
  urlInput.value = tab.url || "";
}

function activeTab() {
  return tabs.find(t => t.id === activeTabId);
}

function activateTab(id) {
  activeTabId = id;
  dashboard.style.display = "none";

  tabs.forEach(t => {
    t.webview.classList.toggle("visible", t.id === id);
  });

  const tab = activeTab();
  if (tab) updatePageChrome(tab);
  renderTabs();
}

function closeTab(id) {
  const index = tabs.findIndex(t => t.id === id);
  if (index < 0) return;

  tabs[index].webview.remove();
  tabs.splice(index, 1);

  if (activeTabId === id) {
    const next = tabs[index] || tabs[index - 1];
    if (next) activateTab(next.id);
    else showDashboard();
  }

  saveCurrentTabs();
  renderTabs();
}

function showDashboard() {
  activeTabId = null;
  tabs.forEach(t => t.webview.classList.remove("visible"));
  dashboard.style.display = "flex";
  pageTitle.textContent = "AURA";
  urlInput.value = "";
  renderTabs();
}

function openUrl(raw, title) {
  const url = normalizeUrl(raw);
  if (!url) return;

  const existing = tabs.find(t => t.url === url);
  if (existing) {
    activateTab(existing.id);
    return;
  }

  createTab(title || url.replace(/^https?:\/\//, "").split("/")[0], url);
}

function pinShortcut(url, title) {
  const normalized = normalizeUrl(url);
  if (!normalized) return;
  if (shortcuts().some(s => s.url === normalized)) return;

  shortcuts().push({
    name: safeName(title) || normalized.replace(/^https?:\/\//, "").split("/")[0],
    url: normalized,
    icon: faviconText(title)
  });

  saveState();
  renderShortcuts();
}

function addShortcut() {
  const name = safeName(document.getElementById("shortcutName").value);
  const url = normalizeUrl(document.getElementById("shortcutUrl").value);
  if (!name || !url) return;

  pinShortcut(url, name);
  closeShortcutModal();
}

function renameShortcut(index) {
  const target = shortcuts()[index];
  if (!target) return;

  const name = safeName(prompt("Rename shortcut:", target.name));
  if (!name) return;

  target.name = name;
  target.icon = faviconText(name);
  saveState();
  renderShortcuts();
}

function removeShortcut(index) {
  shortcuts().splice(index, 1);
  saveState();
  renderShortcuts();
}

function moveShortcut(index) {
  const targets = Object.keys(state.workspaces).filter(n => n !== state.activeWorkspace);
  if (!targets.length) return;

  const targetName = prompt(`Move to workspace:\n${targets.join(", ")}`, targets[0]);
  if (!targetName || !state.workspaces[targetName]) return;

  const [item] = shortcuts().splice(index, 1);
  state.workspaces[targetName].shortcuts.push(item);
  saveState();
  renderShortcuts();
}

function renameWorkspace(oldName) {
  const name = safeName(prompt("Rename workspace:", oldName));
  if (!name || name === oldName || state.workspaces[name]) return;

  state.workspaces[name] = state.workspaces[oldName];
  delete state.workspaces[oldName];

  if (state.activeWorkspace === oldName) state.activeWorkspace = name;

  saveState();
  renderWorkspaces();
}

function deleteWorkspace(name) {
  if (Object.keys(state.workspaces).length <= 1) return;
  if (!confirm(`Delete workspace "${name}"?`)) return;

  delete state.workspaces[name];

  if (state.activeWorkspace === name) {
    state.activeWorkspace = Object.keys(state.workspaces)[0];
    clearTabs();
    restoreWorkspaceTabs();
  }

  saveState();
  renderWorkspaces();
}

function toggleSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  sidebar.classList.toggle("collapsed", state.sidebarCollapsed);
  saveState();
}

function showContextMenu(x, y, items) {
  contextMenu.innerHTML = "";

  items.forEach(([label, action]) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.onclick = () => {
      contextMenu.classList.add("hidden");
      action();
    };
    contextMenu.appendChild(b);
  });

  contextMenu.style.left = `${Math.min(x, window.innerWidth - 190)}px`;
  contextMenu.style.top = `${Math.min(y, window.innerHeight - items.length * 38 - 15)}px`;
  contextMenu.classList.remove("hidden");
}

function renderCommandResults(query) {
  const q = query.trim().toLowerCase();

  const items = [
    ["Open dashboard", showDashboard],
    ["New tab", showDashboard],
    ["Pin current page", () => {
      const tab = activeTab();
      if (tab) pinShortcut(tab.url, tab.title);
    }],
    [state.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar", toggleSidebar],
    ["New workspace", openWorkspaceModal],
    ...shortcuts().map(s => [s.name, () => openUrl(s.url, s.name)]),
    ...tabs.map(t => [t.title, () => activateTab(t.id)])
  ];

  commandResults.innerHTML = "";

  items
    .filter(([label]) => !q || label.toLowerCase().includes(q))
    .slice(0, 15)
    .forEach(([label, action]) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.onclick = () => {
        closeCommand();
        action();
      };
      commandResults.appendChild(b);
    });
}

function openCommand() {
  commandPalette.classList.remove("hidden");
  commandInput.value = "";
  renderCommandResults("");
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

function openWorkspaceModal() {
  workspaceName.value = "";
  workspaceModal.classList.remove("hidden");
  workspaceName.focus();
}

function closeWorkspaceModal() {
  workspaceModal.classList.add("hidden");
}

document.getElementById("collapseBtn").onclick = toggleSidebar;
document.getElementById("homeBtn").onclick = showDashboard;
document.getElementById("homeDash").onclick = showDashboard;
document.getElementById("newTab").onclick = showDashboard;
document.getElementById("commandBtn").onclick = openCommand;
document.getElementById("dashCommand").onclick = openCommand;
document.getElementById("addShortcutBtn").onclick = openShortcutModal;
document.getElementById("pinCurrentBtn").onclick = () => {
  const tab = activeTab();
  if (tab) pinShortcut(tab.url, tab.title);
};
document.getElementById("newWorkspace").onclick = openWorkspaceModal;

document.getElementById("focusUrlBtn").onclick = () => {
  urlInput.focus();
  urlInput.select();
};

document.getElementById("backBtn").onclick = () => {
  const tab = activeTab();
  if (tab?.webview.canGoBack()) tab.webview.goBack();
};

document.getElementById("forwardBtn").onclick = () => {
  const tab = activeTab();
  if (tab?.webview.canGoForward()) tab.webview.goForward();
};

document.getElementById("reloadBtn").onclick = () => activeTab()?.webview.reload();

urlInput.addEventListener("keydown", e => {
  if (e.key === "Enter") openUrl(urlInput.value);
});

document.getElementById("saveShortcut").onclick = addShortcut;
document.getElementById("cancelShortcut").onclick = closeShortcutModal;

document.getElementById("saveWorkspace").onclick = () => {
  const name = safeName(workspaceName.value);
  if (!name || state.workspaces[name]) return;

  state.workspaces[name] = { shortcuts: [], tabs: [] };
  state.activeWorkspace = name;

  saveState();
  clearTabs();
  renderWorkspaces();
  closeWorkspaceModal();
  showDashboard();
};

document.getElementById("cancelWorkspace").onclick = closeWorkspaceModal;

commandInput.addEventListener("input", e => {
  renderCommandResults(e.target.value);
});

document.querySelectorAll(".overlay").forEach(overlay => {
  overlay.addEventListener("click", e => {
    if (e.target === overlay) overlay.classList.add("hidden");
  });
});

document.addEventListener("click", e => {
  if (!contextMenu.contains(e.target)) contextMenu.classList.add("hidden");
});

document.addEventListener("keydown", e => {
  if (e.ctrlKey && e.code === "Space") {
    e.preventDefault();
    commandPalette.classList.contains("hidden") ? openCommand() : closeCommand();
  }

  if (e.ctrlKey && e.key.toLowerCase() === "b") {
    e.preventDefault();
    toggleSidebar();
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

  if (e.ctrlKey && e.key.toLowerCase() === "d") {
    e.preventDefault();
    const tab = activeTab();
    if (tab) pinShortcut(tab.url, tab.title);
  }

  if (e.ctrlKey && e.key.toLowerCase() === "w") {
    e.preventDefault();
    const tab = activeTab();
    if (tab) closeTab(tab.id);
  }

  if (e.key === "Escape") {
    closeCommand();
    closeShortcutModal();
    closeWorkspaceModal();
    contextMenu.classList.add("hidden");
  }
});

document.getElementById("settingsBtn").onclick = () => {
  alert("AURA settings layer comes in the core integration build.");
};

document.getElementById("minBtn").onclick = () => window.electronAPI?.minimize?.();
document.getElementById("closeBtn").onclick = () => window.close();

const hour = new Date().getHours();
document.getElementById("greeting").textContent =
  hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

sidebar.classList.toggle("collapsed", Boolean(state.sidebarCollapsed));

renderWorkspaces();
setTimeout(restoreWorkspaceTabs, 120);