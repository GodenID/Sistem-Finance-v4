import React, { useEffect, useRef, useState } from 'react';
import './PrasastiGuard.css';

/**
 * PrasastiGuard — widget verifikasi manusia anti-bot / anti-spam.
 *
 * Port resmi alur integrasi https://prasasti-guard.pages.dev/#integrasi :
 *   1. Minta challenge   → POST {apiUrl}/api/challenge
 *   2. Kumpulkan sinyal perilaku manusia (~1,2 dtk: mouse, touch, scroll, key, honeypot)
 *   3. Proof-of-Work      → SHA-256(`${challengeId}:${nonce}`) dengan leading-zero
 *                           sebanyak `powDifficulty` (bikin serangan massal jadi mahal)
 *   4. Verifikasi         → POST {apiUrl}/api/verify { challengeId, powNonce, behavior }
 *      - lolos langsung (invisible) → onSuccess(verifyToken, result)
 *      - skor abu-abu → needPuzzle → pengguna selesaikan 1 puzzle (slide/rotate/urutan)
 *
 * verifyToken yang dihasilkan bersifat: HMAC-SHA256, kedaluwarsa ±2 menit,
 * sekali pakai. Kirim token ke BACKEND dan validasi dari server:
 *   POST {guard}/api/validate  { "verifyToken": "<token>" }
 *   → { "valid": true, "score": 85, "method": "invisible" }
 *
 * @param {(token: string, result: object) => void} onSuccess
 * @param {(err: Error) => void} [onFail]
 * @param {'light'|'dark'} [theme='light']
 * @param {string} [apiUrl] default dari VITE_PRASASTI_API_URL atau guard produksi
 */
const DEFAULT_API_URL = 'https://guard.prasastigroup.id';
const COLLECT_MS = 1200;
const TRACK_WIDTH = 260;

const getApiUrl = (prop) =>
  prop ||
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PRASASTI_API_URL) ||
  DEFAULT_API_URL;

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Cari nonce sehingga sha256(`${challengeId}:${nonce}`) diawali N nol. */
async function minePow(challengeId, difficulty = 4) {
  const prefix = '0'.repeat(difficulty);
  let nonce = Math.floor(Math.random() * 1_000_000);
  for (;;) {
    const hash = await sha256Hex(`${challengeId}:${nonce}`);
    if (hash.startsWith(prefix)) return { nonce: String(nonce), hash };
    nonce += 1;
    // Yield agar UI tidak freeze selama mining
    if (nonce % 800 === 0) await new Promise((r) => setTimeout(r, 0));
  }
}

/** Kolektor sinyal perilaku manusia (invisible layer). */
function useBehavior() {
  const ref = useRef({
    mouse: [],
    scrolled: false,
    keyPresses: 0,
    hasTouch: false,
    startTime: Date.now(),
  });

  useEffect(() => {
    const s = ref.current;
    const onMouse = (e) => {
      s.mouse.push({ x: Math.round(e.clientX), y: Math.round(e.clientY), t: Date.now() });
      if (s.mouse.length > 120) s.mouse.shift();
    };
    const onTouch = () => { s.hasTouch = true; };
    const onScroll = () => { s.scrolled = true; };
    const onKey = () => { s.keyPresses += 1; };
    window.addEventListener('mousemove', onMouse, { passive: true });
    window.addEventListener('touchstart', onTouch, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('touchstart', onTouch);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const snapshot = (honeypotValue) => {
    const s = ref.current;
    const nav = window.navigator;
    return {
      mouse: s.mouse.slice(-80),
      scrolled: s.scrolled,
      keyPresses: s.keyPresses,
      hasTouch: s.hasTouch || 'ontouchstart' in window,
      honeypotFilled: !!(honeypotValue && honeypotValue.length > 0),
      dwellMs: Date.now() - s.startTime,
      fingerprint: {
        webdriver: !!nav.webdriver,
        headless:
          /Headless/.test(nav.userAgent) || (nav.plugins?.length === 0 && nav.languages?.length === 0),
        plugins: nav.plugins?.length ?? 0,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen: `${window.screen.width}x${window.screen.height}`,
        dpr: window.devicePixelRatio || 1,
      },
    };
  };

  return snapshot;
}

function SlidePuzzle({ slideX = 52, onSolve }) {
  const trackRef = useRef(null);
  const [x, setX] = useState(0);
  const [drag, setDrag] = useState([]);
  const [holding, setHolding] = useState(false);

  const move = (clientX) => {
    if (!holding || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(TRACK_WIDTH, Math.round(clientX - rect.left - 24)));
    setX(pos);
    setDrag((d) => [...d.slice(-40), pos]);
  };

  const release = () => {
    if (!holding) return;
    setHolding(false);
    if (x > 0) onSolve({ type: 'slide', x, drag: [...drag, x] });
  };

  return (
    <div className="pg-puzzle">
      <p className="pg-puzzle-title">Geser potongan ke lubang</p>
      <div className="pg-slide-img">
        <div className="pg-slide-hole" style={{ left: slideX }} />
        <div className="pg-slide-piece" style={{ left: x * 0.85 }} />
      </div>
      <div
        className="pg-slide-track"
        ref={trackRef}
        onMouseMove={(e) => move(e.clientX)}
        onMouseUp={release}
        onMouseLeave={release}
        onTouchMove={(e) => move(e.touches[0].clientX)}
        onTouchEnd={release}
      >
        <div className="pg-slide-fill" style={{ width: x + 48 }} />
        <div
          className={`pg-slide-knob ${holding ? 'grab' : ''}`}
          style={{ left: x }}
          onMouseDown={(e) => { setHolding(true); setDrag([0]); e.cancelable && e.preventDefault(); }}
          onTouchStart={(e) => { setHolding(true); setDrag([0]); e.cancelable && e.preventDefault(); }}
        >
          ➜
        </div>
      </div>
      <p className="pg-hint">Geser seperti manusia — bot yang lurus sempurna akan ketahuan.</p>
    </div>
  );
}

function RotatePuzzle({ rotateStart = 120, onSolve }) {
  const [deg, setDeg] = useState(0);
  const angle = (rotateStart + deg) % 360;
  const tilt = Math.min(angle, 360 - angle);
  return (
    <div className="pg-puzzle">
      <p className="pg-puzzle-title">Putar hingga tegak lurus</p>
      <div className="pg-rotate-stage">
        <div className="pg-rotate-item" style={{ transform: `rotate(${angle}deg)` }}>🧭</div>
      </div>
      <input
        type="range" min="0" max="360" value={deg}
        onChange={(e) => setDeg(Number(e.target.value))}
        className="pg-range"
      />
      <div className="pg-row">
        <span>Kemiringan: {Math.round(tilt)}° {tilt <= 15 ? '· pas!' : ''}</span>
        <button type="button" className="pg-btn" onClick={() => onSolve({ type: 'rotate', deg })}>
          Verifikasi
        </button>
      </div>
      <p className="pg-hint">Putar kompas hingga tegak ke atas.</p>
    </div>
  );
}

function SequencePuzzle({ onSolve }) {
  const [order] = useState(() => [1, 2, 3].sort(() => Math.random() - 0.5));
  const [taps, setTaps] = useState([]);
  const tap = (n) => {
    if (taps.length >= 3) return;
    const next = [...taps, n];
    setTaps(next);
    if (next.length === 3) setTimeout(() => onSolve({ type: 'sequence', taps: next }), 250);
  };
  return (
    <div className="pg-puzzle">
      <p className="pg-puzzle-title">Ketuk berurutan: 1 → 2 → 3</p>
      <div className="pg-seq-grid">
        {order.map((n) => (
          <button
            type="button" key={n}
            className={`pg-seq-btn ${taps.includes(n) ? 'hit' : ''}`}
            onClick={() => tap(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="pg-row">
        <p className="pg-hint">Ketukan: {taps.join(' → ') || '-'}</p>
        {taps.length > 0 && (
          <button type="button" className="pg-link" onClick={() => setTaps([])}>Ulangi</button>
        )}
      </div>
    </div>
  );
}

const PrasastiGuard = ({ onSuccess, onFail, theme = 'light', apiUrl: apiUrlProp }) => {
  const apiUrl = getApiUrl(apiUrlProp);
  const [status, setStatus] = useState('idle'); // idle|collecting|mining|checking|puzzle|success|failed
  const [challenge, setChallenge] = useState(null);
  const [puzzleTab, setPuzzleTab] = useState('slide');
  const [message, setMessage] = useState('Klik untuk verifikasi bahwa kamu manusia.');
  const [score, setScore] = useState(null);
  const [honeypot, setHoneypot] = useState('');
  const busy = useRef(false);
  const snapshot = useBehavior();

  const fail = (err) => {
    setStatus('failed');
    setMessage(`❌ ${err.message}`);
    busy.current = false;
    onFail && onFail(err);
  };

  const succeed = (result) => {
    setStatus('success');
    setScore(result.score);
    setMessage(`✔ Terverifikasi sebagai manusia (skor ${result.score}, via ${result.method})`);
    busy.current = false;
    onSuccess && onSuccess(result.verifyToken, result);
  };

  const start = async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      setStatus('collecting');
      setMessage('Menganalisis perilaku manusia… (gerakkan mouse sedikit)');
      const ch = await (await fetch(`${apiUrl}/api/challenge`, { method: 'POST' })).json();
      if (!ch.ok && !ch.challengeId) throw new Error(ch.error || 'Gagal meminta challenge');
      setChallenge(ch);
      await new Promise((r) => setTimeout(r, COLLECT_MS));
      setStatus('mining');
      setMessage('Proof-of-Work: membuktikan perangkat asli…');
      const pow = await minePow(ch.challengeId, ch.powDifficulty);
      setStatus('checking');
      setMessage('Memverifikasi ke server…');
      const res = await (await fetch(`${apiUrl}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: ch.challengeId,
          powNonce: pow.nonce,
          behavior: snapshot(honeypot),
        }),
      })).json();
      if (res.success) return succeed(res);
      if (res.needPuzzle) {
        setScore(res.score);
        setStatus('puzzle');
        setMessage(`Skor ${res.score} — abu-abu, selesaikan satu puzzle di bawah`);
        return;
      }
      throw new Error(`Skor ${res.score ?? '?'} terlalu rendah — terdeteksi seperti bot. Coba lagi.`);
    } catch (err) {
      fail(err);
    }
  };

  const solvePuzzle = async (puzzle) => {
    try {
      setStatus('checking');
      setMessage('Memeriksa solusi puzzle…');
      const pow = await minePow(challenge.challengeId, challenge.powDifficulty);
      const res = await (await fetch(`${apiUrl}/api/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: challenge.challengeId,
          powNonce: pow.nonce,
          behavior: snapshot(honeypot),
          puzzle,
        }),
      })).json();
      if (res.success) return succeed(res);
      setStatus('puzzle');
      setScore(res.score);
      setMessage(`❌ Puzzle salah / terdeteksi bot (skor ${res.score ?? '?'}). Coba lagi atau ganti puzzle.`);
    } catch (err) {
      setStatus('puzzle');
      setMessage(`❌ ${err.message}`);
    }
  };

  const reset = () => {
    setStatus('idle');
    setChallenge(null);
    setScore(null);
    setHoneypot('');
    setMessage('Klik untuk verifikasi bahwa kamu manusia.');
    busy.current = false;
  };

  const working = status === 'collecting' || status === 'mining' || status === 'checking';

  return (
    <div className={`pg-card pg-${theme}`}>
      {/* Honeypot: manusia tidak pernah mengisi ini, bot sering mengisi */}
      <input
        className="pg-honeypot" tabIndex={-1} autoComplete="off"
        value={honeypot} onChange={(e) => setHoneypot(e.target.value)}
        placeholder="jangan diisi" aria-hidden="true"
      />
      <div className="pg-head">
        <div className={`pg-check ${status === 'success' ? 'ok' : ''}`}>
          {status === 'success' ? '✔' : working ? <span className="pg-spin" /> : '🛡'}
        </div>
        <div className="pg-head-text">
          <strong>Prasasti Guard</strong>
          <span>{message}</span>
        </div>
      </div>

      {(status === 'idle' || status === 'failed') && (
        <button type="button" className="pg-btn pg-big" onClick={start}>
          {status === 'failed' ? '↻ Coba lagi' : 'Saya bukan robot'}
        </button>
      )}
      {working && (
        <div className="pg-progress"><div className="pg-bar" /></div>
      )}

      {status === 'puzzle' && challenge && (
        <div className="pg-puzzle-wrap">
          <div className="pg-tabs">
            {['slide', 'rotate', 'sequence'].map((t) => (
              <button
                type="button" key={t}
                className={`pg-tab ${puzzleTab === t ? 'active' : ''}`}
                onClick={() => setPuzzleTab(t)}
              >
                {t === 'slide' ? '🧩 Slide' : t === 'rotate' ? '🔄 Rotate' : '🔢 Urutan'}
              </button>
            ))}
          </div>
          {puzzleTab === 'slide' && <SlidePuzzle slideX={challenge.slideX} onSolve={solvePuzzle} />}
          {puzzleTab === 'rotate' && <RotatePuzzle rotateStart={challenge.rotateStart} onSolve={solvePuzzle} />}
          {puzzleTab === 'sequence' && <SequencePuzzle onSolve={solvePuzzle} />}
        </div>
      )}

      {status === 'success' && (
        <button type="button" className="pg-link" onClick={reset}>Verifikasi lagi</button>
      )}

      <div className="pg-foot">
        <span>Protected by <b>Prasasti Guard</b> 🛡</span>
        {score !== null && <span className="pg-score">skor {score}/100</span>}
      </div>
    </div>
  );
};

export default PrasastiGuard;
