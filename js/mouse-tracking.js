(function () {
  'use strict';

  const elementState = new WeakMap();
  const docState = { rafId: 0, x: 0, y: 0, root: null };

  function setPercentVars(element, x, y) {
    element.style.setProperty('--x', x + '%');
    element.style.setProperty('--y', y + '%');
  }

  function setPixelVars(element, x, y) {
    element.style.setProperty('--x', x + 'px');
    element.style.setProperty('--y', y + 'px');
  }

  function scheduleElementUpdate(e, element) {
    if (!element) return;
    const state = elementState.get(element) || { rafId: 0, x: 0, y: 0 };
    state.x = e.clientX;
    state.y = e.clientY;
    if (!state.rafId) {
      state.rafId = requestAnimationFrame(() => {
        state.rafId = 0;
        const rect = element.getBoundingClientRect();
        const x = ((state.x - rect.left) / rect.width) * 100;
        const y = ((state.y - rect.top) / rect.height) * 100;
        setPercentVars(element, x, y);
      });
    }
    elementState.set(element, state);
  }

  function bindElement(element, options) {
    if (!element) return () => {};
    const opts = options || {};
    const resetOnLeave = opts.resetOnLeave !== false;
    const initVars = opts.init !== false;

    if (initVars) {
      setPercentVars(element, 50, 50);
    }

    const moveHandler = (e) => scheduleElementUpdate(e, element);
    element.addEventListener('mousemove', moveHandler, { passive: true });

    let leaveHandler = null;
    if (resetOnLeave) {
      leaveHandler = () => setPercentVars(element, 50, 50);
      element.addEventListener('mouseleave', leaveHandler, { passive: true });
    }

    return () => {
      element.removeEventListener('mousemove', moveHandler);
      if (leaveHandler) {
        element.removeEventListener('mouseleave', leaveHandler);
      }
    };
  }

  function bindElements(elements, options) {
    if (!elements) return [];
    const list = Array.from(elements);
    return list.map((el) => bindElement(el, options));
  }

  function bindDelegated(container, selector, options) {
    if (!container) return () => {};
    const opts = options || {};
    const resetOnLeave = opts.resetOnLeave !== false;

    const moveHandler = (e) => {
      const target = e.target && e.target.closest ? e.target.closest(selector) : null;
      if (target && container.contains(target)) {
        scheduleElementUpdate(e, target);
      }
    };

    const outHandler = resetOnLeave
      ? (e) => {
          const target = e.target && e.target.closest ? e.target.closest(selector) : null;
          if (!target || !container.contains(target)) return;
          const related = e.relatedTarget;
          if (related && target.contains(related)) return;
          setPercentVars(target, 50, 50);
        }
      : null;

    container.addEventListener('mousemove', moveHandler, { passive: true });
    if (outHandler) {
      container.addEventListener('mouseout', outHandler, { passive: true });
    }

    return () => {
      container.removeEventListener('mousemove', moveHandler);
      if (outHandler) {
        container.removeEventListener('mouseout', outHandler);
      }
    };
  }

  function bindDocumentRoot(rootElement) {
    const root = rootElement || document.documentElement;
    if (!root) return () => {};

    const moveHandler = (e) => {
      docState.x = e.clientX;
      docState.y = e.clientY;
      if (!docState.rafId) {
        docState.rafId = requestAnimationFrame(() => {
          docState.rafId = 0;
          setPixelVars(root, docState.x, docState.y);
        });
      }
      docState.root = root;
    };

    document.addEventListener('mousemove', moveHandler, { passive: true });

    return () => {
      document.removeEventListener('mousemove', moveHandler);
      if (docState.root === root) {
        docState.root = null;
      }
    };
  }

  window.NexoraMouseTracking = {
    bindElement,
    bindElements,
    bindDelegated,
    bindDocumentRoot
  };
})();
