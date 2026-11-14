
(async function () {
  const ctx = await SV.start({ page: 'anzeigen', roles: ['admin'] });
  if (!ctx) return;
  const sb = ctx.sb;
  const { esc, $ } = SV;
  let events = [], cur = null, screens = [], editing = null;

  const linkOf = (s, extra) => new URL('anzeige.html?t=' + s.token + (extra || ''), location.href).href;

  async function load() {
    const ev = cur;
    const r = await sb.from('public_screens').select('*').eq('event_id', ev.id).order('created_at');
    if (r.error) throw r.error;
    if (cur !== ev) return;
    screens = r.data;
    render();
  }

  function render() {
    if (!screens.length) { $('list').innerHTML = '<div class="empty"><b>Noch keine Anzeige</b>Lege eine an und öffne den Link auf dem Bildschirm.</div>'; return; }
    $('list').innerHTML = screens.map((s) =>
      '<div class="station-card" data-id="' + s.id + '"><div class="section-head" style="margin-bottom:6px"><div><h3 style="margin:0">' + esc(s.name) + ' ' +
      (s.active ? '<span class="badge ok">an</span>' : '<span class="badge bad">aus</span>') + (s.mode === 'test' ? ' <span class="badge warn">Testbild</span>' : '') + '</h3>' +
      '<div class="muted small" style="word-break:break-all">' + esc(linkOf(s)) + '</div></div>' +
      '<div class="actions"><a class="btn secondary sm" href="' + esc(linkOf(s)) + '" target="_blank" rel="noopener">Öffnen</a>' +
      '<a class="btn secondary sm" href="' + esc(linkOf(s, '&test=1')) + '" target="_blank" rel="noopener">Testbild</a>' +
      '<button class="btn secondary sm" type="button" data-act="copy">Link kopieren</button>' +
      '<button class="btn secondary sm" type="button" data-act="edit">Bearbeiten</button>' +
      '<button class="btn secondary sm" type="button" data-act="renew">Neuer Link</button>' +
      '<button class="btn secondary sm" type="button" data-act="del">Löschen</button></div></div></div>').join('');
  }

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const card = b.closest('[data-id]');
    const s = screens.find((x) => x.id === card.dataset.id);
    try {
      if (b.dataset.act === 'copy') { await SV.copyText(linkOf(s)); SV.toast('Link kopiert'); }
      else if (b.dataset.act === 'edit') openScreen(s);
      else if (b.dataset.act === 'renew') {
        if (!await SV.confirmBox('Der bisherige Link funktioniert danach nicht mehr. Du musst den neuen Link auf dem Bildschirm eintragen.', { title: 'Neuen Link erzeugen?', ok: 'Neuer Link', danger: true })) return;
        const t = Array.from(crypto.getRandomValues(new Uint8Array(32))).map((v) => v.toString(16).padStart(2, '0')).join('');
        const r = await sb.from('public_screens').update({ token: t }).eq('id', s.id);
        if (r.error) return SV.fail(r.error);
        await load();
      } else if (b.dataset.act === 'del') {
        if (!await SV.confirmBox('„' + s.name + '“ wird gelöscht. Der Link funktioniert dann nicht mehr.', { title: 'Anzeige löschen?', ok: 'Löschen', danger: true })) return;
        const r = await sb.from('public_screens').delete().eq('id', s.id);
        if (r.error) return SV.fail(r.error);
        await load();
      }
    } catch (err) { SV.fail(err); }
  });

  function openScreen(s) {
    editing = s || null;
    const c = (s && s.config) || {};
    $('scTitleH').textContent = s ? 'Anzeige bearbeiten' : 'Neue Anzeige';
    $('scName').value = s ? s.name : '';
    $('scMode').value = s ? s.mode : 'auto';
    $('scHeading').value = c.title || '';
    $('scBefore').value = c.before_text || '';
    $('scDuring').value = c.during_text || '';
    $('scAfter').value = c.after_text || '';
    $('scHours').value = c.during_s ? c.during_s / 3600 : 6;
    $('scFree').checked = c.show_free !== false;
    $('scInside').checked = !!c.show_inside;
    $('scActive').checked = s ? s.active : true;
    $('scDlg').showModal();
  }
  $('newScreen').addEventListener('click', () => openScreen(null));
  $('scCancel').addEventListener('click', () => $('scDlg').close());
  $('scForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('scName').value.trim();
    if (!name) return SV.toast('Bitte einen Namen eingeben.', 'bad');
    const h = parseFloat($('scHours').value);
    if (!(h >= 0.5 && h <= 48)) return SV.toast('Die Dauer muss zwischen 0,5 und 48 Stunden liegen.', 'bad');
    const config = { show_free: $('scFree').checked, show_inside: $('scInside').checked, during_s: Math.round(h * 3600) };
    [['title', 'scHeading'], ['before_text', 'scBefore'], ['during_text', 'scDuring'], ['after_text', 'scAfter']].forEach((p) => { const v = $(p[1]).value.trim(); if (v) config[p[0]] = v; });
    const row = { name: name, mode: $('scMode').value, active: $('scActive').checked, config: config };
    await SV.busy($('scOk'), async () => {
      const r = editing ? await sb.from('public_screens').update(row).eq('id', editing.id) : await sb.from('public_screens').insert(Object.assign({ event_id: cur.id }, row));
      if (r.error) return SV.fail(r.error);
      $('scDlg').close();
      await load();
    });
  });

  function pick() { cur = events.find((x) => x.id === $('eventSel').value) || null; return cur ? load().catch(SV.fail) : Promise.resolve(); }
  try {
    events = await SV.loadEvents();
    $('empty').hidden = events.length > 0;
    $('eventPart').hidden = events.length === 0;
    $('newScreen').hidden = events.length === 0;
    if (events.length) { SV.fillEventSelect($('eventSel'), events); $('eventSel').addEventListener('change', pick); await pick(); }
  } catch (e) { SV.fail(e); }
})();
