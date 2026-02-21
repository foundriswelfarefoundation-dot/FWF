/**
 * Lazy Loading for Images and Resources
 * Improves mobile performance by loading images only when needed
 */

(function() {
  'use strict';

  // Check for native lazy loading support
  const supportsNativeLazyLoading = 'loading' in HTMLImageElement.prototype;

  /**
   * Intersection Observer for lazy loading
   */
  let observer;

  function createObserver() {
    if (!('IntersectionObserver' in window)) {
      // Fallback: load all images immediately
      loadAllImages();
      return;
    }

    observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const element = entry.target;
          loadElement(element);
          obs.unobserve(element);
        }
      });
    }, {
      // Load images slightly before they enter viewport
      rootMargin: '50px',
      threshold: 0.01
    });
  }

  /**
   * Load an element (image, iframe, etc.)
   */
  function loadElement(element) {
    if (element.tagName === 'IMG') {
      loadImage(element);
    } else if (element.tagName === 'IFRAME') {
      loadIframe(element);
    } else if (element.hasAttribute('data-bg')) {
      loadBackground(element);
    }
  }

  /**
   * Load an image
   */
  function loadImage(img) {
    const src = img.getAttribute('data-src');
    const srcset = img.getAttribute('data-srcset');

    if (!src) return;

    // Create a new image to preload
    const newImg = new Image();
    
    newImg.onload = function() {
      img.src = src;
      if (srcset) {
        img.srcset = srcset;
      }
      img.classList.add('loaded');
      img.removeAttribute('data-src');
      img.removeAttribute('data-srcset');
    };

    newImg.onerror = function() {
      console.error('Failed to load image:', src);
      img.classList.add('error');
    };

    // Start loading
    if (srcset) {
      newImg.srcset = srcset;
    }
    newImg.src = src;
  }

  /**
   * Load an iframe
   */
  function loadIframe(iframe) {
    const src = iframe.getAttribute('data-src');
    if (src) {
      iframe.src = src;
      iframe.removeAttribute('data-src');
    }
  }

  /**
   * Load a background image
   */
  function loadBackground(element) {
    const bg = element.getAttribute('data-bg');
    if (bg) {
      element.style.backgroundImage = `url('${bg}')`;
      element.removeAttribute('data-bg');
      element.classList.add('loaded');
    }
  }

  /**
   * Fallback: load all images immediately
   */
  function loadAllImages() {
    document.querySelectorAll('[data-src], [data-bg]').forEach(element => {
      loadElement(element);
    });
  }

  /**
   * Observe elements for lazy loading
   */
  function observeElements() {
    if (!observer) return;

    const elements = document.querySelectorAll('[data-src], [data-bg]');
    elements.forEach(element => {
      observer.observe(element);
    });
  }

  /**
   * Initialize lazy loading
   */
  function init() {
    // If native lazy loading is supported and all images have loading="lazy",
    // we don't need to do anything
    if (supportsNativeLazyLoading) {
      console.log('Using native lazy loading');
      
      // Still handle background images
      const bgElements = document.querySelectorAll('[data-bg]');
      if (bgElements.length > 0) {
        createObserver();
        bgElements.forEach(el => observer?.observe(el));
      }
      return;
    }

    // Use Intersection Observer for lazy loading
    createObserver();
    observeElements();
  }

  /**
   * Public API
   */
  window.FWF_LazyLoad = {
    init: init,
    observe: observeElements,
    loadAll: loadAllImages
  };

  // Auto-initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-observe on dynamic content changes
  const mutationObserver = new MutationObserver(() => {
    if (observer) {
      setTimeout(observeElements, 100);
    }
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true
  });

})();

/**
 * Usage Instructions:
 * 
 * For Images:
 * <img data-src="actual-image.jpg" 
 *      src="placeholder.jpg" 
 *      alt="Description"
 *      loading="lazy"
 *      class="lazy" />
 * 
 * For Background Images:
 * <div data-bg="background-image.jpg" 
 *      class="lazy-bg">
 *   Content
 * </div>
 * 
 * For Iframes:
 * <iframe data-src="https://example.com/video" 
 *         class="lazy"
 *         loading="lazy"></iframe>
 * 
 * CSS for smooth loading:
 * .lazy {
 *   opacity: 0;
 *   transition: opacity 0.3s;
 * }
 * .lazy.loaded {
 *   opacity: 1;
 * }
 */
