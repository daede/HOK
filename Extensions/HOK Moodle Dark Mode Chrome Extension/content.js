(function () {
    'use strict';

    const STORAGE_KEY = 'weblearn-darkmode';
    const TOGGLE_ID = 'weblearn-darkmode-toggle';
    const DARK_LOGO_PATH = 'images/hok-logo-inverted.png';

    // 1. Apply saved state immediately to prevent white flash
    if (localStorage.getItem(STORAGE_KEY) === 'enabled') {
        document.documentElement.classList.add('darkmode');
    }

    // 2. Helper to update button icon state
    function updateIcon(button, isDark) {
        const icon = button.querySelector('i');
        if (icon) {
            icon.className = isDark ? 'fa fa-sun-o fa-fw' : 'fa fa-moon-o fa-fw';
        }
    }

    // 3. Swap local logo on theme toggle
    function updateLogo(isDark) {
        const logoImgs = document.querySelectorAll('.navbar-brand img, .logo img, .site-name img, [data-region="logo"] img');
        logoImgs.forEach(img => {
            if (isDark) {
                if (!img.dataset.originalSrc) {
                    img.dataset.originalSrc = img.src;
                }
                img.src = chrome.runtime.getURL(DARK_LOGO_PATH);
            } else {
                if (img.dataset.originalSrc) {
                    img.src = img.dataset.originalSrc;
                }
            }
        });
    }

    // 4. Inject toggle button into Moodle footer
    function injectToggle() {
        if (document.getElementById(TOGGLE_ID)) return;

        const container = document.querySelector('#boost-union-footer-buttons') 
                       || document.querySelector('[data-region="footer-container-popover"]');

        if (!container) return;

        const isDark = document.documentElement.classList.contains('darkmode');

        if (isDark) {
            updateLogo(true);
        }

        const button = document.createElement('button');
        button.id = TOGGLE_ID;
        button.className = 'btn btn-icon bg-secondary icon-no-margin d-print-none';
        button.setAttribute('type', 'button');
        button.setAttribute('aria-label', 'Darkmode umschalten');
        button.setAttribute('title', 'Darkmode umschalten');
        button.innerHTML = `<i class="fa ${isDark ? 'fa-sun-o' : 'fa-moon-o'} fa-fw" aria-hidden="true"></i>`;

        button.addEventListener('click', function (e) {
            e.preventDefault();
            const darkActive = document.documentElement.classList.toggle('darkmode');
            localStorage.setItem(STORAGE_KEY, darkActive ? 'enabled' : 'disabled');
            updateIcon(button, darkActive);
            updateLogo(darkActive);
        });

        container.appendChild(button);
    }

    // 5. Observe DOM for footer rendering
    function startObserver() {
        injectToggle();

        const observer = new MutationObserver(function () {
            if (!document.getElementById(TOGGLE_ID)) {
                injectToggle();
            }
        });

        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserver);
    } else {
        startObserver();
    }
})();