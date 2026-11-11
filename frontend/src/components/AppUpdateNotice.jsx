import React, { useEffect, useState } from 'react';

const UPDATE_URL = '/app-update.json';
const FALLBACK_APK_URL = 'https://github.com/Shubhamkumarpatel70/monthlyspliting/releases/latest';

export default function AppUpdateNotice() {
  const [update, setUpdate] = useState(null);
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(UPDATE_URL, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('Update info unavailable');
        return response.json();
      })
      .then((data) => {
        if (!active || !data?.version) return;
        setUpdate(data);
        const key = 'monthly-split-seen-version';
        const seen = localStorage.getItem(key);
        if (!seen) {
          localStorage.setItem(key, data.version);
        } else if (seen !== data.version) {
          setShowUpdate(true);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const dismiss = () => {
    if (update?.version) {
      localStorage.setItem('monthly-split-seen-version', update.version);
    }
    setShowUpdate(false);
  };

  const apkUrl = update?.apkUrl || FALLBACK_APK_URL;

  return (
    <>
      <a
        href={apkUrl}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-darkBg shadow-xl hover:opacity-90"
        aria-label="Download Monthly Split Android APK"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v3h16v-3" />
        </svg>
        Download App
      </a>

      {showUpdate && update && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-surface p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v3m0 12v3m9-9h-3M6 12H3m15.36-6.36-2.12 2.12M7.76 16.24l-2.12 2.12m12.72 0-2.12-2.12M7.76 7.76 5.64 5.64" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-textPrimary">{update.title || 'What’s New?'}</p>
                <p className="text-xs text-textSecondary">Monthly Split • Version {update.version}</p>
              </div>
            </div>
            <p className="mb-5 text-sm leading-6 text-textSecondary">
              {update.message || 'New improvements are now available.'}
            </p>
            <button onClick={dismiss} className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-darkBg">
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
