// Apply all data-i18n translations
document.querySelectorAll('[data-i18n]').forEach(el => {
  const msg = chrome.i18n.getMessage(el.getAttribute('data-i18n'));
  if (msg) el.textContent = msg;
});

// Language codes must match _locales folder names
const LANG_CODES = ['ar','id','zh','en','fr','de','hi','ja','ko','pt','ru','es'];

function detectBrowserLang() {
  const lang = (navigator.language || 'en').slice(0, 2).toLowerCase();
  return LANG_CODES.includes(lang) ? lang : 'en';
}

// Build language select from i18n strings
const langSelect = document.getElementById('distillerLang');
LANG_CODES.sort((a, b) => {
  const la = chrome.i18n.getMessage('lang_' + a);
  const lb = chrome.i18n.getMessage('lang_' + b);
  return la.localeCompare(lb);
}).forEach(code => {
  const opt = document.createElement('option');
  opt.value = code;
  opt.textContent = chrome.i18n.getMessage('lang_' + code);
  langSelect.appendChild(opt);
});

const DEFAULT_PROMPT = chrome.i18n.getMessage('default_prompt');
const DEFAULT_MODEL  = 'gemini-flash-lite-latest';

// Muss mit PROMPT_GENERATION in content.js übereinstimmen. Bei jeder
// Verbesserung des Default-Prompts hochzählen, damit der Hinweis für
// Nutzer mit eigenem Prompt erneut erscheint.
const PROMPT_GENERATION = 4;

// Kuratierte Alias-IDs statt ListModels: die Aliase wandern automatisch zur
// jeweils neuesten Version, und die Rohliste der API enthält TTS-/Bild-/
// Musikmodelle ohne Abschalt-Flag (Entscheidung 2026-07-10).
const MODEL_CHOICES = [
  { id: 'gemini-flash-lite-latest', label: 'Gemini Flash-Lite (gemini-flash-lite-latest)' },
  { id: 'gemini-flash-latest',      label: 'Gemini Flash (gemini-flash-latest)' },
  { id: 'gemini-pro-latest',        label: 'Gemini Pro (gemini-pro-latest)' },
];
const MODEL_CUSTOM = '__custom__';

const apiKeyInput = document.getElementById('apiKey');
const promptInput = document.getElementById('distillerPrompt');
const modelInput  = document.getElementById('distillerModel');
const modelSelect = document.getElementById('distillerModelSelect');

MODEL_CHOICES.forEach(({ id, label }) => {
  const opt = document.createElement('option');
  opt.value = id;
  opt.textContent = label;
  modelSelect.appendChild(opt);
});
const customOpt = document.createElement('option');
customOpt.value = MODEL_CUSTOM;
customOpt.textContent = chrome.i18n.getMessage('opt_model_custom');
modelSelect.appendChild(customOpt);

function setModelUi(model) {
  const known = MODEL_CHOICES.some(c => c.id === model);
  modelSelect.value = known ? model : MODEL_CUSTOM;
  modelInput.style.display = known ? 'none' : 'block';
  if (!known) modelInput.value = model;
}

modelSelect.addEventListener('change', () => {
  const custom = modelSelect.value === MODEL_CUSTOM;
  modelInput.style.display = custom ? 'block' : 'none';
  if (custom) modelInput.focus();
});
const saveBtn     = document.getElementById('saveBtn');
const statusEl    = document.getElementById('status');
const toggleBtn   = document.getElementById('toggleShow');
const resetBtn    = document.getElementById('resetPrompt');

const telemetryCheckbox = document.getElementById('telemetryEnabled');

const promptNotice   = document.getElementById('promptNotice');
const dismissNotice  = document.getElementById('dismissPromptNotice');

dismissNotice.addEventListener('click', () => {
  promptNotice.className = 'notice';
  chrome.storage.sync.set({ promptNoticeSeen: PROMPT_GENERATION });
});

// Load existing values
chrome.storage.sync.get(['geminiApiKey', 'distillerPrompt', 'distillerLang', 'distillerModel', 'telemetryEnabled', 'promptNoticeSeen'], (result) => {
  if (result.geminiApiKey) apiKeyInput.value = result.geminiApiKey;
  promptInput.value = result.distillerPrompt || DEFAULT_PROMPT;
  langSelect.value  = result.distillerLang   || detectBrowserLang();
  setModelUi((result.distillerModel || DEFAULT_MODEL).trim());
  telemetryCheckbox.checked = result.telemetryEnabled !== false; // default: true

  // Eigener Prompt gespeichert → auf den verbesserten Default hinweisen
  const hasCustomPrompt = result.distillerPrompt && result.distillerPrompt.trim() !== DEFAULT_PROMPT.trim();
  if (hasCustomPrompt && result.promptNoticeSeen !== PROMPT_GENERATION) {
    promptNotice.className = 'notice visible';
  }
});

// Toggle show/hide API key
toggleBtn.addEventListener('click', () => {
  if (apiKeyInput.type === 'password') {
    apiKeyInput.type = 'text';
    toggleBtn.textContent = chrome.i18n.getMessage('btn_hide');
  } else {
    apiKeyInput.type = 'password';
    toggleBtn.textContent = chrome.i18n.getMessage('btn_show');
  }
});

// Reset prompt
resetBtn.addEventListener('click', () => {
  promptInput.value = DEFAULT_PROMPT;
});

// Save
saveBtn.addEventListener('click', () => {
  const key    = apiKeyInput.value.trim();
  const prompt = promptInput.value.trim() || DEFAULT_PROMPT;
  const lang   = langSelect.value || detectBrowserLang();
  const model  = modelSelect.value === MODEL_CUSTOM
    ? (modelInput.value.trim() || DEFAULT_MODEL)
    : modelSelect.value;

  if (!key) {
    statusEl.textContent = chrome.i18n.getMessage('msg_no_key');
    statusEl.className = 'status error visible';
    setTimeout(() => { statusEl.className = 'status'; }, 3000);
    return;
  }

  // Den Default-Prompt nicht persistieren: nur ein tatsächlich angepasster
  // Prompt wird gespeichert, sonst friert jeder Save den heutigen Default ein
  // und künftige Prompt-Verbesserungen erreichen den Nutzer nie (v1.5.2-Fix).
  // Save gilt als "aktuelle Generation gesehen": ein danach angepasster
  // Prompt loest den Default-Verbesserungs-Hinweis nicht mehr aus.
  const data = { geminiApiKey: key, distillerLang: lang, distillerModel: model, telemetryEnabled: telemetryCheckbox.checked, promptNoticeSeen: PROMPT_GENERATION };
  if (prompt === DEFAULT_PROMPT.trim()) {
    chrome.storage.sync.remove('distillerPrompt');
  } else {
    data.distillerPrompt = prompt;
  }

  chrome.storage.sync.set(data, () => {
    if (chrome.runtime.lastError) {
      statusEl.textContent = chrome.i18n.getMessage('msg_save_error');
      statusEl.className = 'status error visible';
    } else {
      statusEl.textContent = chrome.i18n.getMessage('msg_saved');
      statusEl.className = 'status visible';
    }
    setTimeout(() => { statusEl.className = 'status'; }, 3000);
  });
});

// --- MOOD & STYLE LISTS ---
// Aus _locales, damit die Listen der Browser-UI-Sprache folgen wie der
// Default-Prompt; Trennzeichen ist in allen Sprachen das einfache Komma.
const DEFAULT_MOODS = chrome.i18n.getMessage('default_moods').split(',').map(s => s.trim());
const DEFAULT_STYLES = chrome.i18n.getMessage('default_styles').split(',').map(s => s.trim());

const moodListArea  = document.getElementById('moodList');
const styleListArea = document.getElementById('styleList');
const resetMoodBtn  = document.getElementById('resetMoodList');
const resetStyleBtn = document.getElementById('resetStyleList');

// Load lists from storage
chrome.storage.local.get(['moodList', 'styleList'], (r) => {
  moodListArea.value  = (r.moodList  || DEFAULT_MOODS).join('\n');
  styleListArea.value = (r.styleList || DEFAULT_STYLES).join('\n');
});

resetMoodBtn.addEventListener('click', () => {
  moodListArea.value = DEFAULT_MOODS.join('\n');
});

resetStyleBtn.addEventListener('click', () => {
  styleListArea.value = DEFAULT_STYLES.join('\n');
});

// Include lists in save — Defaults nicht persistieren (siehe Prompt-Kommentar oben)
saveBtn.addEventListener('click', () => {
  const moodList  = moodListArea.value.split('\n').map(s => s.trim()).filter(Boolean);
  const styleList = styleListArea.value.split('\n').map(s => s.trim()).filter(Boolean);

  if (moodList.join('\n') === DEFAULT_MOODS.join('\n')) {
    chrome.storage.local.remove('moodList');
  } else {
    chrome.storage.local.set({ moodList });
  }
  if (styleList.join('\n') === DEFAULT_STYLES.join('\n')) {
    chrome.storage.local.remove('styleList');
  } else {
    chrome.storage.local.set({ styleList });
  }
});
