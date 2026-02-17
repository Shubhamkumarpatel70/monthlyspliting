import React from 'react';

export default function SettlementView({ settlement, onStatusChange, isAdmin }) {
  const transactions = settlement?.transactionsWithNames ?? settlement?.transactions ?? [];
  const status = settlement?.status ?? 'pending';

  return (
    <div className="bg-surface rounded-2xl border border-white/5 overflow-hidden relative">
      {status === 'settled' && (
        <div
          className="stamp-animate absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10"
          aria-hidden
        >
          <svg
            className="w-32 h-20 sm:w-40 sm:h-24 drop-shadow-lg"
            viewBox="0 0 160 96"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Double-line rectangular border (outer) */}
            <rect x="4" y="4" width="152" height="88" rx="8" stroke="#dc2626" strokeWidth="3" fill="none" />
            {/* Inner border */}
            <rect x="10" y="10" width="140" height="76" rx="6" stroke="#dc2626" strokeWidth="2" fill="none" />
            {/* Left dot */}
            <circle cx="38" cy="48" r="5" fill="#dc2626" />
            {/* Right dot */}
            <circle cx="122" cy="48" r="5" fill="#dc2626" />
            {/* PAID text */}
            <text
              x="80"
              y="56"
              textAnchor="middle"
              fill="#dc2626"
              fontFamily="system-ui, sans-serif"
              fontSize="32"
              fontWeight="800"
              letterSpacing="4"
            >
              PAID
            </text>
          </svg>
        </div>
      )}
      <div className="px-5 py-4 border-b border-white/5 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-textPrimary">Settlement — Who pays whom</h2>
        {isAdmin && onStatusChange && (
          <div className="flex gap-2">
            {status !== 'settled' && (
              <button
                onClick={() => onStatusChange('settled')}
                className="px-3 py-1.5 rounded-lg bg-success/20 text-success text-sm font-medium hover:bg-success/30"
              >
                Mark as settled
              </button>
            )}
            {status !== 'archived' && (
              <button
                onClick={() => onStatusChange('archived')}
                className="px-3 py-1.5 rounded-lg bg-warning/20 text-warning text-sm font-medium hover:bg-warning/30"
              >
                Archive month
              </button>
            )}
            {status !== 'pending' && (
              <button
                onClick={() => onStatusChange('pending')}
                className="px-3 py-1.5 rounded-lg bg-surface border border-white/10 text-textSecondary text-sm hover:bg-white/5"
              >
                Reset to pending
              </button>
            )}
          </div>
        )}
      </div>
      <div className="p-5">
        {settlement?.status && (
          <p className="text-textSecondary text-sm mb-4">
            Status: <span className="capitalize text-textPrimary font-medium">{settlement.status}</span>
            {settlement.settledAt && (
              <span className="ml-2">Settled on {new Date(settlement.settledAt).toLocaleDateString()}</span>
            )}
          </p>
        )}
        {transactions.length === 0 ? (
          <p className="text-textSecondary text-sm">No transfers needed — balances are even.</p>
        ) : (
          <ul className="space-y-3">
            {transactions.map((t, i) => (
              <li
                key={i}
                className="flex items-center gap-3 p-3 rounded-xl bg-darkBg/50 border border-white/5"
              >
                <span className="text-danger font-medium">{t.fromName ?? t.from?.name ?? t.from}</span>
                <span className="text-textSecondary">pays</span>
                <span className="text-success font-medium">₹{Number(t.amount).toFixed(2)}</span>
                <span className="text-textSecondary">to</span>
                <span className="text-success font-medium">{t.toName ?? t.to?.name ?? t.to}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
