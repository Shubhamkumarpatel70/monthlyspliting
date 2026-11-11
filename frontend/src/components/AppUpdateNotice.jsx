import React, { useEffect, useState } from 'react';

const UPDATE_URL = '/app-update.json';
const FALLBACK_APK_URL = 'https://github.com/Shubhamkumarpatel70/monthlyspliting/releases/latest';
const ACK_KEY = 'monthly-split-acknowledged-version';
const SNOOZE_KEY = 'monthly-split-update-remind-at';
const REMIND_AFTER_MS = 36 * 60 * 60 * 1000;

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

        const acknowledgedVersion = localStorage.getItem(ACK_KEY);
        const legacySeenVersion = localStorage.getItem('monthly-split-seen-version');

        // First visit: establish the current version without showing a false update alert.
        if (!acknowledgedVersion && !legacySeenVersion) {
          localStorage.setItem(ACK_KEY, data.version);
          return;
        }

        // The user has already confirmed this version; do not show it again.
        if (acknowledgedVersion === data.version) return;

        // A reminder was dismissed recently; wait 36 hours before showing it again.
        const remindAt = Number(localStorage.getItem(SNOOZE_KEY) || 0);
        if (Date.now() < remindAt) return;

        setShowUpdate(true);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const confirmUpdated = () => {
    if (update?.version) {
      localStorage.setItem(ACK_KEY, update.version);
      localStorage.removeItem(SNOOZE_KEY);
    }
    setShowUpdate(false);
    // The app loads the live website, so reload applies the latest deployed website.
    window.location.reload();
  };

  const remindLater = () => {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + REMIND_AFTER_MS));
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
            <div className="flex flex-col gap-2">
              <button onClick={confirmUpdated} className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-darkBg">
                Update now
              </button>
              <button onClick={remindLater} className="w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-textSecondary">
                Remind me later
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
