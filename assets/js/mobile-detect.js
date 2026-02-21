/**
 * Mobile Detection and Redirect System
 * Automatically redirects mobile users to optimized mobile pages
 */

(function() {
  'use strict';

  const MOBILE_BREAKPOINT = 768;
  const FORCE_DESKTOP_KEY = 'fwf_force_desktop';
  const MOBILE_PREFIX = 'm';

  /**
   * Check if device is mobile based on screen width and user agent
   */
  function isMobileDevice() {
    const width = window.innerWidth || document.documentElement.clientWidth;
    const userAgent = navigator.userAgent.toLowerCase();
    
    // Check screen width
    const isMobileWidth = width <= MOBILE_BREAKPOINT;
    
    // Check user agent for mobile indicators
    const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i;
    const isMobileUA = mobileRegex.test(userAgent);
    
    return isMobileWidth || isMobileUA;
  }

  /**
   * Check if user has forced desktop version
   */
  function isDesktopForced() {
    try {
      return sessionStorage.getItem(FORCE_DESKTOP_KEY) === 'true';
    } catch(e) {
      return false;
    }
  }

  /**
   * Force desktop version
   */
  function forceDesktopVersion() {
    try {
      sessionStorage.setItem(FORCE_DESKTOP_KEY, 'true');
      // Redirect to desktop version
      const mobilePath = window.location.pathname;
      if (mobilePath.includes(`/${MOBILE_PREFIX}/`)) {
        const desktopPath = mobilePath.replace(`/${MOBILE_PREFIX}/`, '/');
        window.location.href = desktopPath + window.location.search + window.location.hash;
      }
    } catch(e) {
      console.error('Could not force desktop version:', e);
    }
  }

  /**
   * Get mobile version of current page
   */
  function getMobilePagePath() {
    const path = window.location.pathname;
    const filename = path.split('/').pop() || 'index.html';
    
    // Don't redirect if already on mobile version
    if (path.includes(`/${MOBILE_PREFIX}/`)) {
      return null;
    }
    
    // List of pages that have mobile versions
    const mobilePages = [
      'index.html',
      'join.html',
      'donation.html',
      'projects.html',
      'member-login.html'
    ];
    
    // Check if current page has mobile version
    if (filename === '' || filename === '/' || mobilePages.includes(filename)) {
      const mobilePath = filename === '' || filename === '/' ? 
        `/${MOBILE_PREFIX}/index.html` : 
        `/${MOBILE_PREFIX}/${filename}`;
      return mobilePath + window.location.search + window.location.hash;
    }
    
    return null;
  }

  /**
   * Redirect to mobile version if needed
   */
  function redirectToMobile() {
    // Skip redirect if:
    // 1. Not a mobile device
    // 2. User forced desktop version
    // 3. Already on mobile version
    if (!isMobileDevice() || isDesktopForced()) {
      return;
    }

    const mobilePath = getMobilePagePath();
    if (mobilePath) {
      window.location.href = mobilePath;
    }
  }

  /**
   * Initialize mobile detection
   */
  function init() {
    // Add CSS class to body
    if (isMobileDevice()) {
      document.documentElement.classList.add('is-mobile-device');
    }

    // Expose public API
    window.FWF_Mobile = {
      isMobile: isMobileDevice,
      forceDesktop: forceDesktopVersion,
      redirect: redirectToMobile
    };

    // Auto-redirect on page load (unless user opts out)
    if (!window.FWF_MOBILE_NO_REDIRECT) {
      redirectToMobile();
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
