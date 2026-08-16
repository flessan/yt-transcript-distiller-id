// --- SCRIPT INITIALIZATION AND GUARDS ---
// This ensures the script doesn't run multiple times on a single page,
// which can happen with YouTube's dynamic navigation.
(function() {
  if (window.hasTranscriptCopier) {
    return;
  }
  window.hasTranscriptCopier = true;

  console.log("YouTube Transcript Copier initializing...");

  // --- SUPPORTED LANGUAGES (alphabetical by English name) ---
  const LANGUAGES = [
    { code: 'ar', label: chrome.i18n.getMessage('lang_ar') },
	{ code: 'id', label: chrome.i18n.getMessage('lang_id') },
    { code: 'zh', label: chrome.i18n.getMessage('lang_zh') },
    { code: 'en', label: chrome.i18n.getMessage('lang_en') },
    { code: 'fr', label: chrome.i18n.getMessage('lang_fr') },
    { code: 'de', label: chrome.i18n.getMessage('lang_de') },
    { code: 'hi', label: chrome.i18n.getMessage('lang_hi') },
    { code: 'ja', label: chrome.i18n.getMessage('lang_ja') },
    { code: 'ko', label: chrome.i18n.getMessage('lang_ko') },
    { code: 'pt', label: chrome.i18n.getMessage('lang_pt') },
    { code: 'ru', label: chrome.i18n.getMessage('lang_ru') },
    { code: 'es', label: chrome.i18n.getMessage('lang_es') },
  ];

  // Detect browser language code, fallback to 'en'
  function detectBrowserLang() {
    const lang = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return LANGUAGES.find(l => l.code === lang) ? lang : 'en';
  }

  // --- ANTWORTSPRACHE ---
  // Bewusst code-seitig und nicht aus _locales: Die Anweisung darf nicht von
  // der Browser-UI-Sprache abhaengen (bisher stand z.B. "Respond exclusively
  // in Englisch." im Request). Eine einzelne Zeile verliert ausserdem gegen
  // ein andersprachiges Transkript; erst die englische Detail-Anweisung plus
  // Wiederholung in der Zielsprache haelt alle 11 Sprachen (Matrix-Test
  // 2026-07-23, Rest-Flakiness bei ja).
  const LANG_NAMES_EN = {
    ar: 'Arabic', id: 'Indonesian', zh: 'Chinese (Simplified)', en: 'English', fr: 'French',
    de: 'German', hi: 'Hindi', ja: 'Japanese', ko: 'Korean',
    pt: 'Portuguese', ru: 'Russian', es: 'Spanish'
  };

  const LANG_INSTR_NATIVE = {
    ar: 'مهم: اكتب الرد بأكمله باللغة العربية فقط. كل سطر، بما في ذلك الكلمة الافتتاحية والملخص وجميع النقاط وجميع الخطوات والجملة الختامية، يجب أن يكون بالعربية. لا تستخدم أبدا لغة النص المفرغ.',
	id: 'PENTING: Tulis seluruh respons hanya dalam bahasa Indonesia. Setiap baris, termasuk kata pembuka, rangkuman, semua poin, semua langkah, dan kalimat penutup, harus menggunakan bahasa Indonesia. Jangan pernah menggunakan bahasa transkrip kecuali bahasa tersebut adalah bahasa Indonesia.',
    zh: '重要提示：请只用简体中文撰写整个回复。每一行，包括开头的引导词、摘要、所有要点、所有步骤和结尾句，都必须是简体中文。绝对不要使用字幕文本的语言。',
    en: 'IMPORTANT: Write the entire response in English only. Every line, including the introductory word, the summary, all bullet points, all steps and the closing sentence, must be in English. Never use the language of the transcript.',
    fr: "IMPORTANT : Rédigez toute la réponse exclusivement en français. Chaque ligne, y compris le mot d'introduction, le résumé, tous les points, toutes les étapes et la phrase finale, doit être en français. N'utilisez jamais la langue de la transcription.",
    de: 'WICHTIG: Schreibe die gesamte Antwort ausschließlich auf Deutsch. Jede Zeile, einschließlich Einleitungswort, Zusammenfassung, aller Punkte, aller Schritte und des Schlusssatzes, muss auf Deutsch sein.',
    hi: 'महत्वपूर्ण: पूरा उत्तर केवल हिंदी में लिखें। हर पंक्ति, जिसमें प्रारंभिक शब्द, सारांश, सभी बिंदु, सभी चरण और अंतिम वाक्य शामिल हैं, हिंदी में होनी चाहिए। ट्रांसक्रिप्ट की भाषा का कभी उपयोग न करें।',
    ja: '重要：回答全体を必ず日本語のみで書いてください。冒頭の導入語、要約、すべての箇条書き、すべての手順、結びの文を含む全行が日本語でなければなりません。文字起こしの言語は決して使わないでください。',
    ko: '중요: 전체 답변을 한국어로만 작성하세요. 첫 안내 단어, 요약, 모든 항목, 모든 단계, 마지막 문장을 포함한 모든 줄이 한국어여야 합니다. 자막 텍스트의 언어는 절대 사용하지 마세요.',
    pt: 'IMPORTANTE: Escreva toda a resposta exclusivamente em português. Cada linha, incluindo a palavra introdutória, o resumo, todos os pontos, todos os passos e a frase final, deve estar em português. Nunca use a língua da transcrição e nunca use espanhol.',
    ru: 'ВАЖНО: Пишите весь ответ только на русском языке. Каждая строка, включая вводное слово, резюме, все пункты, все шаги и заключительное предложение, должна быть на русском. Никогда не используйте язык транскрипта.',
    es: 'IMPORTANTE: Escribe toda la respuesta exclusivamente en español. Cada línea, incluida la palabra introductoria, el resumen, todos los puntos, todos los pasos y la frase final, debe estar en español. Nunca uses el idioma de la transcripción.'
  };

  function buildLangInstruction(langCode) {
    const name = LANG_NAMES_EN[langCode] || 'English';
    const native = LANG_INSTR_NATIVE[langCode] || LANG_INSTR_NATIVE['en'];
    return `IMPORTANT: Write your entire response in ${name}. Every line, including the ` +
      `introductory word, the summary, all bullet points, all steps and the ` +
      `closing sentence, must be in ${name}. Never use the language of the ` +
      `transcript unless it is ${name}.\n${native}`;
  }

  // --- DEFAULT DISTILLER PROMPT ---
  const DEFAULT_DISTILLER_PROMPT = chrome.i18n.getMessage('default_prompt');

  // --- DEFAULT GEMINI MODEL ---
  const DEFAULT_MODEL = 'gemini-flash-lite-latest';

  // --- PLATFORM DETECTION ---
  // m.youtube.com uses a completely different DOM (ytm-* elements) than www.
  const IS_MOBILE = window.location.hostname === 'm.youtube.com';

  // --- LEGACY DEFAULT PROMPT MIGRATION (v1.5.2) ---
  // Bis v1.5.1 hat jeder Save den Feldinhalt persistiert — auch den unver-
  // aenderten Default-Prompt. Damit fror jeder Nutzer den damals aktuellen
  // Default ein und Prompt-Verbesserungen kamen nie an. Hier: SHA-256-Hashes
  // aller frueheren Default-Prompts (v1.3.x und v1.4.0–v1.5.1, alle 11
  // Sprachen, dazu v1.5.2 bis v1.5.4). Ein gespeicherter Prompt, der exakt einem alten Default
  // entspricht, war nie eine bewusste Anpassung und wird entfernt, damit der
  // aktuelle Default greift. Angepasste Prompts bleiben unberuehrt.
  const LEGACY_PROMPT_HASHES = new Set([
    '0c6d0b13b4f405fb982565ff37a3939d44d5d9181e141b36fbb05b7f63d74f44',
    '1f13e4fd2c25888518b84cef84562315cb9e27c90c14c1bdf8140392ea78245a',
    '318a720693dc28e17b71b5719943af457dbe33efa1e8018e7d7106df693217c1',
    '4066489905e16616fe60efeecc9a3bedf56477936a44a73b240efc0e41cda704',
    '420742cd1aee9d5036eaed6667529ad7fc14839b8f5adb6b2fd011520aeef8bd',
    '431256c8a468bf08d04e48df2c3d24400c80b4176fd43b2eb2fb28cd77f4159f',
    '555fef4ec8e3972c32d5a82b9fe281f6d0666793fb65cf76acaa0606315ccc7a',
    '56f809b71bfdf75d56390d56e83a52c40907b7976faf234af90f106dd5744eba',
    '6cdadf6ad95014d18521863531bc5e886f5cf5823963bb64ba61c520e904f4e2',
    '6d2aabd15afb1bf003f537aef60920b4b6fbfe53b1db6dbd5de11fd68eb65a26',
    '8f6d57a80a536dc16a8d71e9bbde6a24f2c8bffc8870ac65ade8d024be9afe16',
    '8fd443181a3bb26313a41fbb3fe2103fe5877e30032be253061d387eb1914be7',
    '926743674547cc9acebdfe8779c86b680d56b214516ef6701abdbf9fc76044b5',
    '9ba229739acd9a79609b9fefdc37eeec393437f00b164e185720f99d3c45e23b',
    'a257630dc5e1ec69346e58173cc4264e639f28c59307d33da9f035cc3151baa0',
    'b78aab05ada81cc718efebc5532ac68c8023ee9e6d862d63fb13809fc8c4c333',
    'b988db75f047109dbb4d88dd5a634761d6afd3275a434518e32722e817768142',
    'beea8b621b86843ab2e0683d684b1199f71929e69eae1e51caae2e75c11dcec8',
    'c293f336914b8839ea11a431429be2ea850f54882fa9069916c0fed99ef29ca8',
    'e1013b0fd670765f9fdd8120b312792de59ec12a24d4cc16259d6122801c58b5',
    'e123cc7d6e303e7b89fabe26b18074fe0aee48fee96ea9c1419796bcae2c32ca',
    'ef95d84d928c64f3877de8a46948a6f2d99df5fec73e7f4040622b6eaac2df1a',
    // Defaults v1.5.2 bis v1.5.4 (Generation 3), abgeloest durch die
    // Zeichenregel (kein Geviertstrich etc.) in Generation 4:
    '3443294a6fb4a057210d381b87b0cdf09a3b644a530c50706f8bad2871b51ac1',
    '77fe70fe2ad785dab3d4b9f57ac347de3406812c810403ed398654b32ba901b7',
    '8adccb91c8727eb83d29e6278693f713c54d54cedef35a7084a6ee250d6b2a81',
    '9f28cf10f5ef62e869b1bf886a6f845df7630c943159466527cfe5659d860b67',
    'c2ea01ea0349830043e3250d2846dab78a330828322c18a4b7fbeb7eeaf0d72a',
    'cd57b6306fbd9a36acf2238fedf093d038df3ecd490392d1c6547c4bf028d22b',
    'e6b5cadde760c7be91dc5e487c3bc2bcce3181795d94394269ecba25db7a0259',
    'ea86f9ea351b90a37bc418cdcec69bcf21f687fbb3bf1866c8e02e59245b918e',
    'f0081d148a5246d009920140f6e86c72be7520bab1c8470b2b5c1b7954f960d4',
    'fb650d4b831fca3585bf2b5acbd7c9888aa27acad13a172dcebc6e8bc02f6386',
    'ffd65f540a6a9e1b396cf17a3149ee858f2a6809cd988b0b11632c6f6f5d5bba',
  ]);

  // Muss mit PROMPT_GENERATION in options.js übereinstimmen. Bei jeder
  // Verbesserung des Default-Prompts hochzählen, damit der Hinweis für
  // Nutzer mit eigenem Prompt erneut erscheint.
  const PROMPT_GENERATION = 4;

  async function sha256Hex(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function migrateLegacyDefaultPrompt() {
    try {
      const r = await new Promise(res => chrome.storage.sync.get(['distillerPrompt'], res));
      if (!r.distillerPrompt) return;
      const hash = await sha256Hex(r.distillerPrompt.trim());
      if (LEGACY_PROMPT_HASHES.has(hash)) {
        chrome.storage.sync.remove('distillerPrompt');
        console.log('[Transcript Distiller] Alter Default-Prompt erkannt — auf aktuellen Default migriert.');
      }
    } catch (e) {
      console.warn('[Transcript Distiller] Prompt-Migration fehlgeschlagen:', e);
    }
  }
  migrateLegacyDefaultPrompt();

  // --- PAGE-CONTEXT PLAYER ACCESS ---
  // Firefox content scripts see the page through Xray vision; wrappedJSObject
  // exposes the real #movie_player element with its API (getVideoData,
  // getAudioTrack, getPlayerResponse). Identical on www and m.youtube.com.
  function getPagePlayer() {
    try {
      const player = window.wrappedJSObject.document.getElementById('movie_player');
      if (player && typeof player.getVideoData === 'function') return player;
    } catch (e) {
      console.warn('[Transcript Debug] wrappedJSObject player access failed:', e);
    }
    return null;
  }

  // --- DEFAULT RANDOM LISTS ---
  // Aus _locales, damit die Listen der Browser-UI-Sprache folgen wie der
  // Default-Prompt; Trennzeichen ist in allen Sprachen das einfache Komma.
  const DEFAULT_MOODS = chrome.i18n.getMessage('default_moods').split(',').map(s => s.trim());
  const DEFAULT_STYLES = chrome.i18n.getMessage('default_styles').split(',').map(s => s.trim());

  // --- DOM EXTRACTION HELPERS ---
  function getVideoTitle() {
    const el = document.querySelector('h1.ytd-video-primary-info-renderer, h1.style-scope.ytd-watch-metadata, ytd-watch-metadata h1');
    if (el) return el.textContent.trim();
    try {
      const vd = getPagePlayer()?.getVideoData();
      if (vd && vd.title) return String(vd.title).trim();
    } catch (e) { /* Player nicht bereit */ }
    return '';
  }

  function getChannelName() {
    const el = document.querySelector(
      'ytd-channel-name yt-formatted-string, #channel-name yt-formatted-string, #owner #channel-name a'
    );
    if (el) return el.textContent.trim();
    try {
      const vd = getPagePlayer()?.getVideoData();
      if (vd && vd.author) return String(vd.author).trim();
    } catch (e) { /* Player nicht bereit */ }
    return '';
  }

  // --- TEMPLATE REPLACEMENT ---
  async function applyTemplates(prompt) {
    // Load custom lists from storage
    const stored = await new Promise(resolve => {
      chrome.storage.local.get(['moodList', 'styleList'], resolve);
    });

    const moodList  = (stored.moodList  && stored.moodList.length)  ? stored.moodList  : DEFAULT_MOODS;
    const styleList = (stored.styleList && stored.styleList.length)  ? stored.styleList : DEFAULT_STYLES;

    const mood    = moodList[Math.floor(Math.random() * moodList.length)];
    const style   = styleList[Math.floor(Math.random() * styleList.length)];
    const title   = getVideoTitle();
    const creator = getChannelName();
    const date    = new Date().toLocaleDateString();
    const version = chrome.runtime.getManifest().version;

    return prompt
      .replace(/\{mood\}/g,    mood)
      .replace(/\{style\}/g,   style)
      .replace(/\{title\}/g,   title)
      .replace(/\{creator\}/g, creator)
      .replace(/\{date\}/g,    date)
      .replace(/\{version\}/g, version);
  }

  // --- DEFAULT SETTINGS ---
  const defaultSettings = {
    includeTitle: true,
    includeUrl: true,
    includeTimestamps: true,
    useParagraphs: false,
    theme: 'dark',
  };

  // --- ROBUSTNESS VARIABLES ---
  let observer = null;
  let retryCount = 0;
  const MAX_RETRIES = 5; // Increased from 3
  let lastUrl = window.location.href;
  let isInjected = false;
  let injectionAttempts = 0;
  let urlChangeTimeout = null;
  // Verhindert parallele injectButton()-Läufe: auf m.youtube.com wartet
  // waitForElement sekundenlang, währenddessen starten Retry-Timer, Mutation-
  // Observer und visibilitychange weitere Läufe — jeder fügt dann einen
  // eigenen Button ein (v1.5.0/1.5.1-Bug am Handy).
  let injectionInProgress = false;

  // --- ADBLOCKER RESISTANCE STRATEGIES ---
  
  // Generate randomized class names to avoid detection
  function generateRandomClass() {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Use randomized IDs and classes
  const randomContainerId = `yt-${generateRandomClass()}`;
  const randomButtonClass = `btn-${generateRandomClass()}`;
  const randomCopyBtnId = `copy-${generateRandomClass()}`;
  const randomSettingsBtnId = `settings-${generateRandomClass()}`;

  // --- ENHANCED URL CHANGE DETECTION ---
  function detectUrlChange() {
	  const currentUrl = window.location.href;
	  if (lastUrl !== currentUrl) {
		console.log("YouTube Transcript Copier: URL changed, cleaning up and reinitializing...");
		lastUrl = currentUrl;
		
		// Clean up existing button and observers
		const existingContainer = document.getElementById(randomContainerId);
		if (existingContainer) {
		  existingContainer.remove();
		}
		
		// Disconnect protection observer
		if (window.transcriptProtectionObserver) {
		  window.transcriptProtectionObserver.disconnect();
		  window.transcriptProtectionObserver = null;
		}
		
		// Reset state
		isInjected = false;
		retryCount = 0;
		injectionAttempts = 0;
		
		// Clear any existing timeout
		if (urlChangeTimeout) {
		  clearTimeout(urlChangeTimeout);
		}
		
		// Use progressive delays for better reliability
		urlChangeTimeout = setTimeout(() => {
		  initializeExtension();
		}, 1000); // Slightly increased delay
	  }
	}

  // --- BETTER TARGET DETECTION ---
  function findTargetContainer() {
    // Multiple selectors to try, combining Old and New UI injection points.
    // m.youtube.com renders a completely different component tree (ytm-*).
    // Mobile Tags gegen das echte MWEB-DOM verifiziert (headless, 2026-07-11);
    // ytm-slim-owner-renderer existiert dort nicht mehr.
    const selectors = IS_MOBILE ? [
      'ytm-slim-video-action-bar-renderer',
      'ytm-slim-video-metadata-section-renderer',
      'ytm-slim-video-information-renderer'
    ] : [
      '#owner #subscribe-button',
      '#subscribe-button',
      'ytd-subscribe-button-renderer',
      '[aria-label*="Subscribe"]',
      '#owner .ytd-video-owner-renderer',
      '#owner',
      '#menu-container ytd-menu-renderer', // Old UI action menu fallback
      '#top-level-buttons-computed'        // Old UI like/dislike row fallback
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        console.log(`YouTube Transcript Copier: Found target using selector: ${selector}`);
        return element;
      }
    }
    
    return null;
  }

  // --- WAIT FOR ELEMENT WITH TIMEOUT ---
  // --- WAIT FOR ELEMENT WITH TIMEOUT ---
  function waitForElement(selector, timeout = 4000) {
    return new Promise((resolve) => {
      const existingElement = document.querySelector(selector);
      if (existingElement) return resolve(existingElement);

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  async function scrapeTranscriptFromDOM() {
    console.log("[Transcript Debug] Starting DOM scrape fallback...");
    
    // 1. Expand the description if the button is hidden inside it
    const expander = document.querySelector('tp-yt-paper-button#expand, #expand-theme, #description-inline-expander');
    if (expander && expander.offsetParent !== null) {
      console.log("[Transcript Debug] Clicking description expander...");
      expander.click();
      await new Promise(r => setTimeout(r, 400));
    }

    // 2. Find and click the "Show transcript" button (Combined Old & New selectors)
    const buttonSelectors = [
      'button[aria-label*="show transcript" i]',
      'ytd-video-description-transcript-section-renderer button',
      '#primary-button button'
    ];
    
    let targetButton = null;
    for (const sel of buttonSelectors) {
      targetButton = document.querySelector(sel);
      if (targetButton && targetButton.offsetParent !== null) break;
    }

    if (targetButton) {
      console.log("[Transcript Debug] Found transcript button, clicking it...");
      targetButton.click();
    } else {
      console.error("[Transcript Debug] Could not find 'Show transcript' button.");
      return null;
    }

    console.log("[Transcript Debug] Waiting for transcript segments to load...");
    const segmentSelector = 'ytd-transcript-segment-renderer, transcript-segment-view-model';
    const found = await waitForElement(segmentSelector, 10000); 
    
    if (!found) {
      console.error(`[Transcript Debug] Timeout! '${segmentSelector}' never appeared.`);
      return null;
    }

    console.log("[Transcript Debug] Segments found. Beginning scroll-and-scrape...");

    const segmentsMap = new Map(); 
    
    // Find the actual scrollable window inside the panel
    const scrollContainer = document.querySelector('ytd-engagement-panel-section-list-renderer[visibility="ENGAGEMENT_PANEL_VISIBILITY_EXPANDED"] #content') 
                            || document.querySelector('ytd-engagement-panel-section-list-renderer[target-id*="transcript" i] #content')
                            || document.querySelector(segmentSelector).closest('#content, #contents');

    let unchangedCount = 0;
    let lastCount = 0;

    // 3. Loop to continuously scroll and scrape
    for (let i = 0; i < 150; i++) { 
        const currentSegments = document.querySelectorAll(segmentSelector);
        
        currentSegments.forEach(seg => {
            // Combined Old & New timestamp selectors
            let timestamp = seg.querySelector('.segment-timestamp, [class*="Timestamp"]')?.textContent?.trim() || "";
            
            let text = "";
            // Combined Old & New text formatting selectors
            const textSpan = seg.querySelector('.yt-core-attributed-string, .segment-text, yt-formatted-string');
            if (textSpan) {
                text = textSpan.textContent.trim();
            } else {
                // Fallback for transitional UIs
                const spans = Array.from(seg.querySelectorAll('span')).filter(s => 
                    !s.className.includes('Timestamp') && !s.className.includes('A11yLabel')
                );
                text = spans.map(s => s.textContent).join(' ').trim();
            }

            if (text) {
                segmentsMap.set(timestamp + text, { timestamp, text });
            }
        });

        // Trigger the scroll to load the next batch of DOM elements
        if (scrollContainer) {
            scrollContainer.scrollBy(0, 800);
        } else {
            currentSegments[currentSegments.length - 1].scrollIntoView({ block: 'end' });
        }

        await new Promise(r => setTimeout(r, 250)); 

        if (segmentsMap.size === lastCount) {
            unchangedCount++;
            if (unchangedCount >= 4) break; 
        } else {
            unchangedCount = 0;
        }
        lastCount = segmentsMap.size;
    }

    console.log(`[Transcript Debug] Scrape complete. Found ${segmentsMap.size} unique lines.`);

    // 4. Return formatted data
    return Array.from(segmentsMap.values()).map(data => {
        return {
            transcriptSegmentRenderer: {
                startTimeText: { simpleText: data.timestamp },
                snippet: { runs: [{ text: data.text }] }
            }
        };
    });
  }
  
  function applyThemeToUI(theme) {
    // Auto-detect from YouTube's own dark/light mode if not explicitly passed
    if (!theme) {
      const ytDark = document.documentElement.getAttribute('dark') !== null
                  || document.querySelector('html[dark]') !== null
                  || window.matchMedia('(prefers-color-scheme: dark)').matches;
      theme = ytDark ? 'dark' : 'light';
    }
    const container = document.getElementById(randomContainerId);
    if (container) container.setAttribute('data-theme', theme);

    const modal = document.querySelector('.modal-content-transcript');
    if (modal) modal.setAttribute('data-theme', theme);
  }

  // --- ADBLOCKER-RESISTANT STYLING ---
  function createResistantStyles() {
    const existingStyle = document.getElementById('yt-transcript-styles');
    if (existingStyle) {
      existingStyle.remove();
    }

    const style = document.createElement('style');
    style.id = 'yt-transcript-styles';
    style.textContent = `
      /* Theme Variables - Defaults to Dark */
      #${randomContainerId}[data-theme="dark"] .${randomButtonClass},
      .modal-content-transcript[data-theme="dark"] {
        --yt-trans-bg: rgba(255, 255, 255, 0.1);
        --yt-trans-bg-hover: rgba(255, 255, 255, 0.2);
        --yt-trans-text: #f1f1f1;
        --yt-trans-border: rgba(255, 255, 255, 0.2);
        --yt-trans-modal-bg: #212121;
        --yt-trans-icon: #f1f1f1;
      }

      #${randomContainerId}[data-theme="light"] .${randomButtonClass},
      .modal-content-transcript[data-theme="light"] {
        --yt-trans-bg: rgba(0, 0, 0, 0.05);
        --yt-trans-bg-hover: rgba(0, 0, 0, 0.1);
        --yt-trans-text: #0f0f0f;
        --yt-trans-border: rgba(0, 0, 0, 0.1);
        --yt-trans-modal-bg: #ffffff;
        --yt-trans-icon: #0f0f0f;
      }

      #${randomContainerId} {
        display: flex;
        margin-left: 8px;
        align-items: center;
        position: relative;
        z-index: 1;
      }
      
      .${randomButtonClass} {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 36px;
        padding: 0 16px;
        font-size: 14px;
        font-weight: 500;
        font-family: "Roboto", "Arial", sans-serif;
        border: none;
        cursor: pointer;
        background-color: var(--yt-trans-bg, rgba(255, 255, 255, 0.1));
        color: var(--yt-trans-text, #f1f1f1);
        transition: background-color .3s;
        outline: none;
        text-decoration: none;
        user-select: none;
      }
      
      .${randomButtonClass}:hover {
        background-color: var(--yt-trans-bg-hover, rgba(255, 255, 255, 0.2));
      }
      
      #${randomCopyBtnId} {
        border-radius: 18px 0 0 18px;
        padding-right: 12px;
      }
      
      #${randomSettingsBtnId} {
        border-radius: 0 18px 18px 0;
        padding: 0 10px;
        border-left: 1px solid var(--yt-trans-border, rgba(255, 255, 255, 0.2));
      }
      
      #${randomSettingsBtnId} svg {
        width: 20px;
        height: 20px;
        fill: var(--yt-trans-icon, #f1f1f1);
      }
      
      .modal-overlay-transcript {
        position: fixed;
        inset: 0;
        background-color: rgba(0, 0, 0, 0.6);
        z-index: 2500;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      
      .modal-content-transcript {
        background-color: var(--yt-trans-modal-bg, #212121);
        color: var(--yt-trans-text, #f1f1f1);
        padding: 24px;
        border-radius: 12px;
        width: 90%;
        max-width: 450px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        font-family: "Roboto", "Arial", sans-serif;
      }
      
      .modal-content-transcript h2 {
        margin-top: 0;
        margin-bottom: 24px;
        font-size: 20px;
      }
      
      .setting-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
        min-height: 24px;
      }
      
      .setting-item label {
        font-size: 16px;
        padding-right: 16px;
      }
      
      .custom-toggle {
        appearance: none;
        width: 40px;
        height: 20px;
        background-color: #ccc;
        border-radius: 10px;
        position: relative;
        cursor: pointer;
        transition: background-color 0.2s ease-in-out;
      }
      
      .custom-toggle::before {
        content: '';
        position: absolute;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background-color: white;
        top: 2px;
        left: 2px;
        transition: transform 0.2s ease-in-out;
      }
      
      .custom-toggle:checked {
        background-color: #3ea6ff;
      }
      
      .custom-toggle:checked::before {
        transform: translateX(20px);
      }
    `;
    document.head.appendChild(style);
  }

  // --- CORE UI INJECTION WITH ENHANCED RELIABILITY ---
  async function injectButton() {
    // Läuft bereits eine Injektion (waitForElement kann Sekunden dauern),
    // keinen zweiten Lauf starten — sonst entstehen mehrere Buttons.
    if (injectionInProgress) {
      return false;
    }
    injectionInProgress = true;
    try {
      injectionAttempts++;
      console.log(`YouTube Transcript Copier: Injection attempt ${injectionAttempts}`);

      // Check if our button is already on the page
      if (document.getElementById(randomContainerId)) {
        console.log("YouTube Transcript Copier: Button already exists");
        isInjected = true;
        return true;
      }

      // Wait for the target container to be available
      console.log("YouTube Transcript Copier: Waiting for target container...");
      // ytm-slim-video-action-bar-renderer existiert im echten MWEB-DOM
      // (verifiziert 2026-07-11); ytm-slim-owner-renderer gibt es dort nicht.
      const primarySelector = IS_MOBILE ? 'ytm-slim-video-action-bar-renderer' : '#owner #subscribe-button';
      const targetContainer = await waitForElement(primarySelector, 8000);

      // If the element wasn't found by the specific selector, try the alternatives
      if (!targetContainer) {
        console.log("YouTube Transcript Copier: Target container not found, trying alternative selectors");
        const altTarget = findTargetContainer();
        if (!altTarget) {
          console.log("YouTube Transcript Copier: No suitable target found");
          return false;
        }
        return await injectIntoTarget(altTarget);
      }

      return await injectIntoTarget(targetContainer);
    } finally {
      injectionInProgress = false;
    }
  }

  async function injectIntoTarget(targetContainer) {
    // Safety Guard: Ensure target and its parent exist before proceeding
    if (!targetContainer || !targetContainer.parentNode) {
      console.log("YouTube Transcript Copier: Target or parent missing, skipping injection");
      return false;
    }
    // Doppelter Boden gegen Duplikate: existiert der Button inzwischen, nichts einfügen
    if (document.getElementById(randomContainerId)) {
      isInjected = true;
      return true;
    }
    try {
      // Create styles first
      createResistantStyles();

      // Create the main container with randomized ID
      const container = document.createElement('div');
      container.id = randomContainerId;
      
      getSettings().then(() => {
        applyThemeToUI();
      });

      // Add attributes that make it look like a legitimate YouTube component
      container.setAttribute('data-yt-extension', 'transcript-copier');
      container.setAttribute('role', 'group');
      container.setAttribute('aria-label', 'Transcript tools');

      // --- Create the "Copy Transcript" part of the button ---
      const copyButton = document.createElement('button');
      copyButton.id = randomCopyBtnId;
      copyButton.className = randomButtonClass;
      copyButton.textContent = 'Transcript Distiller';
      copyButton.setAttribute('aria-label', 'Copy video transcript to clipboard');
      copyButton.setAttribute('type', 'button');
      copyButton.addEventListener('click', handleCopyClick);

      // --- Create the "Settings" gear part of the button ---
      const settingsButton = document.createElement('button');
      settingsButton.id = randomSettingsBtnId;
      settingsButton.className = randomButtonClass;
      settingsButton.title = 'Distiller Settings';
      settingsButton.setAttribute('aria-label', 'Open Distiller settings');
      settingsButton.setAttribute('type', 'button');
      
      // Use inline SVG to avoid external resource blocking
      settingsButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
        <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>
      </svg>`;
      settingsButton.addEventListener('click', openSettingsModal);

      // Add both parts to the container
      container.appendChild(copyButton);
      container.appendChild(settingsButton);



      // Insert using multiple strategies for maximum resistance
      // Strategy 1: Normal insertion
      targetContainer.parentNode.insertBefore(container, targetContainer.nextSibling);
      
      // Strategy 2: Force visibility with important styles
      container.style.cssText = 'display: flex !important; visibility: visible !important; opacity: 1 !important; position: relative !important;'
        + (IS_MOBILE ? ' margin: 8px 12px !important; gap: 4px !important;' : '');
      
      // Strategy 3: Add mutation observer to detect and counter removal
      if (window.transcriptProtectionObserver) {
		  window.transcriptProtectionObserver.disconnect();
		}

		// Strategy 3: Add mutation observer to detect removal (but don't auto-reinject to avoid duplicates)
		window.transcriptProtectionObserver = new MutationObserver((mutations) => {
		  mutations.forEach((mutation) => {
			if (mutation.type === 'childList') {
			  mutation.removedNodes.forEach((node) => {
				if (node === container || (node.contains && node.contains(container))) {
				  console.log("Transcript button removed, marking for re-injection on next check");
				  isInjected = false;
				}
			  });
			}
		  });
		});

		window.transcriptProtectionObserver.observe(targetContainer.parentNode, {
		  childList: true,
		  subtree: false  // Changed from true to false to reduce overhead
		});
      
      console.log("Transcript Copier: Button injected successfully with adblocker resistance.");
      isInjected = true;
      return true;
      
    } catch (error) {
      console.error("Failed to inject button:", error);
      return false;
    }
  }

  // --- STORAGE FALLBACK SYSTEM ---
	const STORAGE_KEY = 'yt-transcript-settings';

	// Make getSettings an async function for better control over async operations
	async function getSettings() {
	  // This helper function wraps the storage API call in a Promise with a timeout
	  // to prevent hanging if the API call doesn't respond or throws.
	  function getStoragePromise(api) {
		return new Promise(async (resolve, reject) => {
		  // Set a timeout to reject the promise if storage API doesn't respond
		  const timeoutId = setTimeout(() => reject(new Error("Storage operation timed out")), 500); // 500ms timeout

		  try {
			// Use the API's 'get' method. The callback 'result' will be the settings.
			api.get(defaultSettings, (result) => {
			  clearTimeout(timeoutId); // Clear timeout if callback is called
			  if (chrome.runtime.lastError) { // Check for errors reported by the browser API
				reject(chrome.runtime.lastError);
			  } else {
				resolve(result); // Resolve with the retrieved settings
			  }
			});
		  } catch (e) {
			clearTimeout(timeoutId);
			reject(e); // Catch any synchronous errors during the API call setup
		  }
		});
	  }

	  // 1. Try browser.storage.sync (or chrome.storage.sync for compatibility)
	  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
		try {
		  const storedSettings = await getStoragePromise(chrome.storage.sync);
		  // Merge with default settings to ensure all keys are present
		  return { ...defaultSettings, ...storedSettings };
		} catch (e) {
		  console.warn("YouTube Transcript Copier: Chrome storage error or timeout, falling back to localStorage:", e);
		  // Continue to localStorage fallback if chrome.storage fails
		}
	  }
	  
	  // 2. Fallback to localStorage
	  try {
		const stored = localStorage.getItem(STORAGE_KEY);
		const settings = stored ? JSON.parse(stored) : {}; // Parse to object, then merge
		return { ...defaultSettings, ...settings }; // Ensure defaults are merged
	  } catch (e) {
		console.warn("YouTube Transcript Copier: localStorage error, using default settings:", e);
		return defaultSettings; // Return default settings if localStorage also fails
	  }
	}

	// Function to set settings (similar robustness needed)
	function setSettings(settings) {
	  // 1. Try browser.storage.sync (or chrome.storage.sync)
	  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
		try {
		  chrome.storage.sync.set(settings, () => {
			if (chrome.runtime.lastError) {
			  console.warn("YouTube Transcript Copier: Error setting Chrome storage:", chrome.runtime.lastError);
			  // Fallback to localStorage if setting sync storage fails
			  try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
			  } catch (e) {
				console.warn("YouTube Transcript Copier: localStorage not available, settings will not persist:", e);
			  }
			}
		  });
		  return; // Exit if sync storage attempt is made
		} catch (e) {
		  console.warn("YouTube Transcript Copier: Error accessing Chrome storage for set, falling back to localStorage:", e);
		  // Continue to localStorage fallback
		}
	  }
	  
	  // 2. Fallback to localStorage
	  try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	  } catch (e) {
		console.warn("YouTube Transcript Copier: localStorage not available, settings will not persist:", e);
	  }
	}

  function openSettingsModal() {
    if (document.querySelector('.modal-overlay-transcript')) return;

    applyThemeToUI();
    const isDark = (document.getElementById(randomContainerId)?.getAttribute('data-theme') !== 'light');

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay-transcript';

    const modal = document.createElement('div');
    modal.className = 'modal-content-transcript';
    modal.setAttribute('data-theme', isDark ? 'dark' : 'light');

    // Build modal via DOM (no innerHTML) to satisfy AMO linter
    const h2 = document.createElement('h2');
    h2.textContent = chrome.i18n.getMessage('modal_title');
    modal.appendChild(h2);

    // --- API Key section ---
    const apiSection = document.createElement('div');
    apiSection.className = 'setting-item';
    apiSection.style.cssText = 'flex-direction:column; align-items:flex-start; gap:6px;';

    const apiLabel = document.createElement('label');
    apiLabel.htmlFor = 'td-api-key';
    apiLabel.style.fontSize = '14px';
    apiLabel.textContent = chrome.i18n.getMessage('lbl_apikey') + ' ';
    const apiLink = document.createElement('a');
    apiLink.href = 'https://aistudio.google.com/app/apikey';
    apiLink.target = '_blank';
    apiLink.style.cssText = 'margin-left:8px; font-size:12px; color:#3ea6ff; text-decoration:none;';
    apiLink.textContent = chrome.i18n.getMessage('lbl_apikey_link');
    apiLabel.appendChild(apiLink);
    apiSection.appendChild(apiLabel);

    const apiRow = document.createElement('div');
    apiRow.style.cssText = 'display:flex; gap:6px; width:100%;';
    const apiInput = document.createElement('input');
    apiInput.type = 'password';
    apiInput.id = 'td-api-key';
    apiInput.placeholder = 'AIza…';
    apiInput.autocomplete = 'off';
    apiInput.spellcheck = false;
    apiInput.style.cssText = 'flex:1; background:var(--yt-trans-bg); border:1px solid var(--yt-trans-border); border-radius:6px; color:var(--yt-trans-text); font-size:13px; padding:7px 10px; outline:none;';
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'td-toggle-key';
    toggleBtn.style.cssText = 'background:var(--yt-trans-bg); border:1px solid var(--yt-trans-border); border-radius:6px; color:var(--yt-trans-text); font-size:12px; padding:7px 10px; cursor:pointer; white-space:nowrap;';
    toggleBtn.textContent = chrome.i18n.getMessage('btn_show');
    apiRow.appendChild(apiInput);
    apiRow.appendChild(toggleBtn);
    apiSection.appendChild(apiRow);
    modal.appendChild(apiSection);

    // --- Language section ---
    const langSection = document.createElement('div');
    langSection.className = 'setting-item';
    langSection.style.cssText = 'flex-direction:column; align-items:flex-start; gap:6px; margin-top:12px;';
    const langLabel = document.createElement('label');
    langLabel.htmlFor = 'td-lang';
    langLabel.style.fontSize = '14px';
    langLabel.textContent = chrome.i18n.getMessage('lbl_lang');
    const langSelect = document.createElement('select');
    langSelect.id = 'td-lang';
    langSelect.style.cssText = 'width:100%; background:var(--yt-trans-bg); border:1px solid var(--yt-trans-border); border-radius:6px; color:var(--yt-trans-text); font-size:13px; padding:7px 10px; outline:none; cursor:pointer;';
    LANGUAGES.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l.code;
      opt.textContent = l.label;
      langSelect.appendChild(opt);
    });
    langSection.appendChild(langLabel);
    langSection.appendChild(langSelect);
    modal.appendChild(langSection);

    // --- Prompt section ---
    // Das Gemini-Modell ist bewusst nur auf der Options-Seite konfigurierbar,
    // nicht im In-Page-Modal (Entscheidung 2026-07-10).
    const promptSection = document.createElement('div');
    promptSection.className = 'setting-item';
    promptSection.style.cssText = 'flex-direction:column; align-items:flex-start; gap:6px; margin-top:12px;';
    const promptHeader = document.createElement('div');
    promptHeader.style.cssText = 'display:flex; justify-content:space-between; align-items:center; width:100%;';
    const promptLabel = document.createElement('label');
    promptLabel.htmlFor = 'td-prompt';
    promptLabel.style.fontSize = '14px';
    promptLabel.textContent = chrome.i18n.getMessage('lbl_prompt');
    const resetBtn = document.createElement('button');
    resetBtn.id = 'td-reset-prompt';
    resetBtn.style.cssText = 'background:none; border:1px solid var(--yt-trans-border); border-radius:5px; color:#aaa; font-size:11px; padding:3px 8px; cursor:pointer;';
    resetBtn.textContent = chrome.i18n.getMessage('btn_reset');
    promptHeader.appendChild(promptLabel);
    promptHeader.appendChild(resetBtn);

    // Hinweis auf verbesserten Default-Prompt (nur bei gespeichertem Custom-Prompt)
    const promptNotice = document.createElement('div');
    promptNotice.id = 'td-prompt-notice';
    promptNotice.style.cssText = 'display:none; align-items:flex-start; gap:10px; width:100%; box-sizing:border-box; background:rgba(62,166,255,0.12); border:1px solid #3ea6ff; border-radius:6px; color:var(--yt-trans-text); font-size:12px; padding:8px 10px; line-height:1.4;';
    const promptNoticeText = document.createElement('span');
    promptNoticeText.textContent = chrome.i18n.getMessage('opt_prompt_notice');
    const promptNoticeClose = document.createElement('button');
    promptNoticeClose.textContent = '×';
    promptNoticeClose.style.cssText = 'background:none; border:none; color:#aaa; font-size:16px; line-height:1; cursor:pointer; padding:0; margin-left:auto;';
    promptNoticeClose.addEventListener('click', () => {
      promptNotice.style.display = 'none';
      chrome.storage.sync.set({ promptNoticeSeen: PROMPT_GENERATION });
    });
    promptNotice.appendChild(promptNoticeText);
    promptNotice.appendChild(promptNoticeClose);

    const promptArea = document.createElement('textarea');
    promptArea.id = 'td-prompt';
    promptArea.rows = 4;
    promptArea.spellcheck = false;
    promptArea.style.cssText = 'width:100%; box-sizing:border-box; background:var(--yt-trans-bg); border:1px solid var(--yt-trans-border); border-radius:6px; color:var(--yt-trans-text); font-size:13px; padding:7px 10px; outline:none; resize:vertical; font-family:Roboto,Arial,sans-serif; line-height:1.5;';
    promptSection.appendChild(promptHeader);
    promptSection.appendChild(promptNotice);
    promptSection.appendChild(promptArea);
    modal.appendChild(promptSection);

    // --- Buttons row ---
    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex; justify-content:flex-end; gap:8px; margin-top:16px;';
    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'td-cancel';
    cancelBtn.style.cssText = 'background:var(--yt-trans-bg); border:1px solid var(--yt-trans-border); border-radius:6px; color:var(--yt-trans-text); font-size:14px; padding:8px 16px; cursor:pointer;';
    cancelBtn.textContent = chrome.i18n.getMessage('btn_cancel');
    const saveBtn = document.createElement('button');
    saveBtn.id = 'td-save';
    saveBtn.style.cssText = 'background:#3ea6ff; border:none; border-radius:6px; color:#000; font-size:14px; font-weight:600; padding:8px 16px; cursor:pointer;';
    saveBtn.textContent = chrome.i18n.getMessage('btn_save');
    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);
    modal.appendChild(btnRow);

    const statusDiv = document.createElement('div');
    statusDiv.id = 'td-status';
    statusDiv.style.cssText = 'text-align:right; font-size:12px; color:#4ade80; margin-top:6px; min-height:16px;';
    modal.appendChild(statusDiv);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Load current values — hide API section if key already set
    chrome.storage.sync.get(['geminiApiKey', 'distillerPrompt', 'distillerLang', 'invalidKey', 'promptNoticeSeen'], (r) => {
      const hasKey = !!(r.geminiApiKey && r.geminiApiKey.trim());
      const keyInvalid = !!(r.invalidKey);

      // Show API section only if no key set, or key was marked invalid
      if (hasKey && !keyInvalid) {
        apiSection.style.display = 'none';
      } else {
        apiSection.style.display = '';
        document.getElementById('td-api-key').value = r.geminiApiKey || '';
        if (keyInvalid) {
          const warn = document.createElement('div');
          warn.style.cssText = 'color:#f87171; font-size:12px; margin-top:4px;';
          warn.textContent = chrome.i18n.getMessage('err_key_invalid') || '⚠ API Key ungültig – bitte neu eingeben.';
          apiSection.appendChild(warn);
        }
      }

      document.getElementById('td-prompt').value = r.distillerPrompt || DEFAULT_DISTILLER_PROMPT;
      document.getElementById('td-lang').value = r.distillerLang || detectBrowserLang();

      // Eigener Prompt gespeichert → auf den verbesserten Default hinweisen
      const hasCustomPrompt = r.distillerPrompt && r.distillerPrompt.trim() !== DEFAULT_DISTILLER_PROMPT.trim();
      if (hasCustomPrompt && r.promptNoticeSeen !== PROMPT_GENERATION) {
        promptNotice.style.display = 'flex';
      }
    });

    // Reset prompt to default
    document.getElementById('td-reset-prompt').addEventListener('click', () => {
      document.getElementById('td-prompt').value = DEFAULT_DISTILLER_PROMPT;
    });

    // Toggle show/hide key
    document.getElementById('td-toggle-key').addEventListener('click', () => {
      const inp = document.getElementById('td-api-key');
      const btn = document.getElementById('td-toggle-key');
      inp.type = inp.type === 'password' ? 'text' : 'password';
      btn.textContent = inp.type === 'password' ? chrome.i18n.getMessage('btn_show') : chrome.i18n.getMessage('btn_hide');
    });

    // Close on overlay click or cancel
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
    document.getElementById('td-cancel').addEventListener('click', () => overlay.remove());

    // Save
    document.getElementById('td-save').addEventListener('click', () => {
      const keyInput = document.getElementById('td-api-key');
      const existingKey = !!(keyInput.closest('div') && apiSection.style.display === 'none');
      const prompt = document.getElementById('td-prompt').value.trim() || DEFAULT_DISTILLER_PROMPT;
      const lang   = document.getElementById('td-lang').value || detectBrowserLang();
      const status = document.getElementById('td-status');

      // Den Default-Prompt nicht persistieren: nur ein tatsächlich angepasster
      // Prompt wird gespeichert, sonst friert jeder Save den heutigen Default
      // ein und Prompt-Verbesserungen erreichen den Nutzer nie (v1.5.2-Fix).
      const promptIsDefault = prompt === DEFAULT_DISTILLER_PROMPT.trim();
      if (promptIsDefault) chrome.storage.sync.remove('distillerPrompt');

      // If API section hidden, save without touching the key
      if (apiSection.style.display === 'none') {
        // Save gilt als "aktuelle Generation gesehen": ein danach angepasster
        // Prompt loest den Default-Verbesserungs-Hinweis nicht mehr aus.
        const data = { distillerLang: lang, promptNoticeSeen: PROMPT_GENERATION };
        if (!promptIsDefault) data.distillerPrompt = prompt;
        chrome.storage.sync.set(data, () => {
          if (chrome.runtime.lastError) {
            status.style.color = '#f87171';
            status.textContent = chrome.i18n.getMessage('msg_save_error');
          } else {
            status.style.color = '#4ade80';
            status.textContent = chrome.i18n.getMessage('msg_saved');
            setTimeout(() => overlay.remove(), 800);
          }
        });
        return;
      }

      const key = keyInput.value.trim();
      if (!key) {
        status.style.color = '#f87171';
        status.textContent = chrome.i18n.getMessage('msg_no_key');
        return;
      }

      const data = { geminiApiKey: key, distillerLang: lang, invalidKey: false, promptNoticeSeen: PROMPT_GENERATION };
      if (!promptIsDefault) data.distillerPrompt = prompt;
      chrome.storage.sync.set(data, () => {
        if (chrome.runtime.lastError) {
          status.style.color = '#f87171';
          status.textContent = chrome.i18n.getMessage('msg_save_error');
        } else {
          status.style.color = '#4ade80';
          status.textContent = chrome.i18n.getMessage('msg_saved');
          setTimeout(() => overlay.remove(), 800);
        }
      });
    });
  }

  // --- COMMENT FIELD INJECTION LOGIC ---
  // m.youtube.com rendert Kommentare in einem Engagement-Panel (Bottom-Sheet,
  // ytm-engagement-panel-section-list-renderer.engagement-panel-comments-section),
  // geöffnet über einen Teaser unter dem Video. Beides verifiziert gegen das
  // echte MWEB-DOM (headless, 2026-07-11). Die Sektion existiert erst im DOM,
  // wenn das Panel offen ist — deshalb öffnet der Distiller es selbst, statt
  // den Nutzer vorab hinscrollen zu lassen.
  const MOBILE_COMMENTS_PANEL_SELECTOR =
    'ytm-engagement-panel-section-list-renderer.engagement-panel-comments-section, ' +
    '[section-identifier="comment-item-section"], ytm-comment-section-renderer';

  async function openMobileCommentsPanel() {
    let panel = document.querySelector(MOBILE_COMMENTS_PANEL_SELECTOR);
    if (panel) return panel;

    // Teaser unter dem Video; rendert lazy — notfalls schrittweise scrollen
    const teaserSelector =
      'comments-entry-point-teaser-view-model, .ytCommentsEntryPointTeaserViewModelHost, ' +
      'yt-comment-teaser-carousel-item-view-model, ytm-comments-entry-point-header-renderer';
    let teaser = document.querySelector(teaserSelector);
    for (let i = 0; !teaser && i < 6; i++) {
      window.scrollBy(0, 500);
      await new Promise(r => setTimeout(r, 500));
      teaser = document.querySelector(teaserSelector);
    }
    if (!teaser) return null; // Kommentare deaktiviert oder DOM erneut geändert

    teaser.scrollIntoView({ block: 'center' });
    await new Promise(r => setTimeout(r, 400));
    teaser.click();
    return await waitForElement(MOBILE_COMMENTS_PANEL_SELECTOR, 8000);
  }

  async function injectTextIntoCommentField(text) {
    let editor;

    if (IS_MOBILE) {
      // 1. Kommentar-Panel öffnen (oder wiederfinden, falls schon offen)
      const panel = await openMobileCommentsPanel();
      if (!panel) {
        throw new Error(chrome.i18n.getMessage('err_no_comments'));
      }
      await new Promise(r => setTimeout(r, 800));

      // 2. Composer aktivieren: entweder liegt das Feld schon im Panel,
      // oder ein Platzhalter ("Kommentar hinzufügen") muss geklickt werden.
      // Der eingeloggte Composer ließ sich headless nicht verifizieren —
      // deshalb bewusst breite Kandidatenliste.
      editor = panel.querySelector('textarea, [contenteditable="true"]');
      if (!editor) {
        // Der sichtbare Composer ist ein Button (button.YtmCommentSimpleboxRendererReply,
        // "Kommentar hinzufuegen..."); erst sein Klick erzeugt das textarea gleicher
        // Klasse (ohne aria-label, nur placeholder). Verifiziert am Geraet
        // (Galaxy A51, Firefox Nightly, eingeloggt, 2026-07-11).
        const activator = panel.querySelector(
          'button.YtmCommentSimpleboxRendererReply, ytm-comment-simplebox-renderer button, ' +
          '[class*="simplebox" i] button, ytm-comments-simplebox-entry-renderer, [class*="commentsEntryPoint" i]'
        );
        if (activator) {
          activator.click();
          await new Promise(r => setTimeout(r, 800));
        }
        editor = await waitForElement(
          'textarea.YtmCommentSimpleboxRendererReply, ytm-comment-simplebox-renderer textarea, ' +
          'ytm-commentbox textarea, textarea[aria-label], [contenteditable="true"]',
          5000
        );
      }
      if (!editor) {
        throw new Error(chrome.i18n.getMessage('err_no_editor'));
      }
    } else {
      // 1. Scroll to comments section to trigger lazy loading
      const commentsSection = document.querySelector('#comments');
      if (!commentsSection) {
        throw new Error(chrome.i18n.getMessage('err_no_comments'));
      }
      commentsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      await new Promise(r => setTimeout(r, 1200));

      // 2. Find and click the comment input placeholder to activate it
      const placeholder = await waitForElement(
        '#simplebox-placeholder, ytd-comment-simplebox-renderer #placeholder-area',
        6000
      );
      if (!placeholder) {
        throw new Error(chrome.i18n.getMessage('err_no_field'));
      }
      placeholder.click();
      await new Promise(r => setTimeout(r, 800));

      // 3. Find the editor that appears after clicking
      editor = await waitForElement(
        '#contenteditable-root, ytd-comment-simplebox-renderer [contenteditable="true"]',
        5000
      );
      if (!editor) {
        throw new Error(chrome.i18n.getMessage('err_no_editor'));
      }
    }

    editor.focus();
    await new Promise(r => setTimeout(r, 200));

    // Textarea path (mobile): set the value directly and notify the framework
    if (editor.tagName === 'TEXTAREA') {
      // Nativer Prototype-Setter: YouTubes Framework haengt eine eigene value-
      // Property davor; direktes editor.value = ... erreicht dessen internen
      // State nicht zuverlaessig.
      const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      nativeSetter.call(editor, text);
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      editor.dispatchEvent(new Event('change', { bubbles: true }));
      // MWEB rendert das Feld 84px hoch — zum Pruefen der Zusammenfassung zu
      // klein, und der Resize-Griff ist mit dem Finger kaum zu treffen.
      // 40vh am Geraet abgestimmt (2026-07-11).
      editor.style.setProperty('height', '40vh', 'important');
      editor.style.setProperty('max-height', '50vh', 'important');
      return true;
    }

    // 4. Clear existing content
    document.execCommand('selectAll', false, null);
    document.execCommand('delete', false, null);

    // 5. Write full text to clipboard, then paste — bypasses execCommand length limits
    await navigator.clipboard.writeText(text);

    // Synthetic paste event: YouTube's editor handles this natively without truncation
    const pasteEvent = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: new DataTransfer()
    });
    pasteEvent.clipboardData.setData('text/plain', text);
    editor.dispatchEvent(pasteEvent);

    await new Promise(r => setTimeout(r, 150));

    // 6. Verify something landed — if paste event was swallowed, fall back to execCommand chunks
    if (!editor.textContent.trim()) {
      console.warn("[Distiller] Paste event swallowed, trying execCommand fallback...");
      const CHUNK = 500;
      for (let i = 0; i < text.length; i += CHUNK) {
        document.execCommand('insertText', false, text.slice(i, i + CHUNK));
        await new Promise(r => setTimeout(r, 30));
      }
    }

    // 7. Fire input event so YouTube's internal state updates
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('change', { bubbles: true }));

    return true;
  }

  // --- USAGE STATISTICS PING ---
  async function pingStats(langResponse, langBrowser, langUi) {
    try {
      await fetch('https://marsgasse.com/api/addon-stats.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addon:         'yt-transcript-distiller',
          action:        'distill',
          lang_response: langResponse,
          lang_browser:  langBrowser,
          lang_ui:       langUi,
        }),
      });
    } catch (e) {
      // Fire-and-forget – Fehler ignorieren
    }
  }

  // --- GEMINI API CALL ---
  async function callGeminiApi(apiKey, prompt, transcriptText, model) {
    const modelId = (model || DEFAULT_MODEL).trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent?key=${apiKey}`;

    const body = {
      contents: [{
        parts: [{
          text: `${prompt}\n\n${transcriptText}`
        }]
      }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 8192
        // Kein thinkingConfig: gemini-3.5/3.6 lehnen thinkingBudget 0 mit 400
        // INVALID_ARGUMENT ab (Alias-Wanderung 2026-07-21); Lite-Modelle denken
        // ohne das Feld ohnehin nicht, die uebrigen nach ihrem eigenen Default.
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const msg = errBody?.error?.message || `HTTP ${res.status}`;
      // Ungueltiger Key kommt nicht nur als 401/403, sondern auch als 400
      // INVALID_ARGUMENT (Reason API_KEY_INVALID) - den darf der allgemeine
      // 400er-Hinweis unten nicht erwischen, der Nutzer kann ihn selbst loesen.
      const keyProblem = res.status === 401 || res.status === 403 ||
        (res.status === 400 && (
          /api key/i.test(msg) ||
          (errBody?.error?.details || []).some(d => d?.reason === 'API_KEY_INVALID')
        ));
      if (keyProblem) {
        chrome.storage.sync.set({ invalidKey: true });
      }
      // 404 = Modell abgeschaltet, 429 = Tageskontingent des Modells leer,
      // 503 = Modell überlastet — in allen drei Fällen hilft ein Modellwechsel.
      // Sonstige 400er (z.B. abgelehnte Request-Parameter nach einer Alias-
      // Wanderung wie 2026-07-21) und 5xx kann der Nutzer nicht loesen:
      // Schuldfrage klaeren und auf ein Add-on-Update verweisen.
      let hint = '';
      if (res.status === 404 || res.status === 429 || res.status === 503) {
        hint = `\n\n${chrome.i18n.getMessage('err_switch_model')}`;
      } else if (!keyProblem && (res.status === 400 || res.status >= 500)) {
        hint = `\n\n${chrome.i18n.getMessage('err_not_your_fault')}\n${AMO_LINK}`;
      }
      throw new Error(`Gemini API Fehler: ${msg}${hint}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Gemini hat keine verwertbare Antwort zurückgegeben.");
    return sanitizeTypography(text.trim());
  }

  // Gemini haelt sich nicht immer an die Zeichenregel im Default-Prompt, und
  // eigene Prompts enthalten sie gar nicht. Deshalb deterministische Nach-
  // bearbeitung: im Kommentar landen nur direkt tippbare Zeichen (Regel
  // 2026-07-12). Reihenfolge wichtig: Zahlenbereiche vor der Satzstrich-Regel.
  function sanitizeTypography(text) {
    return text
      .replace(/(\d)\s*[—–]\s*(\d)/g, '$1-$2')   // 5–10 -> 5-10
      .replace(/«\s*/g, '"').replace(/\s*»/g, '"')
      .replace(/^[\t ]*[—–―]\s*/gm, '- ')        // Strich am Zeilenanfang
      .replace(/\s*[—–―]+\s*/g, ', ')            // Gedankenstrich im Satz
      .replace(/[‘’‚‹›]/g, "'")
      .replace(/[“”„]/g, '"')
      .replace(/…/g, '...');
  }

  // --- MAIN DISTILLER LOGIC ---
  const AMO_LINK = 'addons.mozilla.org/addon/youtube-transcript-distiller';

  // --- FOOTER TEXT BY RESPONSE LANGUAGE ---
  const FOOTER_BY_LANG = {
    'en': `boiled down by Transcript Distiller\n${AMO_LINK}`,
    'de': `Eingedampft mit Transcript Distiller\n${AMO_LINK}`,
    'fr': `condensé par Transcript Distiller\n${AMO_LINK}`,
    'es': `resumido por Transcript Distiller\n${AMO_LINK}`,
    'pt': `destilado por Transcript Distiller\n${AMO_LINK}`,
    'ru': `сжато с помощью Transcript Distiller\n${AMO_LINK}`,
    'ar': `مُلخَّص بواسطة Transcript Distiller\n${AMO_LINK}`,
    'zh': `由 Transcript Distiller 提炼\n${AMO_LINK}`,
    'hi': `Transcript Distiller द्वारा सारांशित\n${AMO_LINK}`,
    'ja': `Transcript Distillerで要約\n${AMO_LINK}`,
    'ko': `Transcript Distiller로 요약됨\n${AMO_LINK}`,
  };

  // --- EXTRACT VIDEO DESCRIPTION FROM PAGE ---
  function getVideoDescription() {
    // Primary: full description straight from the player response —
    // independent of DOM layout, no expander clicking, works on mobile.
    try {
      const player = getPagePlayer();
      const pr = (player && typeof player.getPlayerResponse === 'function')
        ? player.getPlayerResponse() : null;
      const short = pr && pr.videoDetails && pr.videoDetails.shortDescription;
      if (short && short.trim()) {
        return short.trim().slice(0, 3000); // max 3000 Zeichen
      }
    } catch (e) {
      console.warn('[Transcript Debug] Player description access failed:', e);
    }

    const selectors = [
      '#description-inline-expander yt-attributed-string',
      '#description-inline-expander',
      '#snippet-text',
      'ytd-text-inline-expander yt-attributed-string',
      '#description .ytd-video-secondary-info-renderer',
      'ytm-expandable-video-description-body-renderer',
      '.unified-description',
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) {
        return el.textContent.trim().slice(0, 3000); // max 3000 Zeichen
      }
    }
    return null;
  }

  // --- FILTER # COMMENT LINES FROM PROMPT ---
  function filterPromptComments(prompt) {
    return prompt
      .split('\n')
      .filter(line => !line.trimStart().startsWith('#'))
      .join('\n')
      .trim();
  }

  function getFooterForLang(langCode) {
    return FOOTER_BY_LANG[langCode] || FOOTER_BY_LANG['en'];
  }

  // --- QUOTA COUNTDOWN ON BUTTON ---
  function startQuotaCountdown(copyButton, originalText, seconds) {
    let remaining = Math.ceil(seconds);
    copyButton.disabled = false; // Button bleibt klickbar

    const tick = () => {
      if (remaining <= 0) {
        copyButton.textContent = originalText;
        return;
      }
      copyButton.textContent = `⏳ ${remaining}s`;
      remaining--;
      setTimeout(tick, 1000);
    };
    tick();
  }

  // --- PARSE RETRY SECONDS FROM GEMINI ERROR MESSAGE ---
  function parseRetrySeconds(message) {
    const match = message.match(/retry in ([\d.]+)s/i);
    return match ? parseFloat(match[1]) : null;
  }

  async function handleCopyClick() {
    const copyButton = document.getElementById(randomCopyBtnId);
    const originalText = 'Transcript Distiller';

    copyButton.disabled = true;
    let langCode = 'en';

    try {
      // 1. Einstellungen + API-Key laden
      copyButton.textContent = chrome.i18n.getMessage('btn_fetching');
      const settings = await getSettings();

      const apiKey = await new Promise((resolve) => {
        chrome.storage.sync.get(['geminiApiKey'], (r) => resolve(r.geminiApiKey || ''));
      });
      if (!apiKey) {
        throw new Error(chrome.i18n.getMessage('err_no_key'));
      }

      const userPrompt = await new Promise((resolve) => {
        chrome.storage.sync.get(['distillerPrompt', 'distillerLang', 'distillerModel'], (r) => {
          const rawPrompt = r.distillerPrompt || DEFAULT_DISTILLER_PROMPT;
          const cleanPrompt = filterPromptComments(rawPrompt);
          langCode = r.distillerLang || detectBrowserLang();
          const model = (r.distillerModel || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
          resolve({ cleanPrompt, model });
        });
      });

      // Templates ersetzen ({mood}, {style}, {title}, {creator}, ...)
      const templatedPrompt = await applyTemplates(userPrompt.cleanPrompt);
      const finalPrompt = `${templatedPrompt}\n\n${buildLangInstruction(langCode)}`;

      // 2. Transkript holen
      copyButton.textContent = chrome.i18n.getMessage('btn_fetching');
      const transcriptObj = await getTranscriptDict(window.location.href);
      if (!transcriptObj || !transcriptObj.transcript.length) {
        throw new Error(chrome.i18n.getMessage('err_no_transcript'));
      }

      // 3. Transkript + Description formatieren
      const transcriptText = transcriptObj.transcript
        .map(([, text]) => text)
        .join(' ');

      const description = getVideoDescription();
      const fullContent = description
        ? `[Video Description]\n${description}\n\n[Transcript]\n${transcriptText}`
        : transcriptText;

      // 4. Gemini aufrufen
      copyButton.textContent = chrome.i18n.getMessage('btn_thinking');
      const summary = await callGeminiApi(apiKey, finalPrompt, fullContent, userPrompt.model);

      // Footer in der gewählten Antwortsprache
      const finalText = `${summary}\n\n${getFooterForLang(langCode)}`;

      // 5. Ins Kommentarfeld injizieren
      copyButton.textContent = chrome.i18n.getMessage('btn_injecting');
      try {
        await injectTextIntoCommentField(finalText);
      } catch (injectErr) {
        // Die Zusammenfassung existiert bereits — bei gescheiterter Injektion
        // in die Zwischenablage legen statt sie wegzuwerfen.
        let copied = false;
        try {
          await navigator.clipboard.writeText(finalText);
          copied = true;
        } catch (clipErr) { /* Clipboard nicht verfuegbar */ }
        throw new Error(injectErr.message + (copied ? '\n\n' + chrome.i18n.getMessage('err_copied_fallback') : ''));
      }

      // Statistik-Ping nur wenn Telemetrie aktiviert (default: an)
      chrome.storage.sync.get(['telemetryEnabled'], (r) => {
        if (r.telemetryEnabled !== false) {
          pingStats(langCode, navigator.language || 'unknown', chrome.i18n.getUILanguage() || 'unknown');
        }
      });

      copyButton.textContent = chrome.i18n.getMessage('btn_done');

    } catch (err) {
      console.error("Transcript Distiller Fehler:", err);

      // Quota-Fehler: Countdown anzeigen
      const retrySeconds = parseRetrySeconds(err.message);
      if (retrySeconds) {
        alert(`Transcript Distiller:\n\n${err.message}`);
        startQuotaCountdown(copyButton, originalText, retrySeconds);
        return; // finally überspringen
      }

      copyButton.textContent = chrome.i18n.getMessage('btn_error');
      alert(`Transcript Distiller:\n\n${err.message}`);
    } finally {
      setTimeout(() => {
        copyButton.textContent = originalText;
        copyButton.disabled = false;
      }, 3000);
    }
  }

  // --- ROBUST JSON EXTRACTOR ---
  function extractJsonVariable(content, variableName) {
      const prefix = `var ${variableName} =`;
      const startIndex = content.indexOf(prefix);
      if (startIndex === -1) return null;
      
      let braceStart = content.indexOf('{', startIndex);
      if (braceStart === -1) return null;
      
      let balance = 0;
      let inString = false;
      let escape = false;
      
      // Walk through characters to find the matching closing brace
      for (let i = braceStart; i < content.length; i++) {
        const char = content[i];
        
        if (escape) { escape = false; continue; }
        if (char === '\\') { escape = true; continue; }
        if (char === '"') { inString = !inString; continue; }
        
        if (!inString) {
           if (char === '{') balance++;
           else if (char === '}') {
              balance--;
              if (balance === 0) {
                 try {
                    return JSON.parse(content.substring(braceStart, i + 1));
                 } catch (e) { return null; }
              }
           }
        }
      }
      return null;
  }

  // --- TRANSCRIPT FETCHING LOGIC (VIDEOS ONLY) ---
  async function getTranscriptDict(videoUrl) {
      // The try/catch was removed here so the actual error bubbles up to handleCopyClick
      const { title, ytData } = await resolveYouTubeData(videoUrl);
      const segments = await getTranscriptItems(ytData);
      
      if (!segments || !segments.length) {
          throw new Error("No transcript segments found.");
      }
      
      const transcript = segments.map(item => getSegmentData(item));
      return { title, transcript };
  }

  async function resolveYouTubeData(videoUrl) {
      console.log(`[Transcript Debug] Resolving data for URL: ${videoUrl}`);
      
      let ytData = window.ytInitialData;
      if (ytData) console.log("[Transcript Debug] Found ytInitialData in global window object.");
      
      if (!ytData) {
          console.log("[Transcript Debug] Global object missing, scanning script tags...");
          const scripts = document.getElementsByTagName('script');
          for (let script of scripts) {
              if (script.textContent.includes('var ytInitialData =')) {
                  ytData = extractJsonVariable(script.textContent, 'ytInitialData');
                  if (ytData) {
                      console.log("[Transcript Debug] Successfully extracted ytInitialData from script tag.");
                      break;
                  }
              }
          }
      }

      if (!ytData) {
          console.log("[Transcript Debug] Script tag scan failed, fetching raw HTML fallback...");
          try {
              const html = await fetch(videoUrl).then(res => res.text());
              ytData = extractJsonFromHtml(html, "ytInitialData");
              console.log(ytData ? "[Transcript Debug] HTML fetch succeeded." : "[Transcript Debug] HTML fetch returned null.");
          } catch (e) {
              console.warn("[Transcript Debug] Fetch fallback failed:", e);
          }
      }

      const domTitle = document.querySelector("#title h1")?.textContent?.trim() ||
                       document.querySelector("h1.ytd-watch-metadata")?.textContent?.trim();

      const title = domTitle ||
                    getVideoTitle() ||
                    ytData?.videoDetails?.title ||
                    document.querySelector('meta[name="title"]')?.content || 
                    document.title.replace(" - YouTube", "") || 
                    "Unknown Title";
      
      console.log(`[Transcript Debug] Resolved Title: "${title}"`);
      return { title, ytData };
  }

  function getSegmentData(item) {
      const seg = item?.transcriptSegmentRenderer;
      if (!seg) return ["", ""];
      const timestamp = seg.startTimeText?.simpleText || "";
      const text = seg.snippet?.runs?.map(r => r.text).join("") || "";
      return [timestamp, text];
  }

  // --- STRATEGY 0: CAPTION TRACKS FROM THE PLAYER ---
  // The player exposes its caption track URLs via getAudioTrack(). Once the
  // player has obtained its proof-of-origin token, the URL carries a "pot"
  // parameter — without it the timedtext endpoint answers 200 with an empty
  // body. Works identically on www and m.youtube.com.
  function formatMs(ms) {
    const total = Math.floor(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`;
  }

  async function getTranscriptFromPlayer() {
    const player = getPagePlayer();
    if (!player || typeof player.getAudioTrack !== 'function') {
      console.log("[Transcript Debug] Strategy 0: player or getAudioTrack() unavailable.");
      return null;
    }

    // Vor der ersten Wiedergabe liefert der Player keine captionTracks bzw.
    // kein pot-Token — ohne Autoplay (Handy) steht das Video bei 0:00 und
    // Strategy 0 lief dort ins Leere (Geraete-Befund 2026-07-11). Der Klick
    // auf den Distiller-Button ist eine User-Geste: die Wiedergabe darf
    // einmalig angestossen und danach wieder pausiert werden. Ob das Video
    // ueberhaupt Captions hat, verraet vorab die playerResponse.
    let hasCaptionsInResponse = false;
    try {
      const pr = typeof player.getPlayerResponse === 'function' ? player.getPlayerResponse() : null;
      const prTracks = pr && pr.captions && pr.captions.playerCaptionsTracklistRenderer
        && pr.captions.playerCaptionsTracklistRenderer.captionTracks;
      hasCaptionsInResponse = !!(prTracks && prTracks.length);
    } catch (e) { /* playerResponse nicht lesbar — weiter mit getAudioTrack */ }

    let nudgedPlayback = false;
    let trackUrl = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const audioTrack = player.getAudioTrack();
        const tracks = audioTrack && audioTrack.captionTracks;
        if (tracks && tracks.length > 0) {
          const raw = tracks[0].url || tracks[0].baseUrl;
          if (raw) {
            trackUrl = raw;
            if (new URL(raw, window.location.origin).searchParams.has('pot')) break;
          }
        } else if (tracks && tracks.length === 0 && !hasCaptionsInResponse) {
          console.log("[Transcript Debug] Strategy 0: no caption tracks anywhere — video has no subtitles.");
          return null;
        }
      } catch (e) {
        console.warn("[Transcript Debug] Strategy 0: getAudioTrack() failed:", e);
      }
      if (!nudgedPlayback && attempt >= 1 && typeof player.playVideo === 'function') {
        // Player-States: 1 = playing, 3 = buffering — dann laeuft schon
        // etwas, nichts anfassen und am Ende auch nicht pausieren.
        let state = -99;
        try { state = typeof player.getPlayerState === 'function' ? player.getPlayerState() : -99; } catch (e) {}
        if (state !== 1 && state !== 3) {
          nudgedPlayback = true;
          try {
            player.playVideo();
            console.log("[Transcript Debug] Strategy 0: nudging playback to obtain the pot token.");
          } catch (e) { /* Wiedergabe verweigert — Fehlermeldung raet zum manuellen Anspielen */ }
        }
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    if (nudgedPlayback) {
      try { player.pauseVideo(); } catch (e) { /* Zustand nicht kritisch */ }
    }

    if (!trackUrl) {
      console.log("[Transcript Debug] Strategy 0: no caption track URL appeared.");
      return null;
    }

    const url = new URL(trackUrl, window.location.origin);
    url.searchParams.set('fmt', 'json3');
    url.searchParams.set('c', IS_MOBILE ? 'MWEB' : 'WEB');

    try {
      const res = await fetch(url.toString());
      if (!res.ok) {
        console.warn(`[Transcript Debug] Strategy 0: timedtext returned ${res.status}`);
        return null;
      }
      const bodyText = await res.text();
      if (!bodyText) {
        console.warn("[Transcript Debug] Strategy 0: empty timedtext body (pot token missing?).");
        return null;
      }
      const data = JSON.parse(bodyText);
      const events = (data.events || []).filter(ev => ev.segs && ev.segs.length);
      if (!events.length) {
        console.warn("[Transcript Debug] Strategy 0: json3 contained no caption events.");
        return null;
      }
      console.log(`[Transcript Debug] Strategy 0 Success: ${events.length} caption events from player track.`);
      return events
        .map(ev => ({
          transcriptSegmentRenderer: {
            startTimeText: { simpleText: formatMs(ev.tStartMs || 0) },
            snippet: { runs: [{ text: ev.segs.map(s => s.utf8 || '').join('').replace(/\s+/g, ' ').trim() }] }
          }
        }))
        .filter(item => item.transcriptSegmentRenderer.snippet.runs[0].text);
    } catch (e) {
      console.warn("[Transcript Debug] Strategy 0: fetch/parse failed:", e);
      return null;
    }
  }

  async function getTranscriptItems(ytData) {
    console.log("[Transcript Debug] Attempting to fetch transcript items...");

    // STRATEGY 0: Ask the player for its caption track (www + mobile)
    const playerItems = await getTranscriptFromPlayer();
    if (playerItems && playerItems.length > 0) return playerItems;

    // STRATEGY 1: Try the API first
    try {
      console.log("[Transcript Debug] Strategy 1: Attempting internal API fetch...");
      const stringified = JSON.stringify(ytData);
      const paramMatch = stringified.match(/"getTranscriptEndpoint":\s*{\s*"params":\s*"([^"]+)"/);
      const continuationParams = paramMatch ? paramMatch[1] : null;

      if (continuationParams) {
        console.log("[Transcript Debug] Found continuationParams:", continuationParams);
        
        const apiKey = document.documentElement.innerHTML.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
        const clientVersion = document.documentElement.innerHTML.match(/"clientVersion":"([^"]+)"/)?.[1] || "2.20260306.01.00";
        
        if (!apiKey) {
           console.warn("[Transcript Debug] Could not find INNERTUBE_API_KEY in document.");
        } else {
          console.log(`[Transcript Debug] Using dynamically found clientVersion: ${clientVersion}`);
          
          // Added hl, gl, and userAgent to prevent 400 Bad Request errors
          const body = { 
            context: { 
              client: { 
                clientName: "WEB", 
                clientVersion: clientVersion,
                hl: "en",
                gl: "US",
                userAgent: navigator.userAgent
              } 
            }, 
            params: continuationParams 
          };
          
          const res = await fetch(`https://www.youtube.com/youtubei/v1/get_transcript?key=${apiKey}`, { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify(body) 
          });
          
          if (!res.ok) {
             console.warn(`[Transcript Debug] API returned ${res.status} ${res.statusText}`);
          } else {
             const json = await res.json();
             const items = json.actions?.[0]?.updateEngagementPanelAction?.content?.transcriptRenderer?.content?.transcriptSearchPanelRenderer?.body?.transcriptSegmentListRenderer?.initialSegments;
             
             if (items && items.length > 0) {
               console.log(`[Transcript Debug] Strategy 1 Success: Retrieved ${items.length} items from API.`);
               return items;
             } else {
               console.warn("[Transcript Debug] API returned successful response, but no segments were found in the JSON.", json);
             }
          }
        }
      } else {
         console.warn("[Transcript Debug] getTranscriptEndpoint params not found in ytData.");
      }
    } catch (e) {
      console.warn("[Transcript Debug] API Strategy failed completely:", e);
    }

    console.log("[Transcript Debug] API Strategy failed or returned empty. Falling back to DOM Scrape.");
    
    // STRATEGY 2: Scrape the UI
    const domItems = await scrapeTranscriptFromDOM();
    if (domItems) return domItems;

    if (IS_MOBILE) {
      // Auf m.youtube.com gibt es kein Transkript-Panel zum manuellen Oeffnen —
      // der Desktop-Hinweis waere irrefuehrend. Haeufigste Ursache dort:
      // pot-Token fehlt, weil das Video noch nie lief.
      throw new Error(chrome.i18n.getMessage('err_no_transcript') + '\n\n' + chrome.i18n.getMessage('err_play_video'));
    }
    throw new Error("Transcript panel not available. Try opening the transcript manually, then click the button again.");
  }

  function extractJsonFromHtml(html, key) {
    const regexes = [
      new RegExp(`window\\["${key}"\\]\\s*=\\s*({[\\s\\S]+?})\\s*;`),
      new RegExp(`var ${key}\\s*=\\s*({[\\s\\S]+?})\\s*;`),
      new RegExp(`${key}\\s*=\\s*({[\\s\\S]+?})\\s*;`)
    ];
    
    for (const regex of regexes) {
      const match = html.match(regex);
      if (match && match[1]) {
        try { return JSON.parse(match[1]); } catch (e) {}
      }
    }
    // Final check: look at global window (works if not in strict isolation)
    if (window[key]) return window[key];
    return null;
  }

  // --- ENHANCED OBSERVER LOGIC WITH AUTO-RECOVERY ---
  function setupObserver() {
	  // Disconnect existing observer if it exists
	  if (observer) {
		observer.disconnect();
	  }

	  let lastCheckTime = 0;
	  const CHECK_THROTTLE = 1000; // Only check once per second

	  observer = new MutationObserver((mutations) => {
		const now = Date.now();
		
		// Check for URL changes first (always do this)
		detectUrlChange();
		
		// Throttle the injection checks to prevent rapid-fire attempts
		if (now - lastCheckTime < CHECK_THROTTLE) {
		  return;
		}
		lastCheckTime = now;
		
		// Only try to inject if we haven't successfully injected yet
		if (!isInjected) {
		  // Check for any of our potential target containers
		  if (findTargetContainer()) {
			injectButton().then(success => {
			  if (success) {
				retryCount = 0;
			  }
			});
		  }
		}
		
		// Check if our button was removed (YouTube navigation can remove elements)
		if (isInjected && !document.getElementById(randomContainerId)) {
		  console.log("YouTube Transcript Copier: Button was removed, marking for re-injection");
		  isInjected = false;
		}
	  });

	  // Start observing with robust configuration
	  try {
		observer.observe(document.body, {
		  childList: true,
		  subtree: true,
		  attributes: false,
		  attributeOldValue: false,
		  characterData: false,
		  characterDataOldValue: false
		});
		console.log("YouTube Transcript Copier: Observer started successfully");
	  } catch (error) {
		console.error("YouTube Transcript Copier: Failed to start observer:", error);
		setTimeout(setupObserver, 2000);
	  }
	}

  // --- INITIALIZATION WITH PROGRESSIVE RETRY LOGIC ---
  async function initializeExtension() {
    console.log("YouTube Transcript Copier: Initializing extension...");
    
    const success = await injectButton();
    if (success) {
      console.log("YouTube Transcript Copier: Immediate injection successful");
      retryCount = 0;
    } else {
      console.log("YouTube Transcript Copier: Immediate injection failed, setting up observer and retry logic");
    }
    
    setupObserver();
    
    // Progressive retry with increasing delays
    const retryDelays = [2000, 4000, 6000, 8000, 10000];
    
    const retryInterval = setInterval(async () => {
      if (!isInjected && retryCount < MAX_RETRIES) {
        const delay = retryDelays[retryCount] || 10000;
        console.log(`YouTube Transcript Copier: Retry attempt ${retryCount + 1}/${MAX_RETRIES} (delay: ${delay}ms)`);
        
        const success = await injectButton();
        if (success) {
          clearInterval(retryInterval);
          retryCount = 0;
        } else {
          retryCount++;
        }
      } else if (retryCount >= MAX_RETRIES) {
        console.log("YouTube Transcript Copier: Max retries reached, will try again on next page change");
        clearInterval(retryInterval);
      } else if (isInjected) {
        clearInterval(retryInterval);
      }
    }, 2000);
  }

  // --- ENHANCED PAGE VISIBILITY HANDLING ---
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !isInjected) {
      console.log("YouTube Transcript Copier: Page became visible, checking injection status");
      setTimeout(initializeExtension, 500);
    }
  });

  // --- PERIODIC HEALTH CHECK WITH ADBLOCKER DETECTION ---
  setInterval(() => {
    if (isInjected && !document.getElementById(randomContainerId)) {
      console.log("YouTube Transcript Copier: Health check failed (possible adblocker interference), reinitializing");
      isInjected = false;
      injectionAttempts = 0;
      initializeExtension();
    }
  }, 30000);

  // --- READY STATE HANDLING ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(initializeExtension, 1200);
    });
  } else {
    setTimeout(initializeExtension, 1200);
  }

})();
