// js/safe-storage.js - Optimized version with caching
(function() {
  if (window.safeStorage) return;
  
  let storageMethod = null; // Cache the working method
  
  const detectStorage = () => {
    if (storageMethod) return storageMethod; // Return cached method
    
    try {
      localStorage.setItem('_test', '1');
      localStorage.removeItem('_test');
      storageMethod = 'localStorage';
      return 'localStorage';
    } catch (e) {
      try {
        sessionStorage.setItem('_test', '1');
        sessionStorage.removeItem('_test');
        storageMethod = 'sessionStorage';
        return 'sessionStorage';
      } catch (e2) {
        storageMethod = 'memory';
        return 'memory';
      }
    }
  };
  
  window.safeStorage = {
    getItem: (key) => {
      const method = detectStorage();
      if (method === 'localStorage') return localStorage.getItem(key);
      if (method === 'sessionStorage') return sessionStorage.getItem(key);
      return window._tempStorage?.[key] || null;
    },
    setItem: (key, value) => {
      const method = detectStorage();
      if (method === 'localStorage') {
        localStorage.setItem(key, value);
        return true;
      }
      if (method === 'sessionStorage') {
        sessionStorage.setItem(key, value);
        return true;
      }
      if (!window._tempStorage) window._tempStorage = {};
      window._tempStorage[key] = value;
      return true;
    }
  };
})();