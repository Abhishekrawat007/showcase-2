/*
  Recent inputs helper
  - Stores up to N recent values per field in localStorage
  - Shows last 2 as clickable suggestions when input focused
  - Keys: recent_names, recent_phones, recent_emails
*/

(function(){
  const KEYS = {
    name: 'recent_names',
    phone: 'recent_phones',
    email: 'recent_emails'
  };
  const MAX_STORE = 6;   // how many to keep in storage (rotate)
  const SHOW_COUNT = 1;  // how many to show on focus

  // helpers
  function readList(key){ try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch(e){ return []; } }
  function writeList(key, arr){ try { localStorage.setItem(key, JSON.stringify(arr.slice(0, MAX_STORE))); } catch(e){} }

  function pushRecent(key, val){
    if (!val) return;
    const list = readList(key).filter(x => x !== val);
    list.unshift(val);
    writeList(key, list);
  }

  // create/dropdown under an input
  function makeDropdown(items){
    const el = document.createElement('div');
    el.className = 'recent-suggestions hidden';
    items.forEach((it, idx) => {
      const item = document.createElement('div');
      item.tabIndex = 0;
      item.className = 'suggestion';
      item.textContent = it;
      item.dataset.val = it;
      el.appendChild(item);
    });
    document.body.appendChild(el);
    return el;
  }

  function attachToInput(inputEl, typeKey){
    // wrap input in .input-wrapper if not already so absolute dropdown can position easily
    if (!inputEl.parentElement.classList.contains('input-wrapper')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'input-wrapper';
      inputEl.parentElement.insertBefore(wrapper, inputEl);
      wrapper.appendChild(inputEl);
    }

    let dropdown = null;

    function positionDropdown() {
      if (!dropdown) return;
      const rect = inputEl.getBoundingClientRect();
      dropdown.style.minWidth = Math.max(rect.width, 180) + 'px';
      dropdown.style.left = (rect.left + window.scrollX) + 'px';
      dropdown.style.top = (rect.bottom + window.scrollY + 6) + 'px';
    }

    function showDropdown() {
      const key = KEYS[typeKey];
      const list = readList(key) || [];
      const toShow = list.slice(0, SHOW_COUNT);
      if (!toShow.length) {
        hideDropdown();
        return;
      }
      if (!dropdown) dropdown = makeDropdown(toShow);
      // replace contents
      dropdown.innerHTML = '';
      toShow.forEach(s => {
        const item = document.createElement('div');
        item.tabIndex = 0;
        item.className = 'suggestion';
        item.textContent = s;
        item.dataset.val = s;
        dropdown.appendChild(item);
      });

      // click handler (delegated)
      dropdown.onclick = (ev) => {
        const t = ev.target.closest && ev.target.closest('.suggestion');
        if (!t) return;
        inputEl.value = t.dataset.val || t.textContent;
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        hideDropdown();
        inputEl.focus();
      };
      // keyboard select
      dropdown.onkeydown = (ev) => {
        const active = document.activeElement;
        if (ev.key === 'Escape') { hideDropdown(); inputEl.focus(); }
      };

      dropdown.classList.remove('hidden');
      positionDropdown();
      // allow reposition on scroll/resize
      window.addEventListener('resize', positionDropdown);
      window.addEventListener('scroll', positionDropdown, true);
    }

    function hideDropdown(){
      if (!dropdown) return;
      dropdown.classList.add('hidden');
      // detach handlers
      window.removeEventListener('resize', positionDropdown);
      window.removeEventListener('scroll', positionDropdown, true);
    }

    // Show suggestions on focus if present
    inputEl.addEventListener('focus', (e) => {
      // only show when input is empty or partially filled (user asked for click assistance)
      const val = (inputEl.value || '').trim();
      if (val.length === 0) {
        showDropdown();
      } else {
        // still show — filter suggestions by typed prefix
        const key = KEYS[typeKey];
        const list = readList(key).filter(x => x.toLowerCase().indexOf(val.toLowerCase()) === 0).slice(0, SHOW_COUNT);
        if (!list.length) hideDropdown();
        else {
          if (!dropdown) dropdown = makeDropdown(list);
          dropdown.innerHTML = '';
          list.forEach(s => {
            const item = document.createElement('div');
            item.tabIndex = 0;
            item.className = 'suggestion';
            item.textContent = s;
            item.dataset.val = s;
            dropdown.appendChild(item);
          });
          dropdown.classList.remove('hidden');
          positionDropdown();
        }
      }
    });

    // hide on blur (small delay so click can register)
    inputEl.addEventListener('blur', () => {
      setTimeout(hideDropdown, 150);
    });

    // pressing down arrow focuses first suggestion
    inputEl.addEventListener('keydown', (ev) => {
      if ((ev.key === 'ArrowDown' || ev.key === 'Down') && dropdown && !dropdown.classList.contains('hidden')) {
        const first = dropdown.querySelector('.suggestion');
        if (first) first.focus();
        ev.preventDefault();
      }
    });

    // when user types, update dropdown to match prefix
    inputEl.addEventListener('input', () => {
      const val = (inputEl.value || '').trim();
      const key = KEYS[typeKey];
      const list = readList(key).filter(x => x.toLowerCase().indexOf(val.toLowerCase()) === 0).slice(0, SHOW_COUNT);
      if (!list.length) hideDropdown();
      else {
        if (!dropdown) dropdown = makeDropdown(list);
        dropdown.innerHTML = '';
        list.forEach(s => {
          const item = document.createElement('div');
          item.tabIndex = 0;
          item.className = 'suggestion';
          item.textContent = s;
          item.dataset.val = s;
          dropdown.appendChild(item);
        });
        dropdown.classList.remove('hidden');
        positionDropdown();
      }
    });
  }

  // Save values on successful order and also on blur (if valid)
  function wireSaveOnEvents(){
    function trySaveForInput(id, typeKey){
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('blur', () => {
        const val = (el.value || '').trim();
        if (!val) return;
        // basic validation for phone/email
        if (typeKey === 'phone') {
          if (!/^[6-9]\d{9}$/.test(val)) return;
        }
        if (typeKey === 'email') {
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return;
        }
        pushRecent(KEYS[typeKey], val);
      });
    }
    trySaveForInput('customerName', 'name');
    trySaveForInput('customerPhone', 'phone');
    trySaveForInput('customerEmail', 'email');
  }

  // Public init: call after your replacePaymentFormHTML() is executed and inputs exist in DOM
  window.attachRecentInputs = function attachRecentInputs(){
    // attach to DOM input ids used in your form
    const nameEl = document.getElementById('customerName');
    const phoneEl = document.getElementById('customerPhone');
    const emailEl = document.getElementById('customerEmail');

    if (nameEl) attachToInput(nameEl, 'name');
    if (phoneEl) attachToInput(phoneEl, 'phone');
    if (emailEl) attachToInput(emailEl, 'email');

    wireSaveOnEvents();
  };

  // convenience: if you call attachRecentInputs() before elements exist, retry shortly
  window.__attachRecentRetry = function(){
    setTimeout(() => {
      if (document.getElementById('customerName') && typeof window.attachRecentInputs === 'function') {
        window.attachRecentInputs();
      }
    }, 120);
  };

})();