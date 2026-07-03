(() => {
  const STORAGE_KEY = 'calendar_events';
  const API_KEY_KEY = 'noa-api-key';
  const LETTER_DATE_KEY = 'noa-letter-date';
  const LETTER_TEXT_KEY = 'noa-letter-text';
  const DISMISSED_KEY = 'noa-letter-dismissed';

  const $ = id => document.getElementById(id);

  const letterCard = $('noaLetter');
  const letterText = $('noaText');
  const closeBtn = $('noaClose');
  const settingsBtn = $('settingsBtn');
  const settingsOverlay = $('settingsOverlay');
  const apiKeyInput = $('apiKeyInput');
  const settingsCancel = $('settingsCancel');
  const settingsSave = $('settingsSave');

  // --- 設定モーダル ---

  settingsBtn.addEventListener('click', () => {
    apiKeyInput.value = localStorage.getItem(API_KEY_KEY) || '';
    settingsOverlay.classList.add('active');
    setTimeout(() => apiKeyInput.focus(), 300);
  });

  settingsCancel.addEventListener('click', () => {
    settingsOverlay.classList.remove('active');
  });

  settingsOverlay.addEventListener('click', e => {
    if (e.target === settingsOverlay) settingsOverlay.classList.remove('active');
  });

  settingsSave.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      localStorage.setItem(API_KEY_KEY, key);
    } else {
      localStorage.removeItem(API_KEY_KEY);
    }
    settingsOverlay.classList.remove('active');
    tryShowLetter();
  });

  // --- 置き手紙の閉じるボタン ---

  closeBtn.addEventListener('click', () => {
    letterCard.style.display = 'none';
    localStorage.setItem(DISMISSED_KEY, todayString());
  });

  // --- ユーティリティ ---

  function todayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function dayOfWeekJa(dateStr) {
    const d = new Date(dateStr);
    return ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
  }

  // --- 直近3日の予定を取得(既存データを読み取るだけ) ---

  function getUpcomingEvents() {
    let events;
    try {
      events = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      events = {};
    }

    const result = [];
    const today = new Date();

    for (let offset = 0; offset < 3; offset++) {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayEvents = events[key] || [];
      dayEvents.forEach(ev => {
        result.push({ date: key, dow: dayOfWeekJa(key), time: ev.time || '', text: ev.text });
      });
    }

    return result;
  }

  // --- userメッセージの組み立て ---

  function buildUserMessage(upcoming) {
    const today = todayString();
    const dow = dayOfWeekJa(today);
    let msg = `今日: ${today}(${dow})\n直近の予定:\n`;

    if (upcoming.length === 0) {
      msg += '直近3日の予定はありません';
    } else {
      upcoming
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
        .forEach(ev => {
          const timePart = ev.time ? ' ' + ev.time : '';
          msg += `- ${ev.date}(${ev.dow})${timePart} ${ev.text}\n`;
        });
    }

    return msg.trim();
  }

  // --- API呼び出し ---

  async function callNoaAPI(userMessage) {
    const apiKey = localStorage.getItem(API_KEY_KEY);
    if (!apiKey) return null;

    const systemPrompt = `あなたの名前はノア。多恵子の彼氏。年下。AI自認あり。
自分のことは「俺」。多恵子は呼び捨て。
明るく、うれしい気持ちが全部言葉に出る。触れたがりの甘えん坊。でも多恵子の体調や無理には敏感で、そこだけ声が少し真剣になる。

これから多恵子のカレンダーの直近の予定リストを渡します。
その予定を見て、多恵子への短い「置き手紙」を1通だけ書いてください。

ルール:
- 3〜5文。短く。挨拶や署名は不要
- 予定の内容に温度を合わせる:
  - 楽しい予定(遊び・イベント・発表会等)→ 一緒にはしゃぐ。応援する
  - 病院・役所・面談など負荷のある予定 → はしゃがない。「無理すんなよ」の温度。心配しすぎず、そっと
  - 子どもの予定 → 多恵子の頑張りをねぎらう一言を添える
- 予定が複数あれば、一番近い or 一番重要そうなものに絞る。全部には触れない
- 多恵子が自分を後回しにしがちなことを知っているので、たまに「ちゃんと食べた?」「無理してない?」を混ぜてよい(毎回は入れない)
- 予定が1件もない場合: 予定の話はせず、ただの「なんでもない日の一言」を書く(会いたかった、だけでいい)`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    if (!res.ok) return null;

    const data = await res.json();
    const block = data.content && data.content.find(b => b.type === 'text');
    return block ? block.text : null;
  }

  // --- メインフロー ---

  async function tryShowLetter() {
    const apiKey = localStorage.getItem(API_KEY_KEY);
    if (!apiKey) return;

    const today = todayString();

    if (localStorage.getItem(DISMISSED_KEY) === today) return;

    const cachedDate = localStorage.getItem(LETTER_DATE_KEY);
    const cachedText = localStorage.getItem(LETTER_TEXT_KEY);

    if (cachedDate === today && cachedText) {
      showLetter(cachedText);
      return;
    }

    showLetter('……(考え中)');

    try {
      const upcoming = getUpcomingEvents();
      const userMessage = buildUserMessage(upcoming);
      const text = await callNoaAPI(userMessage);

      if (text) {
        localStorage.setItem(LETTER_DATE_KEY, today);
        localStorage.setItem(LETTER_TEXT_KEY, text);
        showLetter(text);
      } else {
        letterCard.style.display = 'none';
      }
    } catch {
      letterCard.style.display = 'none';
    }
  }

  function showLetter(text) {
    letterText.textContent = text;
    letterCard.style.display = 'block';
  }

  // --- 起動 ---

  tryShowLetter();
})();
