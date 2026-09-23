const STORAGE_KEY = "aura-browser-v3";

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

function makeDefaultState() {
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
let contextTarget = null;

const sidebar = document.getElementById("sidebar");
const browserHost = document.getElementById("webviews");
const dashboard = document.getElementById("dashboard");
const quickGrid = document.getElementById("quickGrid");
const workspaceList = document.getElementById("workspaceList");
const tabsEl = document.getElementById("tabs");
const urlInput = document.getElementById("urlInput");
const dashWorkspace = document.getElementById("dashWorkspace");
const dashShortcutCount = document.getElementById("dashShortcutCount");
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
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved?.workspaces) return migrateOldState();
    return saved;
  } catch {
    return migrateOldState();
  }
}

function migrateOldState() {
  const old = localStorage.getItem("aura-browser-v2");
  if (!old) return makeDefaultState();

  try {
    const parsed = JSON.parse(old);
    const next = makeDefaultState();
    if (parsed.workspaces) {
      for (const [name, shortcuts] of Object.entries(parsed.workspaces)) {
        next.workspaces[name] = {
          shortcuts: Array.isArray(shortcuts) ? shortcuts : [],
          tabs: []
        };
      }
    }
    next.activeWorkspace = parsed.activeWorkspace || "Monkeytype";
    return next;
  } catch {
    return makeDefaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function safeName(value) {
  return String(value ?? "").replace(/[<>]/g, "").trim().slice(0, 40);
}

function normalizeUrl(raw) {
  let url = String(raw ?? "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.includes(".") && !url.includes(" ")) return "https://" + url;
  return "https://www.google.com/search?q=" + encodeURIComponent(url);
}

function currentWorkspace() {
  return state.workspaces[state.activeWorkspace];
}

function currentShortcuts() {
  return currentWorkspace()?.shortcuts ?? [];
}

function currentStoredTabs() {
  return currentWorkspace()?.tabs ?? [];
}

function renderShortcuts() {
  quickGrid.innerHTML = "";

  currentShortcuts().forEach((shortcut, index) => {
    const btn = document.createElement("button");
    btn.className = "shortcut";
    btn.textContent = shortcut.icon || shortcut.name.slice(0, 2).toUpperCase();
    btn.title = shortcut.name;
    btn.draggable = true;
    btn.dataset.index = index;

    btn.onclick = () => openUrl(shortcut.url, shortcut.name);

    btn.addEventListener("contextmenu", event => {
      event.preventDefault();
      showContextMenu(event.clientX, event.clientY, [
        ["Open", () => openUrl(shortcut.url, shortcut.name)],
        ["Rename", () => renameShortcut(index)],
        ["Move to workspace", () => moveShortcut(index)],
        ["Remove", () => removeShortcut(index)]
      ]);
    });

    btn.addEventListener("dragstart", () => {
      contextTarget = { type: "shortcut-drag", index };
      btn.classList.add("dragging");
    });

    btn.addEventListener("dragend", () => {
      btn.classList.remove("dragging");
    });

    btn.addEventListener("dragover", e => e.preventDefault());

    btn.addEventListener("drop", event => {
      event.preventDefault();
      const from = contextTarget?.index;
      if (typeof from !== "number" || from === index) return;
      const list = currentShortcuts();
      const [moved] = list.splice(from, 1);
      list.splice(index, 0, moved);
      saveState();
      renderShortcuts();
      contextTarget = null;
    });

    quickGrid.appendChild(btn);
  });

  dashShortcutCount.textContent = `${currentShortcuts().length} shortcuts`;
}

function renderWorkspaces() {
  workspaceList.innerHTML = "";

  for (const name of Object.keys(state.workspaces)) {
    const btn = document.createElement("button");
    btn.className = "workspace" + (name === state.activeWorkspace ? " active" : "");
    btn.innerHTML = `<span class="ws-icon">◉</span><span>${safeName(name)}</span>`;
    btn.onclick = () => switchWorkspace(name);

    btn.addEventListener("contextmenu", event => {
      event.preventDefault();

      const options = [
        ["Switch", () => switchWorkspace(name)],
        ["Rename", () => renameWorkspace(name)]
      ];

      if (Object.keys(state.workspaces).length > 1) {
        options.push(["Delete", () => deleteWorkspace(name)]);
      }

      showContextMenu(event.clientX, event.clientY, options);
    });

    workspaceList.appendChild(btn);
  }

  dashWorkspace.textContent = state.activeWorkspace;
  renderShortcuts();
}

function saveCurrentTabs() {
  const workspace = currentWorkspace();
  if (!workspace) return;

  workspace.tabs = tabs
    .map(tab => ({
      title: tab.title || "New Tab",
      url: tab.url
    }))
    .filter(tab => tab.url);
}

function switchWorkspace(name) {
  if (!state.workspaces[name]) return;

  saveCurrentTabs();
  state.activeWorkspace = name;
  saveState();

  closeAllTabs(false);
  showDashboard();
  renderWorkspaces();
  restoreWorkspaceTabs();
}

function closeAllTabs(save = true) {
  if (save) saveCurrentTabs();
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
    tab.title = e.title || tab.title || "Untitled";
    renderTabs();
    saveCurrentTabs();
  });

  browserHost.appendChild(webview);
  tabs.push(tab);
  activateTab(id);
}

function updateTab(tab, url) {
  tab.url = url;
  if (activeTabId === tab.id) urlInput.value = url;
  renderTabs();
  saveCurrentTabs();
}

function activateTab(id) {
  activeTabId = id;
  dashboard.style.display = "none";

  tabs.forEach(tab => {
    tab.webview.classList.toggle("visible", tab.id === id);
  });

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

  saveCurrentTabs();
  renderTabs();
}

function renderTabs() {
  tabsEl.innerHTML = "";

  tabs.forEach(tab => {
    const el = document.createElement("div");
    el.className = "tab" + (tab.id === activeTabId ? " active" : "");
    el.onclick = () => activateTab(tab.id);

    el.addEventListener("contextmenu", event => {
      event.preventDefault();
      showContextMenu(event.clientX, event.clientY, [
        ["Focus tab", () => activateTab(tab.id)],
        ["Pin page to sidebar", () => pinShortcut(tab.url, tab.title)],
        ["Close tab", () => closeTab(tab.id)]
      ]);
    });

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

function activeTab() {
  return tabs.find(tab => tab.id === activeTabId);
}

function pinShortcut(url, title) {
  const normalized = normalizeUrl(url);
  if (!normalized) return;

  const exists = currentShortcuts().some(item => item.url === normalized);
  if (exists) {
    renderShortcuts();
    return;
  }

  currentShortcuts().push({
    name: safeName(title) || normalized.replace(/^https?:\/\//, "").split("/")[0],
    url: normalized,
    icon: (safeName(title) || "WEB").slice(0, 2).toUpperCase()
  });

  saveState();
  renderShortcuts();
}

function renameShortcut(index) {
  const target = currentShortcuts()[index];
  if (!target) return;

  const next = safeName(prompt("Rename shortcut:", target.name));
  if (!next) return;

  target.name = next;
  target.icon = next.slice(0, 2).toUpperCase();
  saveState();
  renderShortcuts();
}

function removeShortcut(index) {
  currentShortcuts().splice(index, 1);
  saveState();
  renderShortcuts();
}

function moveShortcut(index) {
  const destinations = Object.keys(state.workspaces).filter(name => name !== state.activeWorkspace);
  if (!destinations.length) return;

  const targetName = prompt(`Move shortcut to:\n${destinations.join(", ")}`, destinations[0]);
  if (!targetName || !state.workspaces[targetName]) return;

  const [item] = currentShortcuts().splice(index, 1);
  state.workspaces[targetName].shortcuts.push(item);
  saveState();
  renderShortcuts();
}

function renameWorkspace(oldName) {
  const next = safeName(prompt("Rename workspace:", oldName));
  if (!next || next === oldName || state.workspaces[next]) return;

  state.workspaces[next] = state.workspaces[oldName];
  delete state.workspaces[oldName];

  if (state.activeWorkspace === oldName) {
    state.activeWorkspace = next;
  }

  saveState();
  renderWorkspaces();
}

function deleteWorkspace(name) {
  if (Object.keys(state.workspaces).length <= 1) return;
  if (!confirm(`Delete workspace "${name}"?`)) return;

  delete state.workspaces[name];

  if (state.activeWorkspace === name) {
    state.activeWorkspace = Object.keys(state.workspaces)[0];
    closeAllTabs(false);
    restoreWorkspaceTabs();
  }

  saveState();
  renderWorkspaces();
}

function showContextMenu(x, y, items) {
  contextMenu.innerHTML = "";

  items.forEach(([label, action]) => {
    const button = document.createElement("button");
    button.textContent = label;
    button.onclick = () => {
      contextMenu.classList.add("hidden");
      action();
    };
    contextMenu.appendChild(button);
  });

  contextMenu.style.left = `${Math.min(x, window.innerWidth - 190)}px`;
  contextMenu.style.top = `${Math.min(y, window.innerHeight - items.length * 38 - 15)}px`;
  contextMenu.classList.remove("hidden");
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

function renderCommandResults(query) {
  const q = query.trim().toLowerCase();
  commandResults.innerHTML = "";

  const actions = [
    ["Open dashboard", showDashboard],
    ["Pin current page", () => {
      const tab = activeTab();
      if (tab) pinShortcut(tab.url, tab.title);
    }],
    [state.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar", toggleSidebar],
    ["New workspace", openWorkspaceModal],
    ...currentShortcuts().map(s => [s.name, () => openUrl(s.url, s.name)])
  ];

  actions
    .filter(([label]) => !q || label.toLowerCase().includes(q))
    .slice(0, 12)
    .forEach(([label, action]) => {
      const button = document.createElement("button");
      button.textContent = label;
      button.onclick = () => {
        closeCommand();
        action();
      };
      commandResults.appendChild(button);
    });
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

function toggleSidebar() {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  sidebar.classList.toggle("collapsed", state.sidebarCollapsed);
  saveState();
}

function restoreWorkspaceTabs() {
  const stored = currentStoredTabs();

  if (!stored.length) {
    showDashboard();
    return;
  }

  stored.slice(0, 8).forEach(tab => makeTab(tab.title, tab.url));
  if (tabs.length) activateTab(tabs[0].id);
}

document.getElementById("collapseBtn").onclick = toggleSidebar;
document.getElementById("backBtn").onclick = () => {
  const tab = activeTab();
  if (tab?.webview.canGoBack()) tab.webview.goBack();
};

document.getElementById("forwardBtn").onclick = () => {
  const tab = activeTab();
  if (tab?.webview.canGoForward()) tab.webview.goForward();
};

document.getElementById("reloadBtn").onclick = () => activeTab()?.webview.reload();
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

urlInput.addEventListener("keydown", e => {
  if (e.key === "Enter") openUrl(urlInput.value);
});

document.getElementById("saveShortcut").onclick = () => {
  const name = safeName(shortcutName.value);
  const url = normalizeUrl(shortcutUrl.value);
  if (!name || !url) return;
  pinShortcut(url, name);
  closeShortcutModal();
};

document.getElementById("cancelShortcut").onclick = closeShortcutModal;

document.getElementById("saveWorkspace").onclick = () => {
  const name = safeName(workspaceName.value);
  if (!name || state.workspaces[name]) return;

  state.workspaces[name] = { shortcuts: [], tabs: [] };
  state.activeWorkspace = name;

  closeWorkspaceModal();
  closeAllTabs(false);
  showDashboard();
  saveState();
  renderWorkspaces();
};

document.getElementById("cancelWorkspace").onclick = closeWorkspaceModal;

document.getElementById("commandInput").addEventListener("input", e => {
  renderCommandResults(e.target.value);
});

document.querySelectorAll(".overlay").forEach(overlay => {
  overlay.addEventListener("click", e => {
    if (e.target === overlay) overlay.classList.add("hidden");
  });
});

document.getElementById("settingsBtn").onclick = () => {
  alert("AURA settings layer is reserved for the core integration build.");
};

document.getElementById("minBtn").onclick = () => window.electronAPI?.minimize?.();
document.getElementById("closeBtn").onclick = () => window.close();

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

  if (e.key === "Escape") {
    closeCommand();
    closeShortcutModal();
    closeWorkspaceModal();
    contextMenu.classList.add("hidden");
  }
});

sidebar.classList.toggle("collapsed", Boolean(state.sidebarCollapsed));

const hour = new Date().getHours();
document.getElementById("greeting").textContent =
  hour < 12 ? "Good Morning" : hour < 18 ? "Good Afternoon" : "Good Evening";

renderWorkspaces();

setTimeout(() => {
  restoreWorkspaceTabs();
}, 150);