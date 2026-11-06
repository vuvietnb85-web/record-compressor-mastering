/*!
 * VXO Binance Referral Kit (vanilla IIFE)
 * Drop-in affiliate / Earn Together Refer2Earn USDC CTA for static PWAs.
 * Not an official Binance product. Referral link of the app owner only.
 */
(function (global) {
  'use strict';

  var DEFAULT_REF_URL =
    'https://www.binance.com/referral/earn-together/refer2earn-usdc/claim?hl=vi&ref=GRO_28502_L7QT6&utm_source=referral_entrance';
  var DEFAULT_REF_CODE = 'GRO_28502_L7QT6';
  var LS_KEY = 'vxo_binance_ref_clicks';
  var STYLE_ID = 'vxo-binance-ref-runtime';
  var ROOT_ID = 'vxo-bn-root';

  var cfg = Object.assign(
    {
      refUrl: DEFAULT_REF_URL,
      refCode: DEFAULT_REF_CODE,
      utmCampaign: '',
      mount: 'fab', // 'fab' | 'inline' | 'both'
      locale: 'vi',
      theme: 'dark', // 'dark' | 'auto'
      fabLabel: 'Earn · Binance',
      fabPosition: 'bottom-left', // bottom-left | bottom-right | top-right | top-left
      headline: 'Mời bạn bè mở Binance · cùng nhận voucher USDC theo chương trình Earn Together',
      lead:
        'Link giới thiệu chính thức của người dùng (không phải đối tác chính thức Binance). Phần thưởng theo trang Binance tại thời điểm mở link — có thể thay đổi.',
      primaryLabel: 'Mở trang Earn Together',
      copyLabel: 'Sao chép link',
      shareLabel: 'Chia sẻ',
      container: '#vxo-binance-ref',
      showFab: true
    },
    global.__VXO_BINANCE_REF__ || {}
  );

  function buildUrl() {
    var url = String(cfg.refUrl || DEFAULT_REF_URL);
    if (!cfg.utmCampaign) return url;
    try {
      var u = new URL(url);
      u.searchParams.set('utm_campaign', String(cfg.utmCampaign));
      return u.toString();
    } catch (e) {
      return url;
    }
  }

  function track(action) {
    try {
      var raw = localStorage.getItem(LS_KEY);
      var data = raw ? JSON.parse(raw) : { total: 0, byAction: {} };
      data.total = (data.total || 0) + 1;
      data.byAction = data.byAction || {};
      data.byAction[action] = (data.byAction[action] || 0) + 1;
      data.lastAt = new Date().toISOString();
      localStorage.setItem(LS_KEY, JSON.stringify(data));
    } catch (e) {}
    try {
      if (global.dataLayer && typeof global.dataLayer.push === 'function') {
        global.dataLayer.push({
          event: 'vxo_binance_ref',
          vxo_action: action,
          vxo_ref_code: cfg.refCode || DEFAULT_REF_CODE
        });
      }
    } catch (e2) {}
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'className') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k.indexOf('on') === 0 && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else node.setAttribute(k, v === true ? '' : String(v));
      });
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function toast(msg) {
    var t = document.querySelector('.vxo-bn-toast');
    if (!t) {
      t = el('div', { className: 'vxo-bn-toast', role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('is-show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      t.classList.remove('is-show');
    }, 2200);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = el('textarea', { 'aria-hidden': 'true' });
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        document.body.removeChild(ta);
        resolve();
      } catch (err) {
        document.body.removeChild(ta);
        reject(err);
      }
    });
  }

  function applyTheme() {
    var root = document.documentElement;
    if (cfg.theme === 'auto') root.setAttribute('data-vxo-bn-theme', 'auto');
    else root.removeAttribute('data-vxo-bn-theme');
  }

  var state = {
    open: false,
    lastFocus: null,
    root: null,
    backdrop: null,
    sheet: null,
    fab: null
  };

  function focusables(container) {
    return Array.prototype.slice.call(
      container.querySelectorAll(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      )
    );
  }

  function openPanel() {
    if (!state.sheet || !state.backdrop) return;
    state.lastFocus = document.activeElement;
    state.open = true;
    state.backdrop.classList.add('is-open');
    state.sheet.classList.add('is-open');
    state.backdrop.setAttribute('aria-hidden', 'false');
    state.sheet.setAttribute('aria-hidden', 'false');
    var closeBtn = state.sheet.querySelector('.vxo-bn-sheet__close');
    if (closeBtn) closeBtn.focus();
    track('open');
  }

  function closePanel() {
    if (!state.sheet || !state.backdrop) return;
    state.open = false;
    state.backdrop.classList.remove('is-open');
    state.sheet.classList.remove('is-open');
    state.backdrop.setAttribute('aria-hidden', 'true');
    state.sheet.setAttribute('aria-hidden', 'true');
    if (state.lastFocus && state.lastFocus.focus) {
      try {
        state.lastFocus.focus();
      } catch (e) {}
    }
    track('close');
  }

  function onKeydown(e) {
    if (!state.open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closePanel();
      return;
    }
    if (e.key !== 'Tab' || !state.sheet) return;
    var list = focusables(state.sheet);
    if (!list.length) return;
    var first = list[0];
    var last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function openReferral() {
    var url = buildUrl();
    track('open_link');
    global.open(url, '_blank', 'noopener,noreferrer');
  }

  function copyReferral() {
    var url = buildUrl();
    track('copy');
    copyText(url)
      .then(function () {
        toast('Đã sao chép link giới thiệu');
      })
      .catch(function () {
        toast('Không sao chép được — hãy mở link rồi copy thủ công');
      });
  }

  function shareReferral() {
    var url = buildUrl();
    track('share');
    if (navigator.share) {
      navigator
        .share({
          title: 'Binance Earn Together',
          text: 'Mời bạn mở Binance qua link giới thiệu Earn Together (Refer2Earn USDC). Phần thưởng theo điều kiện Binance.',
          url: url
        })
        .catch(function () {});
      return;
    }
    copyReferral();
  }

  function buildPanelContent(isCard) {
    var wrap = el('div', { className: isCard ? 'vxo-bn-card' : '' });

    if (!isCard) {
      wrap.appendChild(el('div', { className: 'vxo-bn-sheet__handle', 'aria-hidden': 'true' }));
    }

    var header = el('div', { className: 'vxo-bn-sheet__header' }, [
      el('div', { className: 'vxo-bn-sheet__mark', 'aria-hidden': 'true' }),
      el('div', { className: 'vxo-bn-sheet__titles' }, [
        el('p', { className: 'vxo-bn-sheet__eyebrow', text: 'Link giới thiệu · Earn Together' }),
        el('h2', {
          className: 'vxo-bn-sheet__title',
          id: isCard ? 'vxo-bn-card-title' : 'vxo-bn-sheet-title',
          text: cfg.headline
        })
      ])
    ]);

    if (!isCard) {
      header.appendChild(
        el('button', {
          type: 'button',
          className: 'vxo-bn-sheet__close',
          'aria-label': 'Đóng bảng giới thiệu Binance',
          text: '×',
          onClick: closePanel
        })
      );
    }

    wrap.appendChild(header);

    var body = el('div', { className: 'vxo-bn-sheet__body' }, [
      el('div', { className: 'vxo-bn-pill', text: 'Lite Mode · Refer2Earn USDC' }),
      el('p', { className: 'vxo-bn-lead', text: cfg.lead }),
      el('ol', { className: 'vxo-bn-steps' }, [
        el('li', null, [
          el('span', { className: 'vxo-bn-steps__n', text: '1' }),
          el('div', null, [
            el('p', { className: 'vxo-bn-steps__t', text: 'Đăng ký qua link giới thiệu' }),
            el('p', {
              className: 'vxo-bn-steps__d',
              text: 'Mở trang Binance bằng nút bên dưới (ref ' + (cfg.refCode || DEFAULT_REF_CODE) + ').'
            })
          ])
        ]),
        el('li', null, [
          el('span', { className: 'vxo-bn-steps__n', text: '2' }),
          el('div', null, [
            el('p', { className: 'vxo-bn-steps__t', text: 'Hoàn thành nhiệm vụ trên trang Binance' }),
            el('p', {
              className: 'vxo-bn-steps__d',
              text: 'Các bước KYC / nhiệm vụ hiển thị trên trang Earn Together — làm đúng theo hướng dẫn sàn.'
            })
          ])
        ]),
        el('li', null, [
          el('span', { className: 'vxo-bn-steps__n', text: '3' }),
          el('div', null, [
            el('p', { className: 'vxo-bn-steps__t', text: 'Nhận thưởng theo điều kiện sàn' }),
            el('p', {
              className: 'vxo-bn-steps__d',
              text: 'Voucher / USDC (nếu đủ điều kiện) theo trang Binance tại thời điểm mở link — không cam kết số tiền cố định.'
            })
          ])
        ])
      ]),
      el('div', { className: 'vxo-bn-actions' }, [
        el('button', {
          type: 'button',
          className: 'vxo-bn-btn vxo-bn-btn--primary',
          text: cfg.primaryLabel,
          'aria-label': 'Mở liên kết giới thiệu Binance Earn Together trong tab mới',
          onClick: openReferral
        }),
        el('div', { className: 'vxo-bn-btn-row' }, [
          el('button', {
            type: 'button',
            className: 'vxo-bn-btn vxo-bn-btn--ghost',
            text: cfg.copyLabel,
            onClick: copyReferral
          }),
          el('button', {
            type: 'button',
            className: 'vxo-bn-btn vxo-bn-btn--ghost',
            text: cfg.shareLabel,
            onClick: shareReferral
          })
        ])
      ]),
      (function () {
        var fine = el('p', { className: 'vxo-bn-fine' });
        fine.innerHTML =
          '<strong>Lưu ý:</strong> Đây là liên kết tiếp thị / referral. Không phải lời khuyên đầu tư. Giao dịch tiền số có rủi ro mất vốn. ' +
          'Phần thưởng do Binance quy định và có thể thay đổi; khu vực bị hạn chế có thể không đủ điều kiện. ' +
          'Chương trình Earn Together (Lite Mode) thường là thưởng theo nhiệm vụ / một lần — giao dịch sau của người được mời <em>có thể không</em> tạo hoa hồng liên tục. ' +
          'Không phải sản phẩm đối tác chính thức của Binance.';
        return fine;
      })(),
      el('p', {
        className: 'vxo-bn-refcode',
        text: 'Mã ref: ' + (cfg.refCode || DEFAULT_REF_CODE)
      })
    ]);

    wrap.appendChild(body);
    return wrap;
  }

  function ensureCssHint() {
    if (document.getElementById(STYLE_ID)) return;
    // Runtime does not inject full CSS; host page should link vxo-binance-ref.css.
    // Soft warning for missing stylesheet (dev aid).
    var linked = Array.prototype.some.call(document.styleSheets || [], function (s) {
      try {
        return s.href && String(s.href).indexOf('vxo-binance-ref.css') !== -1;
      } catch (e) {
        return false;
      }
    });
    if (!linked && global.console && console.info) {
      console.info('[VXO Binance Ref] Hãy gắn stylesheet vxo-binance-ref.css để có giao diện đầy đủ.');
    }
  }

  function mountFab() {
    if (cfg.showFab === false && cfg.mount === 'inline') return;
    if (cfg.mount === 'inline') return;
    var pos = String(cfg.fabPosition || 'bottom-left').toLowerCase();
    var posClass = '';
    if (pos === 'bottom-right' || pos === 'br') posClass = ' vxo-bn-fab--br';
    else if (pos === 'top-right' || pos === 'tr') posClass = ' vxo-bn-fab--tr';
    else if (pos === 'top-left' || pos === 'tl') posClass = ' vxo-bn-fab--tl';
    var fab = el(
      'button',
      {
        type: 'button',
        className: 'vxo-bn-fab' + posClass,
        'aria-haspopup': 'dialog',
        'aria-controls': 'vxo-bn-sheet',
        'aria-label': 'Mở bảng giới thiệu Binance Earn Together',
        onClick: openPanel
      },
      [
        el('span', { className: 'vxo-bn-fab__icon', 'aria-hidden': 'true' }),
        el('span', { text: cfg.fabLabel }),
        el('span', { className: 'vxo-bn-fab__badge', 'aria-hidden': 'true' })
      ]
    );
    document.body.appendChild(fab);
    state.fab = fab;
  }

  function mountSheet() {
    var backdrop = el('div', {
      className: 'vxo-bn-backdrop',
      'aria-hidden': 'true',
      onClick: closePanel
    });
    var sheet = el('div', {
      id: 'vxo-bn-sheet',
      className: 'vxo-bn-sheet',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'vxo-bn-sheet-title',
      'aria-hidden': 'true'
    });
    sheet.appendChild(buildPanelContent(false));
    document.body.appendChild(backdrop);
    document.body.appendChild(sheet);
    state.backdrop = backdrop;
    state.sheet = sheet;
  }

  function mountInline() {
    if (cfg.mount !== 'inline' && cfg.mount !== 'both') return;
    var host = null;
    try {
      host = document.querySelector(cfg.container || '#vxo-binance-ref');
    } catch (e) {
      host = null;
    }
    if (!host) return;
    host.innerHTML = '';
    host.appendChild(buildPanelContent(true));
  }

  function init() {
    if (document.getElementById(ROOT_ID)) return;
    applyTheme();
    ensureCssHint();
    var root = el('div', { id: ROOT_ID });
    document.body.appendChild(root);
    state.root = root;

    if (cfg.mount === 'fab' || cfg.mount === 'both' || !cfg.mount) {
      mountSheet();
      mountFab();
    }
    if (cfg.mount === 'inline' || cfg.mount === 'both') {
      mountInline();
      if (cfg.mount === 'both') {
        /* sheet already mounted */
      } else if (cfg.mount === 'inline' && cfg.showFab) {
        mountSheet();
        mountFab();
      }
    }

    document.addEventListener('keydown', onKeydown);
  }

  function destroy() {
    document.removeEventListener('keydown', onKeydown);
    if (state.fab && state.fab.parentNode) state.fab.parentNode.removeChild(state.fab);
    if (state.backdrop && state.backdrop.parentNode) state.backdrop.parentNode.removeChild(state.backdrop);
    if (state.sheet && state.sheet.parentNode) state.sheet.parentNode.removeChild(state.sheet);
    var root = document.getElementById(ROOT_ID);
    if (root && root.parentNode) root.parentNode.removeChild(root);
    state = { open: false, lastFocus: null, root: null, backdrop: null, sheet: null, fab: null };
  }

  var api = {
    open: openPanel,
    close: closePanel,
    openReferral: openReferral,
    copyReferral: copyReferral,
    shareReferral: shareReferral,
    getUrl: buildUrl,
    getConfig: function () {
      return Object.assign({}, cfg);
    },
    destroy: destroy,
    version: '1.1.0'
  };

  global.VxoBinanceRef = api;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : this);
