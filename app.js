/* ============================================================
   SVEvents – gemeinsame Funktionen für alle Seiten
   Jede Seite ruft SV.start({ page, roles }) auf. Das prüft Login und
   Rolle, baut die Navigation und gibt { me, sb } zurück.
   ============================================================ */
(function () {
  'use strict';

  const cfg = window.SV_CONFIG || {};
  const configured = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) &&
    !/DEIN-/.test(String(cfg.SUPABASE_URL) + String(cfg.SUPABASE_ANON_KEY));
  const sb = configured && window.supabase
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;

  // ---------- kleine Helfer ----------
  const $ = (id) => document.getElementById(id);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const dtf = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const df = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const tf = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' });
  const eur = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
  const fmt = (d) => (d ? dtf.format(new Date(d)) : '');
  const fmtDay = (d) => (d ? df.format(new Date(d)) : '');
  const fmtTime = (d) => (d ? tf.format(new Date(d)) : '');
  const money = (n) => eur.format(Number(n) || 0);

  function toLocalInput(iso, withSeconds) {
    if (!iso) return '';
    const d = new Date(iso);
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + (withSeconds ? ':' + p(d.getSeconds()) : '');
  }
  const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* egal */ } }
  };

  // Admin oder Mitarbeiter. Was ein Mitarbeiter darf, bestimmen seine Zuweisungen (caps).
  const ROLE_LABEL = { admin: 'Admin', seller: 'Mitarbeiter', scanner: 'Mitarbeiter' };
    // need: 'admin' = nur Admins; sonst das Recht, das ein Mitarbeiter haben muss
  const NAV = [
    { id: 'cockpit', href: 'cockpit.html', label: 'Cockpit', need: 'admin', group: 'Heute', icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z' },
    { id: 'verkauf', href: 'verkauf.html', label: 'Ticketverkauf', short: 'Verkauf', need: 'sell', group: 'Heute', icon: 'M2 9V6a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6z' },
    { id: 'einlass', href: 'einlass.html', label: 'Einlass', need: 'scan', group: 'Heute', icon: 'M4 4h6v2H6v4H4V4zm10 0h6v6h-2V6h-4V4zM4 14h2v4h4v2H4v-6zm14 0h2v6h-6v-2h4v-4zM8 8h8v8H8V8z' },
    { id: 'schicht', href: 'schicht.html', label: 'Meine Schicht', short: 'Schicht', need: 'stations', staffOnly: true, group: 'Heute', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 5v5.4l3.5 2.1-1 1.7L11 13V7h2z' },
    { id: 'events', href: 'events.html', label: 'Events', need: 'admin', group: 'Planung', icon: 'M7 2v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2H7zm-2 8h14v10H5V10z' },
    { id: 'kontrolle', href: 'kontrolle.html', label: 'Kontrolle', need: 'admin', group: 'Heute', icon: 'M12 4.5C7 4.5 2.7 7.6 1 12c1.7 4.4 6 7.5 11 7.5s9.3-3.1 11-7.5c-1.7-4.4-6-7.500-11-7.500zM12 17a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-8a3 3 0 1 0 0 6 3 3 0 0 0 0-6z' },
    { id: 'stationen', href: 'stationen.html', label: 'Stationen & Schichten', short: 'Stationen', need: 'admin', group: 'Planung', icon: 'M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.500a2.5 2.5 0 0 1 0 5z' },
    { id: 'ablauf', href: 'ablauf.html', label: 'Ablauf & Aufgaben', short: 'Ablauf', need: 'admin', group: 'Planung', icon: 'M5 3h14v2H5V3zm0 8h14v2H5v-2zm0 8h14v2H5v-2zM3 4a1 1 0 1 1 0 .1V4zm0 8a1 1 0 1 1 0 .1V12zm0 8a1 1 0 1 1 0 .1V20z' },
    { id: 'anzeigen', href: 'anzeigen.html', label: 'Anzeigen', need: 'admin', group: 'Planung', icon: 'M3 4h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-7v2h3v2H7v-2h3v-2H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v9h16V6H4z' },
    { id: 'rabatt', href: 'rabatt.html', label: 'Rabattcodes', need: 'admin', group: 'Planung', icon: 'M21.4 11.6l-9-9A2 2 0 0 0 11 2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 .6 1.4l9 9a2 2 0 0 0 2.8 0l7-7a2 2 0 0 0 0-2.8zM6.5 8A1.5 1.5 0 1 1 6.5 5a1.5 1.5 0 0 1 0 3z' },
    { id: 'umfragen', href: 'umfragen.html', label: 'Umfragen', need: 'admin', group: 'Planung', icon: 'M5 9.2h3V19H5V9.2zM10.6 5h2.8v14h-2.8V5zm5.6 8H19v6h-2.8v-6z' },
    { id: 'aktionen', href: 'aktionen.html', label: 'Aktionen', need: 'campaigns', group: 'Planung', icon: 'M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.3 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z' },
    { id: 'gaeste', href: 'gaeste.html', label: 'Gästeliste', need: 'admin', group: 'Gäste', icon: 'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0H4z' },
    { id: 'mailvorlage', href: 'mailvorlage.html', label: 'Mail-Vorlage', need: 'admin', group: 'Gäste', icon: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2v.5l8 5 8-5V7H4z' },
    { id: 'massenmail', href: 'massenmail.html', label: 'Rundmail', need: 'admin', group: 'Gäste', icon: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2v.5l8 5 8-5V7H4z' },
    { id: 'insights', href: 'insights.html', label: 'Insights', need: 'admin', group: 'Auswertung', icon: 'M4 20V10h4v10H4zm6 0V4h4v16h-4zm6 0v-7h4v7h-4z' },
    { id: 'protokoll', href: 'protokoll.html', label: 'Scan-Protokoll', need: 'admin', group: 'Auswertung', icon: 'M6 2h9l5 5v15H6V2zm8 1.5V8h4.5L14 3.5zM8 12h8v2H8v-2zm0 4h8v2H8v-2z' },
    { id: 'drucken', href: 'drucken.html', label: 'Drucken / PDF', need: 'admin', group: 'Auswertung', icon: 'M6 2h9l5 5v15H6V2zm8 1.5V8h4.5L14 3.5zM8 12h8v2H8v-2zm0 4h8v2H8v-2z' },
    { id: 'benutzer', href: 'benutzer.html', label: 'Benutzer', need: 'admin', group: 'Verwaltung', icon: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5z' },
    { id: 'uhr', href: 'uhr.html', label: 'Vollbild-Uhr', short: 'Uhr', need: 'any', group: 'Heute', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm.5-13H11v6l5.2 3.2.8-1.3-4.5-2.7V7z' },
  ];
  const CAP_LABEL = { sell: 'Verkauf', scan: 'Einlass', campaigns: 'Aktionen', stations: 'Schicht' };

  // need: 'admin' | Recht aus my_caps | 'any' (jeder Mitarbeiter mit mindestens einem Recht)
  function hasNeed(me, need) {
    if (me.role === 'admin') return true;
    if (need === 'admin') return false;
    if (!me.caps) return false;
    if (need === 'any') return Object.keys(me.caps).some((k) => me.caps[k]);
    return !!me.caps[need];
  }
  function navFor(me) {
    return NAV.filter((n) => me.role === 'admin' ? !n.staffOnly : hasNeed(me, n.need));
  }
  // Startseite: bei Admins die Übersicht, sonst die erste Seite, die sie benutzen dürfen
  function homeFor(me) {
    const first = navFor(me)[0];
    return first ? first.href : 'index.html';
  }
  async function loadCaps(me) {
    if (me.role === 'admin') return { sell: true, scan: true, campaigns: true, stations: true };
    const r = await sb.rpc('my_caps');
    if (r.error || !r.data) return { sell: false, scan: false, campaigns: false, stations: false };
    return r.data;
  }

  // ---------- Meldungen ----------
  let toastTimer;
  function toast(msg, kind) {
    let el = $('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = kind === 'bad' ? 'bad' : '';
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, kind === 'bad' ? 6000 : 3000);
  }

  function errText(e) {
    const m = String((e && e.message) || e || '');
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Keine Verbindung zum Server.';
    if (/permission denied|row-level security/i.test(m)) return 'Dafür fehlt die Berechtigung.';
    if (/duplicate key/i.test(m)) return 'Diesen Eintrag gibt es schon.';
    if (/violates foreign key/i.test(m)) return 'Das wird noch verwendet und kann nicht gelöscht werden.';
    if (/JWT expired|invalid JWT/i.test(m)) return 'Die Anmeldung ist abgelaufen. Bitte neu anmelden.';
    return m || 'Unbekannter Fehler.';
  }
  const fail = (e) => toast(errText(e), 'bad');

  // verhindert Doppelklicks, z. B. beim Verkauf
  async function busy(btn, fn) {
    if (btn && btn.disabled) return undefined;
    if (btn) btn.disabled = true;
    try { return await fn(); } finally { if (btn) btn.disabled = false; }
  }

  // ---------- Dialoge ----------
  function wireDialog(dlg) {
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  }

  function confirmBox(message, opts) {
    const o = Object.assign({ title: 'Bist du sicher?', ok: 'Bestätigen', danger: false }, opts || {});
    return new Promise((resolve) => {
      let dlg = $('svConfirm');
      if (!dlg) {
        dlg = document.createElement('dialog');
        dlg.id = 'svConfirm';
        dlg.innerHTML =
          '<form method="dialog" class="dlg">' +
          '<div class="dlg-head"><h2 id="svConfirmTitle"></h2></div>' +
          '<div class="dlg-body"><p id="svConfirmText"></p></div>' +
          '<div class="dlg-foot"><button class="btn secondary" value="cancel">Abbrechen</button>' +
          '<button class="btn" id="svConfirmOk" value="ok"></button></div></form>';
        document.body.appendChild(dlg);
        wireDialog(dlg);
      }
      $('svConfirmTitle').textContent = o.title;
      $('svConfirmText').textContent = message;
      const ok = $('svConfirmOk');
      ok.textContent = o.ok;
      ok.className = 'btn' + (o.danger ? ' danger' : '');
      dlg.returnValue = '';
      dlg.addEventListener('close', () => resolve(dlg.returnValue === 'ok'), { once: true });
      dlg.showModal();
    });
  }

  // ---------- CSV, QR, Zwischenablage ----------
  function downloadCsv(filename, rows) {
    const cell = (c) => {
      let s = String(c == null ? '' : c);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;          // Schutz vor Formeln in Excel
      return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function renderQR(el, text, size) {
    el.innerHTML = '';
    if (!window.QRCode) { el.textContent = 'QR-Bibliothek nicht geladen'; return; }
    new window.QRCode(el, { text: text, width: size || 176, height: size || 176, correctLevel: window.QRCode.CorrectLevel.M });
  }

  function qrDataUrl(el) {
    const c = el.querySelector('canvas');
    return c ? c.toDataURL('image/png') : null;
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast('Kopiert'); }
    catch (e) { toast('Kopieren hat nicht geklappt. Bitte von Hand markieren.', 'bad'); }
  }

  // Ticket-Darstellung mit QR-Code (Abriss-Kante)
  function ticketHtml(t) {
    return '<div class="ticket">' +
      '<div class="ticket-info">' +
      '<div class="event">' + esc(t.event || '') + '</div>' +
      '<div class="guest">' + esc(t.name) + '</div>' +
      (t.klass ? '<div class="muted">Klasse ' + esc(t.klass) + '</div>' : '') +
      '<div class="kind"><span class="badge accent">' + esc(t.type || '') + '</span></div>' +
      '</div>' +
      '<div class="ticket-stub"><div class="qr" data-qr></div>' +
      '<div class="token">' + esc(t.token) + '</div></div></div>';
  }

  function showTicket(container, t) {
    container.innerHTML = ticketHtml(t);
    const qr = container.querySelector('[data-qr]');
    renderQR(qr, t.token, 168);
    return qr;
  }

  function saveQrPng(qrEl, filename) {
    const url = qrDataUrl(qrEl) || (qrEl.querySelector('img') || {}).src;
    if (!url) { toast('QR-Code konnte nicht gespeichert werden', 'bad'); return; }
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ---------- Event-Design (Farben, Logo, Ticket-Stil) ----------
  const DEFAULT_C1 = '#1f3fbf';
  const hexOk = (h) => /^#[0-9a-fA-F]{6}$/.test(h || '');
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  // mix(a, b, 0.3) = 30 % von b in a
  const mix = (a, b, k) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v, i) => v * (1 - k) + y[i] * k)); };
  const inkOn = (hex) => (lum(hex) > 0.4 ? '#0b0d12' : '#ffffff');
  const STYLES = { classic: 'Klassisch', modern: 'Modern', elegant: 'Elegant', strip: 'Streifen' };

  // Design eines Events: { style, c1, c2, logo (Image oder null) }. Zweite Farbe fehlt -> dunklere Variante der ersten.
  function themeOf(ev, logo) {
    const c1 = hexOk(ev && ev.accent) ? ev.accent : DEFAULT_C1;
    const c2 = hexOk(ev && ev.accent2) ? ev.accent2 : mix(c1, '#000000', 0.35);
    const style = ev && STYLES[ev.ticket_style] ? ev.ticket_style : 'classic';
    return { style: style, c1: c1, c2: c2, logo: logo || null };
  }

  // Logo laden (nur https-Link). Mit CORS, sonst darf das Bild nicht ins Ticket-PNG. Ergebnis: Image oder null.
  const logoCache = {};
  function loadLogo(url) {
    if (!/^https:\/\//.test(url || '')) return Promise.resolve(null);
    if (!logoCache[url]) {
      logoCache[url] = new Promise((res) => {
        const im = new Image();
        im.crossOrigin = 'anonymous';
        im.onload = () => res(im.naturalWidth ? im : null);
        im.onerror = () => res(null);
        im.src = url;
      });
    }
    return logoCache[url];
  }

  // Merkt sich pro Eventname das Design, damit ticketPng() es ohne weitere Angaben findet.
  const themeByEvent = {};
  function registerThemes(events) {
    (events || []).forEach((ev) => {
      themeByEvent[ev.name] = themeOf(ev, null);
      if (ev.logo_url) loadLogo(ev.logo_url).then((im) => { themeByEvent[ev.name] = themeOf(ev, im); });
    });
  }

  // Das ganze Ticket (Name, Klasse, Ticketart, QR-Code) als PNG-Bild.
  // t.theme (optional) überschreibt das Design, sonst gilt das Design des Events (nach Name).
  function ticketPng(t) {
    const th = t.theme || themeByEvent[t.event] || themeOf(null);
    const style = th.style;
    const W = 1200, H = 520, PAD = 36;
    const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
    const P = style === 'elegant'
      ? { page: '#0a0b0f', card: '#14161c', line: '#2a2e38', muted: '#a3aab8', text: '#f4f5f7', tear: '#3a3f4b', mono: '#7c8494' }
      : { page: '#eef0f4', card: '#ffffff', line: '#dcdfe5', muted: '#5b6270', text: '#15171c', tear: '#c9cdd6', mono: '#8a91a0' };
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    const grad = (x0, y0, x1, y1) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, th.c1); gr.addColorStop(1, th.c2); return gr; };

    g.fillStyle = P.page; g.fillRect(0, 0, W, H);
    const cx = PAD, cy = PAD, cw = W - 2 * PAD, ch = H - 2 * PAD;
    const stubW = 380, sx = cx + cw - stubW;
    rr(cx, cy, cw, ch, 28); g.fillStyle = P.card; g.fill();

    // Farbflächen je Stil (am Kartenrand abgeschnitten)
    let ink = P.text, sub = P.muted, headerH = 0;
    g.save(); rr(cx, cy, cw, ch, 28); g.clip();
    if (style === 'modern') {
      headerH = 118;
      g.fillStyle = grad(cx, cy, cx + cw, cy + headerH); g.fillRect(cx, cy, cw, headerH);
    } else if (style === 'strip') {
      g.fillStyle = grad(cx, cy, sx, cy + ch); g.fillRect(cx, cy, sx - cx, ch);
      ink = inkOn(mix(th.c1, th.c2, 0.5)); sub = ink;
    } else if (style === 'elegant') {
      g.fillStyle = grad(cx, cy, cx, cy + ch); g.fillRect(cx, cy, 10, ch);
    }
    g.restore();
    g.lineWidth = 2; g.strokeStyle = P.line; rr(cx, cy, cw, ch, 28); g.stroke();

    // Abriss-Kante
    g.save(); g.setLineDash([10, 10]); g.lineWidth = 3; g.strokeStyle = P.tear;
    g.beginPath(); g.moveTo(sx, cy + 24); g.lineTo(sx, cy + ch - 24); g.stroke(); g.restore();
    [cy, cy + ch].forEach((y) => { g.beginPath(); g.arc(sx, y, 22, 0, Math.PI * 2); g.fillStyle = P.page; g.fill(); });

    // Logo (Seitenverhältnis bleibt erhalten)
    const lg = th.logo;
    const drawLogo = (x, y, maxW, maxH, alignRight) => {
      if (!lg) return 0;
      const k = Math.min(maxW / lg.naturalWidth, maxH / lg.naturalHeight, 1.6);
      const w = lg.naturalWidth * k, h = lg.naturalHeight * k;
      try { g.drawImage(lg, alignRight ? x - w : x, y + (maxH - h) / 2, w, h); } catch (e) { return 0; }
      return w;
    };

    // Text links, mit Umbruch
    const left = cx + 52 + (style === 'elegant' ? 8 : 0), maxW = sx - left - 40;
    const wrap = (text, font, lines, mw) => {
      const lim = mw || maxW;
      g.font = font;
      const words = String(text || '').split(/\s+/).filter(Boolean);
      const out = []; let cur = '';
      words.forEach((w) => {
        const test = cur ? cur + ' ' + w : w;
        if (g.measureText(test).width <= lim || !cur) cur = test; else { out.push(cur); cur = w; }
      });
      if (cur) out.push(cur);
      if (out.length > lines) {
        out.length = lines;
        let last = out[lines - 1];
        while (last.length > 1 && g.measureText(last + '…').width > lim) last = last.slice(0, -1);
        out[lines - 1] = last + '…';
      }
      return out;
    };
    g.textBaseline = 'alphabetic';
    let evBase = cy + 88, nameBase = cy + 170, maxSize = 62;
    if (style === 'modern') {
      // Kopfband: Eventname in der Kopf-Schriftfarbe, Logo rechts
      const hi = inkOn(mix(th.c1, th.c2, 0.5));
      const lw = drawLogo(sx - 36, cy + 24, 190, headerH - 48, true);
      g.fillStyle = hi;
      wrap(t.event, '700 38px ' + FONT, 1, maxW - (lw ? lw + 16 : 0)).forEach((l) => g.fillText(l, left, cy + headerH / 2 + 14));
      nameBase = cy + headerH + 84; maxSize = 56;
    } else {
      let lw = 0;
      if (style === 'classic' && lg) {
        // Plakette in der Eventfarbe: so bleibt auch ein weißes Logo auf der weißen Karte sichtbar
        const k0 = Math.min(170 / lg.naturalWidth, 56 / lg.naturalHeight, 1.6);
        const pw = lg.naturalWidth * k0 + 28, ph = 56 + 20;
        g.fillStyle = mix(th.c1, th.c2, 0.5); rr(left, cy + 34, pw, ph, 14); g.fill();
        lw = drawLogo(left + 14, cy + 44, 170, 56, false) + 28;
      } else lw = drawLogo(left, cy + 44, 170, 56, false);
      g.fillStyle = style === 'elegant' ? mix(th.c1, '#ffffff', lum(th.c1) < 0.3 ? 0.5 : 0.1) : sub;
      g.font = '500 30px ' + FONT;
      wrap(t.event, '500 30px ' + FONT, 1, maxW - (lw ? lw + 20 : 0)).forEach((l) => g.fillText(l, left + (lw ? lw + 20 : 0), evBase));
    }
    g.fillStyle = ink;
    // Lange Namen: Schrift verkleinern, bis zwei Zeilen reichen
    let size = maxSize, nameLines;
    for (;;) {
      nameLines = wrap(t.name, '700 ' + size + 'px ' + FONT, 3);
      const fits = nameLines.length <= 2 && !/…$/.test(nameLines[nameLines.length - 1] || '');
      if (fits || size <= 38) break;
      size -= 6;
    }
    nameLines = wrap(t.name, '700 ' + size + 'px ' + FONT, 2);
    g.font = '700 ' + size + 'px ' + FONT;
    const lh = Math.round(size * 1.16);
    nameLines.forEach((l, i) => g.fillText(l, left, nameBase + i * lh));
    let y = nameBase + (nameLines.length - 1) * lh;
    if (t.klass) { y += 52; g.fillStyle = sub; g.font = '500 34px ' + FONT; g.fillText('Klasse ' + t.klass, left, y); }
    if (t.type) {
      g.font = '600 28px ' + FONT;
      const label = wrap(t.type, '600 28px ' + FONT, 1)[0] || '';
      const bw = g.measureText(label).width + 44, bh = 52, by = cy + ch - 48 - bh;
      rr(left, by, bw, bh, 26);
      let bf, bt;
      if (style === 'strip') { bf = inkOn(mix(th.c1, th.c2, 0.5)) === '#ffffff' ? '#ffffff' : '#0b0d12'; bt = bf === '#ffffff' ? '#15171c' : '#ffffff'; }
      else if (style === 'elegant') { bf = mix(P.card, th.c1, 0.28); bt = mix(th.c1, '#ffffff', lum(th.c1) < 0.3 ? 0.55 : 0.2); }
      else { bf = mix('#ffffff', th.c1, 0.14); bt = lum(th.c1) > 0.5 ? '#15171c' : th.c1; }
      g.fillStyle = bf; g.fill();
      g.fillStyle = bt; g.textBaseline = 'middle'; g.fillText(label, left + 22, by + bh / 2 + 1); g.textBaseline = 'alphabetic';
    }

    // QR-Code rechts (immer auf weißer Kachel, damit er scannbar bleibt)
    const tmp = document.createElement('div');
    tmp.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(tmp);
    renderQR(tmp, t.token, 400);
    const qc = tmp.querySelector('canvas');
    const qs = 268, qx = sx + (stubW - qs) / 2, qy = cy + (ch - qs) / 2 - 20;
    if (qc) {
      g.fillStyle = '#ffffff'; rr(qx - 14, qy - 14, qs + 28, qs + 28, 12); g.fill();
      g.strokeStyle = P.line; g.lineWidth = 2; g.stroke();
      g.imageSmoothingEnabled = false;
      g.drawImage(qc, qx, qy, qs, qs);
    }
    document.body.removeChild(tmp);
    g.fillStyle = P.mono; g.font = '500 15px ui-monospace, Menlo, Consolas, monospace'; g.textAlign = 'center';
    const tok = String(t.token || '');
    g.fillText(tok.slice(0, 32), sx + stubW / 2, qy + qs + 52);
    g.fillText(tok.slice(32), sx + stubW / 2, qy + qs + 74);
    g.textAlign = 'left';
    return c;
  }

  function saveTicketPng(t) {
    let c;
    try { c = ticketPng(t); } catch (e) { toast('Das Ticket konnte nicht erstellt werden', 'bad'); return; }
    const name = 'ticket-' + String(t.name || 'gast').replace(/[^\wäöüÄÖÜß-]+/g, '_') + '.png';
    c.toBlob((b) => {
      if (!b) { toast('Das Ticket konnte nicht gespeichert werden', 'bad'); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    }, 'image/png');
  }

  // Ticket per E-Mail verschicken (Funktion "send-ticket" in Supabase).
  // Den Empfänger liest die Funktion selbst aus der Datenbank. Gibt { ok, error } zurück.
  async function sendTicketMail(sb, ticketId, ticket) {
    let png;
    try { png = ticketPng(ticket).toDataURL('image/png').split(',')[1]; }
    catch (e) { return { ok: false, error: 'Das Ticket-Bild konnte nicht erstellt werden.' }; }
    try {
      const r = await sb.functions.invoke('send-ticket', { body: { ticket_id: ticketId, png: png } });
      if (r.error) {
        let msg = r.error.message || '';
        try { const j = await r.error.context.json(); if (j && j.error) msg = j.error; } catch (e) { /* keine Details */ }
        if (/Failed to send|fetch|not found|relay/i.test(msg)) msg = 'Die Funktion „send-ticket“ ist nicht erreichbar. Wurde sie in Supabase eingerichtet?';
        return { ok: false, error: msg };
      }
      if (r.data && r.data.error) return { ok: false, error: r.data.error };
      return { ok: true, to: r.data && r.data.to, sentAt: r.data && r.data.sent_at };
    } catch (e) {
      return { ok: false, error: (e && e.message) || 'E-Mail konnte nicht gesendet werden.' };
    }
  }

  // ---------- Events ----------
  function sortEvents(list) {
    const edge = Date.now() - 24 * 3600 * 1000;
    const t = (e) => (e.starts_at ? new Date(e.starts_at).getTime() : Infinity);
    const upcoming = list.filter((e) => t(e) >= edge).sort((a, b) => (t(a) === t(b) ? 0 : t(a) < t(b) ? -1 : 1));
    const past = list.filter((e) => t(e) < edge).sort((a, b) => t(b) - t(a));
    return upcoming.concat(past);
  }

  async function loadEvents() {
    const r = await sb.from('events').select('*');
    if (r.error) throw r.error;
    registerThemes(r.data);
    return sortEvents(r.data || []);
  }

  function fillEventSelect(sel, events) {
    const saved = store.get('sv.event');
    sel.innerHTML = events.map((e) =>
      '<option value="' + e.id + '">' + esc(e.name) + (e.starts_at ? ' (' + fmtDay(e.starts_at) + ')' : '') + '</option>').join('');
    if (events.some((e) => e.id === saved)) sel.value = saved;
    const evOf = () => events.find((x) => x.id === sel.value) || {};
    const accentOf = () => evOf().accent || null;
    sel.addEventListener('change', () => { store.set('sv.event', sel.value); applyAccent(accentOf(), evOf().accent2); });
    applyAccent(accentOf(), evOf().accent2);
    return sel.value;
  }

  // ---------- Akzentfarbe pro Event ----------
  function isDark() {
    const t = document.documentElement.getAttribute('data-theme');
    return t ? t === 'dark' : !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  function lum(hex) {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  // Setzt die Farbe der Seite auf die Akzentfarbe des Events (null = Standardfarbe).
  // Die Schriftfarbe auf dem Akzent und die Tönung werden automatisch passend gewählt.
  function applyAccent(hex, hex2) {
    const st = document.documentElement.style;
    if (!/^#[0-9a-fA-F]{6}$/.test(hex || '')) {
      ['--accent', '--accent-ink', '--accent-soft', '--accent2'].forEach((k) => st.removeProperty(k));
      return;
    }
    let col = hex;
    // Im Dunkelmodus zu dunkle Farben aufhellen, sonst sind Links und Knöpfe kaum zu sehen
    if (isDark() && lum(col) < 0.12) col = 'color-mix(in srgb, ' + hex + ' 62%, #ffffff)';
    st.setProperty('--accent2', hexOk(hex2) ? hex2 : mix(hex, '#000000', 0.35));
    st.setProperty('--accent', col);
    st.setProperty('--accent-ink', lum(hex) > 0.4 ? '#0b0d12' : '#ffffff');
    st.setProperty('--accent-soft', 'color-mix(in srgb, ' + hex + ' 16%, var(--surface))');
  }

  // ---------- Serverzeit (für Countdowns) ----------
  let clockOffset = 0;
  async function syncClock() {
    const a = Date.now();
    const r = await sb.rpc('server_now');
    const b = Date.now();
    if (!r.error && r.data) clockOffset = new Date(r.data).getTime() - (a + b) / 2;
    return clockOffset;
  }
  const serverNow = () => Date.now() + clockOffset;
  const p2 = (n) => String(n).padStart(2, '0');
  // "T − 01:12:09" / "T + 00:05:30" (ab 24 Stunden mit Tagen)
  function fmtT(ms) {
    const sign = ms > 0 ? '−' : '+';
    let s = Math.floor(Math.abs(ms) / 1000);
    const d = Math.floor(s / 86400); s -= d * 86400;
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return 'T ' + sign + ' ' + (d ? d + (d === 1 ? ' Tag ' : ' Tage ') : '') + p2(h) + ':' + p2(m) + ':' + p2(sec);
  }

  // ---------- Zugang prüfen ----------
  function accessState(p) {
    if (!p.active) return 'inactive';
    if (p.role === 'admin') return 'ok';
    const now = Date.now();
    if (p.valid_until && now > new Date(p.valid_until).getTime()) return 'expired';
    return 'ok';
  }

  // Vor dem Start des Zugangs: Anmelden ja, Ändern nein (nur ansehen)
  function isReadonly(p) {
    return !!p && p.role !== 'admin' && !!p.valid_from && Date.now() < new Date(p.valid_from).getTime();
  }
  const RO_SEL = 'button:not([role="tab"]):not([role="radio"]):not([data-ro-ok]):not([data-theme-set]):not(.nav-chev), ' +
    'input[type="submit"], textarea, form input, form select';
  function applyReadonly(me) {
    document.body.classList.add('ro');
    const main = $('content');
    if (!main) return;
    const note = document.createElement('div');
    note.className = 'notice ro-note';
    note.textContent = 'Dein Zugang startet am ' + fmt(me.valid_from) + '. Bis dahin kannst du dich umsehen und alles ausprobieren, aber nichts ändern.';
    main.insertBefore(note, main.firstChild);
    let busy = false;
    const lock = () => {
      if (busy) return; busy = true;
      main.querySelectorAll(RO_SEL).forEach((el) => {
        if (el.closest('[data-ro-ok]') || el.closest('.ro-note')) return;
        if (!el.disabled) { el.disabled = true; el.setAttribute('data-ro', '1'); }
      });
      busy = false;
    };
    lock();
    new MutationObserver(lock).observe(main, { childList: true, subtree: true });
  }

  function fatal(msg) {
    document.body.innerHTML = '<main class="login"><h1>SVEvents</h1><p class="notice bad">' + esc(msg) + '</p></main>';
  }

  async function logoutTo(url) {
    try { await sb.auth.signOut(); } catch (e) { /* egal */ }
    location.replace(url || 'index.html');
  }

  function roleText(me) {
    if (me.role === 'admin') return 'Admin';
    const parts = Object.keys(CAP_LABEL).filter((k) => me.caps && me.caps[k]).map((k) => CAP_LABEL[k]);
    return parts.length ? parts.join(' · ') : 'Mitarbeiter';
  }

  // ---------- Gerüst mit Navigation ----------
  const ico = (d) => '<svg class="ico" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="' + d + '"/></svg>';
  // Seitenleiste: ab fünf Punkten als ausklappbare Gruppen. Die Gruppe mit der aktuellen Seite ist offen,
  // der Rest merkt sich, was du zuletzt offen oder zu gemacht hast.
  const NAV_KEY = 'sv_nav_open';
  const navOpenState = () => { try { return JSON.parse(localStorage.getItem(NAV_KEY) || '{}'); } catch (e) { return {}; } };
  function navHtml(items, page) {
    const grouped = items.length > 4;
    let html = '';
    // Punkte einer Gruppe stehen zusammen (Reihenfolge der Gruppen = erstes Auftreten)
    const order = [];
    items.forEach((n) => { if (order.indexOf(n.group) < 0) order.push(n.group); });
    items = items.map((n, i) => ({ n: n, i: i })).sort((a, b) => order.indexOf(a.n.group) - order.indexOf(b.n.group) || a.i - b.i).map((x) => x.n);
    const link = (n) => '<a href="' + n.href + '"' + (n.id === page ? ' aria-current="page"' : '') + '>' + n.label + '</a>';
    if (!grouped) return items.map(link).join('');
    const st = navOpenState();
    order.forEach((g) => {
      const list = items.filter((n) => n.group === g);
      const hasCur = list.some((n) => n.id === page);
      const open = hasCur || st[g] === true;
      html += '<details class="nav-grp" data-group="' + esc(g) + '"' + (open ? ' open' : '') + '>' +
        '<summary class="nav-group">' + esc(g) + '<span class="nav-chev" aria-hidden="true">›</span></summary>' +
        list.map(link).join('') + '</details>';
    });
    return html;
  }
  // Handy: untere Leiste mit bis zu vier Punkten, der Rest steht hinter "Mehr"
  function buildTabbar(items, page) {
    const direct = items.length <= 5 ? items : items.slice(0, 4);
    const more = items.length <= 5 ? [] : items.slice(4);
    const bar = document.createElement('nav');
    bar.className = 'tabbar';
    bar.setAttribute('aria-label', 'Hauptnavigation');
    bar.innerHTML = direct.map((n) => '<a href="' + n.href + '"' + (n.id === page ? ' aria-current="page"' : '') + '>' + ico(n.icon) + '<span>' + esc(n.short || n.label) + '</span></a>').join('') +
      (more.length ? '<button type="button" id="moreBtn"' + (more.some((n) => n.id === page) ? ' aria-current="page"' : '') + ' aria-haspopup="dialog">' + ico('M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z') + '<span>Mehr</span></button>' : '');
    document.body.appendChild(bar);
    if (!more.length) return;
    const sheet = document.createElement('dialog');
    sheet.className = 'sheet';
    sheet.setAttribute('aria-label', 'Weitere Seiten');
    let last = '', html = '<div class="sheet-grip"></div>';
    more.forEach((n) => {
      if (n.group !== last) { html += '<div class="nav-group">' + esc(n.group) + '</div>'; last = n.group; }
      html += '<a href="' + n.href + '"' + (n.id === page ? ' aria-current="page"' : '') + '>' + ico(n.icon) + '<span>' + esc(n.label) + '</span></a>';
    });
    sheet.innerHTML = html;
    document.body.appendChild(sheet);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.close(); });
    $('moreBtn').addEventListener('click', () => sheet.showModal());
  }
  function buildShell(me, page) {
    const main = $('content');
    const shell = document.createElement('div');
    shell.className = 'shell';
    const side = document.createElement('aside');
    side.className = 'side';
    const items = navFor(me);
    const until = me.role !== 'admin' && me.valid_until
      ? '<div class="small muted">Zugang bis ' + esc(fmt(me.valid_until)) + '</div>' : '';
    const theme = window.svTheme ? window.svTheme.get() : 'auto';
    const tb = (v, label) => '<button type="button" data-theme-set="' + v + '" aria-pressed="' + (theme === v) + '">' + label + '</button>';
    side.innerHTML =
      '<a class="brand" href="' + homeFor(me) + '">SVEvents</a>' +
      '<nav class="nav" aria-label="Hauptnavigation">' + navHtml(items, page) + '</nav>' +
      '<div class="who">' +
      '<div class="who-name"><b>' + esc(me.name) + '</b><div class="small muted">' + ROLE_LABEL[me.role] + '</div>' + until + '</div>' +
      '<div class="themes" role="group" aria-label="Darstellung">' + tb('auto', 'Auto') + tb('light', 'Hell') + tb('dark', 'Dunkel') + '</div>' +
      '<button class="btn secondary sm" type="button" id="logoutBtn">Abmelden</button>' +
      '</div>';
    main.parentNode.insertBefore(shell, main);
    shell.appendChild(side);
    shell.appendChild(main);
    main.classList.add('main');
    main.hidden = false;

    buildTabbar(items, page);
    $('logoutBtn').addEventListener('click', () => logoutTo('index.html'));
    $$('[data-theme-set]', side).forEach((b) => b.addEventListener('click', () => {
      window.svTheme.set(b.dataset.themeSet);
      $$('[data-theme-set]', side).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    }));
    // Gruppen-Zustand merken (nur, wenn du selbst auf- oder zuklappst)
    $$('details.nav-grp', side).forEach((d) => d.addEventListener('toggle', () => {
      try {
        const st = navOpenState();
        st[d.dataset.group] = d.open;
        localStorage.setItem(NAV_KEY, JSON.stringify(st));
      } catch (e) { /* egal */ }
    }));
    const cur = side.querySelector('[aria-current]');
    if (cur && cur.scrollIntoView) cur.scrollIntoView({ inline: 'center', block: 'nearest' });
    $$('dialog').forEach(wireDialog);
  }

  // Zugang regelmäßig neu prüfen: läuft er ab oder wird er gesperrt, geht es zum Login
  function watchAccess(me) {
    let current = me;
    const wasRo = isReadonly(me);
    const check = (p) => {
      const st = accessState(p);
      if (st !== 'ok') logoutTo('index.html?m=' + st);
      else if (wasRo && !isReadonly(p)) location.reload();   // Zugang ist jetzt gestartet
    };
    setInterval(() => check(current), 15000);
    setInterval(async () => {
      try {
        const r = await sb.from('profiles').select('*').eq('id', me.id).maybeSingle();
        if (r.error) return;
        if (!r.data) { logoutTo('index.html?m=noprofile'); return; }
        current = r.data;
        check(current);
      } catch (e) { /* kurzer Verbindungsabbruch ist kein Grund zum Abmelden */ }
    }, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(current); });
    sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') location.replace('index.html'); });
  }

  async function start(opts) {
    if (!sb) {
      fatal('Die Verbindung ist noch nicht eingerichtet. Trage SUPABASE_URL und SUPABASE_ANON_KEY in config.js ein.');
      return null;
    }
    const s = await sb.auth.getSession();
    if (!s.data.session) { location.replace('index.html'); return null; }
    const r = await sb.from('profiles').select('*').eq('id', s.data.session.user.id).maybeSingle();
    if (r.error) { fatal('Das Profil konnte nicht geladen werden: ' + errText(r.error)); return null; }
    if (!r.data) { await logoutTo('index.html?m=noprofile'); return null; }
    const me = r.data;
    const st = accessState(me);
    if (st !== 'ok') { await logoutTo('index.html?m=' + st); return null; }
    me.caps = await loadCaps(me);
    if (me.role !== 'admin' && !navFor(me).length) {
      await logoutTo('index.html?m=nocaps');
      return null;
    }
    // Seite erlaubt? need = Recht für Mitarbeiter, roles = nur diese Rollen (z. B. nur Admin)
    const allowed = opts.need
      ? hasNeed(me, opts.need)
      : opts.roles.indexOf(me.role) >= 0;
    if (!allowed) { location.replace(homeFor(me)); return null; }
    // bare: Seite ohne Menü (z. B. die Vollbild-Uhr)
    if (opts.bare) { const m = $('content'); if (m) m.hidden = false; }
    else buildShell(me, opts.page);
    if (isReadonly(me)) applyReadonly(me);
    watchAccess(me);
    return { me: me, sb: sb };
  }

  // ---------- Anmeldeseite ----------
  async function initLogin() {
    const notice = $('notice');
    const showNotice = (t) => { notice.textContent = t; notice.hidden = false; };
    const msgs = {
      expired: 'Dein Zugang ist abgelaufen. Wende dich an einen Admin.',
      inactive: 'Dein Zugang ist deaktiviert. Wende dich an einen Admin.',
      notyet: 'Dein Zugang ist noch nicht freigeschaltet. Wende dich an einen Admin.',
      noprofile: 'Für diese Anmeldung ist kein Zugang eingerichtet. Wende dich an einen Admin.',
      nocaps: 'Dir ist noch nichts zugewiesen (Verkauf, Einlass, Aktion oder Schicht). Wende dich an einen Admin.'
    };
    const m = new URLSearchParams(location.search).get('m');
    if (m && msgs[m]) showNotice(msgs[m]);
    if (!sb) { showNotice('Die Verbindung ist noch nicht eingerichtet. Trage die Supabase-Daten in config.js ein.'); return; }

    async function check(userId) {
      const r = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (r.error) return { ok: false, text: 'Das Profil konnte nicht geladen werden: ' + errText(r.error) };
      if (!r.data) return { ok: false, text: msgs.noprofile };
      const st = accessState(r.data);
      if (st !== 'ok') return { ok: false, text: msgs[st] };
      r.data.caps = await loadCaps(r.data);
      if (r.data.role !== 'admin' && !navFor(r.data).length) return { ok: false, text: msgs.nocaps };
      return { ok: true, me: r.data };
    }

    const s = await sb.auth.getSession();
    if (s.data.session && !m) {
      const c = await check(s.data.session.user.id);
      if (c.ok) { location.replace(homeFor(c.me)); return; }
    }

    $('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      notice.hidden = true;
      const btn = $('loginBtn');
      await busy(btn, async () => {
        const r = await sb.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
        if (r.error) {
          showNotice(/invalid/i.test(r.error.message) ? 'E-Mail oder Passwort stimmt nicht.' : errText(r.error));
          return;
        }
        const c = await check(r.data.user.id);
        if (!c.ok) { await sb.auth.signOut(); showNotice(c.text); return; }
        location.replace(homeFor(c.me));
      });
    });
  }

  window.SV = {
    sb, $, $$, esc, fmt, fmtDay, fmtTime, money, toLocalInput, fromLocalInput, store,
    ROLE_LABEL, homeFor, toast, fail, errText, busy, confirmBox, wireDialog,
    downloadCsv, renderQR, qrDataUrl, copyText, ticketHtml, showTicket, saveQrPng, ticketPng, themeOf, loadLogo, STYLES, saveTicketPng, sendTicketMail,
    applyAccent, syncClock, serverNow, fmtT,
    sortEvents, loadEvents, fillEventSelect, accessState, start, initLogin
  };
})();
