const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// Load current settings
async function loadSettings() {
  const s = await browserAPI.storage.sync.get({
    backendOrder: ['mymemory', 'google', 'youdao'],
    triggerMode: 'keyboard-only',
    popupDelay: 300,
    fastDirection: 'auto',
    maxTextLength: 5000,
    cacheEnabled: true,
    glossary: {}
  });

  document.getElementById('triggerMode').value = s.triggerMode;
  document.getElementById('popupDelay').value = s.popupDelay;
  document.getElementById('fastDirection').value = s.fastDirection;
  document.getElementById('maxTextLength').value = s.maxTextLength;
  document.getElementById('cacheEnabled').checked = s.cacheEnabled;

  // Toggle delay row visibility
  document.getElementById('delayRow').style.display = s.triggerMode === 'auto' ? '' : 'none';

  // Backend order list
  renderBackendOrder(s.backendOrder);

  // Glossary
  const glossaryText = Object.entries(s.glossary).map(([k, v]) => `${k} = ${v}`).join('\n');
  document.getElementById('glossaryText').value = glossaryText;
}

function renderBackendOrder(order) {
  const list = document.getElementById('backend-order');
  list.innerHTML = '';
  const names = { mymemory: 'MyMemory（免费免Key）', google: 'Google（需VPN/改hosts）', youdao: '有道（API 待修复）' };
  for (const id of order) {
    const li = document.createElement('li');
    li.draggable = true;
    li.dataset.id = id;
    li.textContent = names[id] || id;
    li.addEventListener('dragstart', dragStart);
    li.addEventListener('dragover', dragOver);
    li.addEventListener('drop', drop);
    list.appendChild(li);
  }
}

// Drag and drop for backend order
let dragSrc = null;

function dragStart(e) {
  dragSrc = this;
  e.dataTransfer.effectAllowed = 'move';
}

function dragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  this.classList.add('drag-over');
  this.addEventListener('dragleave', () => this.classList.remove('drag-over'), { once: true });
}

function drop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');
  if (dragSrc !== this) {
    const list = document.getElementById('backend-order');
    const items = [...list.querySelectorAll('li')];
    const srcIdx = items.indexOf(dragSrc);
    const dstIdx = items.indexOf(this);
    if (srcIdx < dstIdx) {
      list.insertBefore(dragSrc, this.nextSibling);
    } else {
      list.insertBefore(dragSrc, this);
    }
  }
}

// Save handlers
document.getElementById('triggerMode').addEventListener('change', function () {
  document.getElementById('delayRow').style.display = this.value === 'auto' ? '' : 'none';
});

document.getElementById('saveAll').addEventListener('click', async () => {
  const backendOrder = [...document.querySelectorAll('#backend-order li')].map(li => li.dataset.id);

  const glossaryText = document.getElementById('glossaryText').value.trim();
  const glossary = {};
  if (glossaryText) {
    for (const line of glossaryText.split('\n')) {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        if (key && val) glossary[key] = val;
      }
    }
  }

  await browserAPI.storage.sync.set({
    backendOrder,
    triggerMode: document.getElementById('triggerMode').value,
    popupDelay: parseInt(document.getElementById('popupDelay').value),
    fastDirection: document.getElementById('fastDirection').value,
    maxTextLength: parseInt(document.getElementById('maxTextLength').value),
    cacheEnabled: document.getElementById('cacheEnabled').checked,
    glossary
  });

  const msg = document.getElementById('savedMsg');
  msg.textContent = '已保存';
  msg.classList.add('show');
  setTimeout(() => msg.classList.remove('show'), 2000);
});

document.getElementById('saveGlossary').addEventListener('click', async () => {
  const glossaryText = document.getElementById('glossaryText').value.trim();
  const glossary = {};
  if (glossaryText) {
    for (const line of glossaryText.split('\n')) {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        if (key && val) glossary[key] = val;
      }
    }
  }
  await browserAPI.storage.sync.set({ glossary });
  const msg = document.getElementById('savedMsg');
  msg.textContent = '术语表已保存';
  msg.classList.add('show');
  setTimeout(() => msg.classList.remove('show'), 2000);
});

// Init
document.addEventListener('DOMContentLoaded', loadSettings);
