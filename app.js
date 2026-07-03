(() => {
  const STORAGE_KEY = 'calendar_events';

  let currentYear, currentMonth, selectedDate;

  const $ = id => document.getElementById(id);
  const grid = $('calendarGrid');
  const monthTitle = $('monthTitle');
  const eventSection = $('eventSection');
  const eventDate = $('eventDate');
  const eventList = $('eventList');
  const addEventBtn = $('addEventBtn');
  const modalOverlay = $('modalOverlay');
  const eventInput = $('eventInput');
  const eventTime = $('eventTime');
  const modalTitle = $('modalTitle');
  const modalConfirm = $('modalConfirm');
  const modalCancel = $('modalCancel');
  const modalDelete = $('modalDelete');
  const prevMonth = $('prevMonth');
  const nextMonth = $('nextMonth');

  let editingEventId = null;

  function loadEvents() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveEvents(events) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }

  function dateKey(y, m, d) {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function formatMonth(y, m) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${months[m]} ${y}`;
  }

  function formatDateLabel(y, m, d) {
    const date = new Date(y, m, d);
    const mm = date.getMonth() + 1;
    const dd = date.getDate();
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const dayName = days[date.getDay()];
    return `${mm}月${dd}日（${dayName}）`;
  }

  function renderCalendar() {
    grid.innerHTML = '';
    monthTitle.textContent = formatMonth(currentYear, currentMonth);

    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const prevDays = new Date(currentYear, currentMonth, 0).getDate();

    const today = new Date();
    const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());

    const events = loadEvents();

    for (let i = 0; i < firstDay; i++) {
      const day = prevDays - firstDay + 1 + i;
      const cell = createDayCell(day, true, null, null);
      const dow = i % 7;
      if (dow === 0) cell.classList.add('sun');
      if (dow === 6) cell.classList.add('sat');
      grid.appendChild(cell);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const key = dateKey(currentYear, currentMonth, d);
      const isToday = key === todayKey;
      const isSelected = selectedDate === key;
      const dow = (firstDay + d - 1) % 7;
      const eventCount = events[key] ? events[key].length : 0;

      const cell = createDayCell(d, false, key, eventCount);
      if (isToday) cell.classList.add('today');
      if (isSelected) cell.classList.add('selected');
      if (dow === 0) cell.classList.add('sun');
      if (dow === 6) cell.classList.add('sat');

      cell.addEventListener('click', () => selectDate(key, currentYear, currentMonth, d));
      grid.appendChild(cell);
    }

    const totalCells = firstDay + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const cell = createDayCell(i, true, null, null);
      const dow = (totalCells + i - 1) % 7;
      if (dow === 0) cell.classList.add('sun');
      if (dow === 6) cell.classList.add('sat');
      grid.appendChild(cell);
    }

    if (selectedDate) {
      const parts = selectedDate.split('-');
      renderEvents(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
  }

  function createDayCell(day, isOther, key, eventCount) {
    const cell = document.createElement('div');
    cell.className = 'day-cell' + (isOther ? ' other-month' : '');
    cell.textContent = day;

    if (eventCount > 0) {
      const dots = document.createElement('div');
      dots.className = 'dot-container';
      const count = Math.min(eventCount, 3);
      for (let i = 0; i < count; i++) {
        const dot = document.createElement('span');
        dot.className = 'event-dot';
        dots.appendChild(dot);
      }
      cell.appendChild(dots);
    }

    return cell;
  }

  function selectDate(key, y, m, d) {
    selectedDate = key;
    renderCalendar();
    renderEvents(y, m, d);
    eventSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function renderEvents(y, m, d) {
    const key = dateKey(y, m, d);
    eventDate.textContent = formatDateLabel(y, m, d);

    const events = loadEvents();
    const dayEvents = (events[key] || []).sort((a, b) => (a.time || '').localeCompare(b.time || ''));

    eventList.innerHTML = '';
    dayEvents.forEach(ev => {
      const li = document.createElement('li');
      li.className = 'event-item';
      if (ev.time) {
        const timeSpan = document.createElement('span');
        timeSpan.className = 'event-time';
        timeSpan.textContent = ev.time;
        li.appendChild(timeSpan);
      }
      const textSpan = document.createElement('span');
      textSpan.className = 'event-text';
      textSpan.textContent = ev.text;
      li.appendChild(textSpan);

      li.addEventListener('click', () => openEditModal(key, ev));
      eventList.appendChild(li);
    });

    eventSection.style.display = 'block';
  }

  function openAddModal() {
    editingEventId = null;
    modalTitle.textContent = '予定を追加';
    eventInput.value = '';
    eventTime.value = '';
    modalDelete.style.display = 'none';
    modalConfirm.textContent = '保存';
    openModal();
  }

  function openEditModal(key, ev) {
    editingEventId = { key, id: ev.id };
    modalTitle.textContent = '予定を編集';
    eventInput.value = ev.text;
    eventTime.value = ev.time || '';
    modalDelete.style.display = 'block';
    modalConfirm.textContent = '更新';
    openModal();
  }

  function openModal() {
    modalOverlay.classList.add('active');
    setTimeout(() => eventInput.focus(), 300);
  }

  function closeModal() {
    modalOverlay.classList.remove('active');
    editingEventId = null;
  }

  function saveEvent() {
    const text = eventInput.value.trim();
    if (!text) return;

    const time = eventTime.value || '';
    const events = loadEvents();

    if (editingEventId) {
      const list = events[editingEventId.key] || [];
      const idx = list.findIndex(e => e.id === editingEventId.id);
      if (idx !== -1) {
        list[idx].text = text;
        list[idx].time = time;
      }
    } else if (selectedDate) {
      if (!events[selectedDate]) events[selectedDate] = [];
      events[selectedDate].push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        text,
        time
      });
    }

    saveEvents(events);
    closeModal();
    renderCalendar();
  }

  function deleteEvent() {
    if (!editingEventId) return;
    const events = loadEvents();
    const list = events[editingEventId.key] || [];
    events[editingEventId.key] = list.filter(e => e.id !== editingEventId.id);
    if (events[editingEventId.key].length === 0) delete events[editingEventId.key];
    saveEvents(events);
    closeModal();
    renderCalendar();
  }

  prevMonth.addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    selectedDate = null;
    eventSection.style.display = 'none';
    renderCalendar();
  });

  nextMonth.addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    selectedDate = null;
    eventSection.style.display = 'none';
    renderCalendar();
  });

  addEventBtn.addEventListener('click', openAddModal);
  modalCancel.addEventListener('click', closeModal);
  modalConfirm.addEventListener('click', saveEvent);
  modalDelete.addEventListener('click', deleteEvent);
  modalOverlay.addEventListener('click', e => {
    if (e.target === modalOverlay) closeModal();
  });

  const today = new Date();
  currentYear = today.getFullYear();
  currentMonth = today.getMonth();
  const todayKey = dateKey(currentYear, currentMonth, today.getDate());
  selectedDate = todayKey;

  renderCalendar();
  renderEvents(currentYear, currentMonth, today.getDate());
})();
