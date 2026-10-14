import React, { useState, useEffect } from 'react';
import { X, Sparkles, Zap, Bug, Trash2, PartyPopper } from 'lucide-react';
import { changelog, APP_VERSION, getChangeTypeConfig } from '../data/changelog';

const SEEN_KEY = 'changelog_seen_version';

const iconFor = (type) => {
  switch (type) {
    case 'new': return <Sparkles className="w-3.5 h-3.5" />;
    case 'improved': return <Zap className="w-3.5 h-3.5" />;
    case 'fix': return <Bug className="w-3.5 h-3.5" />;
    case 'removed': return <Trash2 className="w-3.5 h-3.5" />;
    default: return <Sparkles className="w-3.5 h-3.5" />;
  }
};

/**
 * Modal "Apa yang baru" — muncul 1x saat versi berubah (first open),
 * Close = tidak akan muncul lagi sampai ada update berikutnya.
 */
const ChangelogModal = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(SEEN_KEY) || '';
      if (seen !== String(APP_VERSION)) setIsOpen(true);
    } catch {
      setIsOpen(true);
    }
  }, []);

  const closeForever = () => {
    try {
      localStorage.setItem(SEEN_KEY, String(APP_VERSION));
    } catch {
      /* abaikan */
    }
    setIsOpen(false);
  };

  if (!isOpen) return null;

  const latest = changelog[0] || { version: APP_VERSION, date: '', changes: [] };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex-shrink-0 flex items-center justify-between p-5 border-b border-gray-200 bg-gradient-to-r from-primary-600 to-primary-700 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <PartyPopper className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Apa yang Baru? v{latest.version}</h3>
              <p className="text-xs text-white/80">{latest.date || ''}</p>
            </div>
          </div>
          <button onClick={closeForever} className="p-2 hover:bg-white/10 rounded-lg transition-colors" title="Tutup dan jangan tampilkan lagi">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {(latest.changes || []).map((c, i) => {
            const cfg = getChangeTypeConfig(c.type);
            return (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${cfg.bgColor} ${cfg.borderColor}`}>
                <span className={`mt-0.5 ${cfg.textColor}`}>{iconFor(c.type)}</span>
                <div className="flex-1">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${cfg.bgColor} ${cfg.textColor} border ${cfg.borderColor} mb-1`}>
                    {cfg.label}
                  </span>
                  <p className="text-sm text-gray-800">{c.text}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex-shrink-0 p-4 border-t border-gray-200">
          <button
            onClick={closeForever}
            className="w-full px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            Saya Mengerti
          </button>
          <p className="text-[11px] text-gray-400 text-center mt-2">
            Jendela ini tidak akan muncul lagi sampai ada update berikutnya.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChangelogModal;
