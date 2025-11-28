export function initSpellCheck() {
    const messageEl = document.getElementById('message');
    const btn = document.getElementById('spellCheckBtn');
    const statusEl = document.getElementById('spellStatus');
    if (!messageEl || !btn || !statusEl) return;

    const LT_URL = 'https://api.languagetool.org/v2/check';
    const LT_LANG = 'pt-BR';
    const LT_TIMEOUT_MS = 12000;
    const MIN_LOADING_MS = 3000; // duração mínima do loading

    // --- status com fade suave e sem "soco" visual ---
    let statusHideTimer = null;
    function showStatus(msg, { autoHideMs } = {}) {
        if (statusHideTimer) { clearTimeout(statusHideTimer); statusHideTimer = null; }
        statusEl.textContent = msg || '';
        // reinicia a transição
        statusEl.classList.remove('is-visible');
        void statusEl.offsetWidth;
        statusEl.classList.add('is-visible');
        if (autoHideMs != null) {
            statusHideTimer = setTimeout(hideStatus, autoHideMs);
        }
    }
    function hideStatus() {
        if (statusHideTimer) { clearTimeout(statusHideTimer); statusHideTimer = null; }
        statusEl.classList.remove('is-visible');
        setTimeout(() => { statusEl.textContent = ''; }, 250);
    }

    const clean = (t) => String(t || '')
        .replace(/^["'“”]+|["'“”]+$/g, '')
        .replace(/\s+([,.!?;:])/g, '$1')
        .replace(/\s+/g, ' ')
        .trim();
    const ensurePeriod = (t) => /[.!?…]$/.test(t) ? t : (t ? t + '.' : t);

    let inFlight; // AbortController

    async function ltCheck(text) {
        if (inFlight) inFlight.abort();
        inFlight = new AbortController();
        const to = setTimeout(() => inFlight.abort(), LT_TIMEOUT_MS);
        try {
            const r = await fetch(LT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ text, language: LT_LANG }),
                signal: inFlight.signal
            });
            if (!r.ok) throw new Error('LanguageTool indisponível');
            return await r.json();
        } finally {
            clearTimeout(to);
            inFlight = null;
        }
    }

    function applyLtCorrections(text, matches) {
        const sorted = (matches || []).sort((a, b) => (b.offset + b.length) - (a.offset + a.length));
        let out = text;
        for (const m of sorted) {
            const rep = m.replacements?.[0]?.value; if (!rep) continue;
            out = out.slice(0, m.offset) + rep + out.slice(m.offset + m.length);
        }
        return out;
    }

    async function correctMessage(text) {
        let t = text;
        const r1 = await ltCheck(t);
        t = applyLtCorrections(t, r1.matches);
        t = ensurePeriod(clean(t));
        try {
            const r2 = await ltCheck(t);
            t = applyLtCorrections(t, r2.matches);
        } catch { }
        t = clean(t);
        if (!/[.!?…]$/.test(t)) t += '.';
        if (t.length > 20000) t = t.slice(0, 20000).trim();
        return t;
    }

    btn.addEventListener('click', async () => {
        const originalMsg = (messageEl.value || '').trim();
        if (!originalMsg) { showStatus('Digite algo para corrigir.', { autoHideMs: 2000 }); return; }

        const startedAt = performance.now();

        try {
            btn.disabled = true;
            messageEl.readOnly = true;
            messageEl.classList.add('loading');
            showStatus('Verificando ortografia/gramática…');

            const corrected = await correctMessage(originalMsg);

            const elapsed = performance.now() - startedAt;
            if (elapsed < MIN_LOADING_MS) {
                await new Promise(r => setTimeout(r, MIN_LOADING_MS - elapsed));
            }

            messageEl.value = corrected;
            showStatus('Correção aplicada.', { autoHideMs: 2000 });
        } catch (e) {
            console.error(e);
            showStatus(e.name === 'AbortError' ? 'Operação cancelada.' : 'Falhou a correção.');
        } finally {
            messageEl.classList.remove('loading');
            messageEl.readOnly = false;
            btn.disabled = false;
        }
    });
}
