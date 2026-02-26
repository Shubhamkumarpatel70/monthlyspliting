import React, { useState } from "react";
import PaymentModal from "./PaymentModal";

export default function SettlementView({
  settlement,
  onStatusChange,
  isAdmin,
  groupId,
  month,
  currentUserId,
  payments = [],
  onPaymentComplete,
  onConfirmPayment,
  onRejectPayment,
}) {
  const transactions =
    settlement?.transactionsWithNames ?? settlement?.transactions ?? [];
  const status = settlement?.status ?? "pending";
  const [paymentModal, setPaymentModal] = useState({
    open: false,
    transaction: null,
  });

  // Helper to get display name - shows "You" for current user
  const getDisplayName = (user, fallbackName) => {
    const userId = user?._id || user;
    if (userId === currentUserId) {
      return "You";
    }
    return fallbackName ?? user?.name ?? user;
  };

  // Check if a transaction has a pending or completed payment
  const getPaymentForTransaction = (transaction) => {
    const fromId = transaction.from?._id || transaction.from;
    const toId = transaction.to?._id || transaction.to;

    // Find payment matching this transaction (from same person to same person)
    return payments.find(
      (p) =>
        (p.from?._id || p.from) === fromId &&
        (p.to?._id || p.to) === toId &&
        ["pending", "completed"].includes(p.status),
    );
  };

  // Get total paid amount for a transaction (sum of all completed payments)
  const getTotalPaidForTransaction = (transaction) => {
    const fromId = transaction.from?._id || transaction.from;
    const toId = transaction.to?._id || transaction.to;

    return payments
      .filter(
        (p) =>
          (p.from?._id || p.from) === fromId &&
          (p.to?._id || p.to) === toId &&
          p.status === "completed",
      )
      .reduce((sum, p) => sum + Number(p.amount), 0);
  };

  // Check if there's a pending payment for this transaction
  const hasPendingPayment = (transaction) => {
    const fromId = transaction.from?._id || transaction.from;
    const toId = transaction.to?._id || transaction.to;

    return payments.some(
      (p) =>
        (p.from?._id || p.from) === fromId &&
        (p.to?._id || p.to) === toId &&
        p.status === "pending",
    );
  };

  // Get the pending payment for this transaction
  const getPendingPayment = (transaction) => {
    const fromId = transaction.from?._id || transaction.from;
    const toId = transaction.to?._id || transaction.to;

    return payments.find(
      (p) =>
        (p.from?._id || p.from) === fromId &&
        (p.to?._id || p.to) === toId &&
        p.status === "pending",
    );
  };

  // Check if payment amount matches the current settlement amount
  const isPaymentAmountMatching = (payment, transaction) => {
    if (!payment) return false;
    const totalPaid = getTotalPaidForTransaction(transaction);
    const transactionAmount = Number(transaction.amount);
    return Math.abs(totalPaid - transactionAmount) < 0.01;
  };

  const canUserPay = (transaction) => {
    const fromId = transaction.from?._id || transaction.from;
    return currentUserId === fromId && status !== "settled";
  };

  const canUserConfirm = (payment) => {
    const toId = payment.to?._id || payment.to;
    return currentUserId === toId && payment.status === "pending";
  };

  const handlePayClick = (transaction) => {
    setPaymentModal({ open: true, transaction });
  };

  return (
    <div className="bg-surface rounded-2xl border border-white/5 overflow-hidden relative">
      {status === "settled" && (
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
            <rect
              x="4"
              y="4"
              width="152"
              height="88"
              rx="8"
              stroke="#dc2626"
              strokeWidth="3"
              fill="none"
            />
            {/* Inner border */}
            <rect
              x="10"
              y="10"
              width="140"
              height="76"
              rx="6"
              stroke="#dc2626"
              strokeWidth="2"
              fill="none"
            />
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
        <h2 className="text-lg font-semibold text-textPrimary">
          Settlement — Who pays whom
        </h2>
        {isAdmin && onStatusChange && (
          <div className="flex gap-2">
            {status !== "settled" && (
              <button
                onClick={() => onStatusChange("settled")}
                className="px-3 py-1.5 rounded-lg bg-success/20 text-success text-sm font-medium hover:bg-success/30"
              >
                Mark as settled
              </button>
            )}
            {status !== "archived" && (
              <button
                onClick={() => onStatusChange("archived")}
                className="px-3 py-1.5 rounded-lg bg-warning/20 text-warning text-sm font-medium hover:bg-warning/30"
              >
                Archive month
              </button>
            )}
            {status !== "pending" && (
              <button
                onClick={() => onStatusChange("pending")}
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
            Status:{" "}
            <span className="capitalize text-textPrimary font-medium">
              {settlement.status}
            </span>
            {settlement.settledAt && (
              <span className="ml-2">
                Settled on {new Date(settlement.settledAt).toLocaleDateString()}
              </span>
            )}
          </p>
        )}
        {transactions.length === 0 ? (
          <p className="text-textSecondary text-sm">
            No transfers needed — balances are even.
          </p>
        ) : (
          <ul className="space-y-3">
            {transactions.map((t, i) => {
              const payment = getPaymentForTransaction(t);
              const totalPaid = getTotalPaidForTransaction(t);
              const transactionAmount = Number(t.amount);
              const isPending = hasPendingPayment(t);
              const isFullyPaid =
                Math.abs(totalPaid - transactionAmount) < 0.01;
              const isPartiallyPaid = totalPaid > 0 && !isFullyPaid;
              const remainingAmount = transactionAmount - totalPaid;

              const showPayButton = canUserPay(t) && !isPending && !isFullyPaid;
              const showConfirmButton =
                payment &&
                canUserConfirm(payment) &&
                payment.status === "pending";

              return (
                <li
                  key={i}
                  className={`p-4 rounded-xl bg-darkBg/50 border ${isFullyPaid ? "border-success/30" : isPending ? "border-warning/30" : isPartiallyPaid ? "border-primary/30" : "border-white/5"}`}
                >
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-2 flex-wrap flex-1">
                      <span className="text-danger font-medium text-base">
                        {getDisplayName(t.from, t.fromName)}
                      </span>
                      <span className="text-textSecondary">
                        {isFullyPaid
                          ? "paid"
                          : status === "settled"
                            ? "paid"
                            : "pays"}
                      </span>
                      <span className="text-primary font-bold text-lg">
                        ₹{Number(t.amount).toFixed(2)}
                      </span>
                      <span className="text-textSecondary">to</span>
                      <span className="text-success font-medium text-base">
                        {getDisplayName(t.to, t.toName)}
                      </span>
                    </div>

                    {/* Payment Status Badge */}
                    {isFullyPaid && (
                      <span className="px-3 py-1.5 rounded-lg bg-success/20 text-success text-xs font-semibold flex items-center gap-1">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Confirmed
                      </span>
                    )}
                    {isPartiallyPaid && !isPending && (
                      <span className="px-3 py-1.5 rounded-lg bg-warning/20 text-warning text-xs font-medium">
                        Paid ₹{totalPaid.toFixed(2)} / ₹
                        {transactionAmount.toFixed(2)}
                      </span>
                    )}
                    {isPending && (
                      <span className="px-3 py-1.5 rounded-lg bg-warning/20 text-warning text-xs font-medium animate-pulse">
                        Awaiting confirmation
                      </span>
                    )}
                  </div>

                  {/* Action Buttons */}
                  {(showPayButton ||
                    showConfirmButton ||
                    (isPending && !showConfirmButton)) && (
                    <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-white/5">
                      {showPayButton && (
                        <button
                          onClick={() =>
                            handlePayClick({ ...t, remainingAmount })
                          }
                          className="px-4 py-2.5 rounded-lg bg-primary text-darkBg text-sm font-semibold hover:bg-primary/90 touch-manipulation flex items-center gap-2"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                            />
                          </svg>
                          {isPartiallyPaid
                            ? `Pay ₹${remainingAmount.toFixed(2)} more`
                            : "Pay Now"}
                        </button>
                      )}

                      {showConfirmButton && (
                        <div className="w-full space-y-3">
                          {/* Payment Details for Confirmation */}
                          <div className="bg-darkBg/80 border border-white/10 rounded-lg p-3 space-y-2">
                            <p className="text-sm text-textSecondary font-medium">
                              Payment Details:
                            </p>
                            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                              <div>
                                <span className="text-textSecondary">
                                  Amount:{" "}
                                </span>
                                <span className="text-primary font-semibold">
                                  ₹{Number(payment.amount).toFixed(2)}
                                </span>
                              </div>
                              <div>
                                <span className="text-textSecondary">
                                  Method:{" "}
                                </span>
                                <span className="text-white capitalize">
                                  {payment.paymentMethod || "N/A"}
                                </span>
                              </div>
                              {payment.transactionId && (
                                <div>
                                  <span className="text-textSecondary">
                                    UPI Ref/Transaction ID:{" "}
                                  </span>
                                  <span className="text-warning font-mono">
                                    {payment.transactionId}
                                  </span>
                                </div>
                              )}
                              {payment.paidAt && (
                                <div>
                                  <span className="text-textSecondary">
                                    Paid on:{" "}
                                  </span>
                                  <span className="text-white">
                                    {new Date(
                                      payment.paidAt,
                                    ).toLocaleDateString("en-IN", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                              )}
                              {payment.notes && (
                                <div className="w-full">
                                  <span className="text-textSecondary">
                                    Notes:{" "}
                                  </span>
                                  <span className="text-white/80">
                                    {payment.notes}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Confirm/Reject Buttons */}
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              onClick={() =>
                                onConfirmPayment &&
                                onConfirmPayment(payment._id)
                              }
                              className="px-4 py-2.5 rounded-lg bg-success text-white text-sm font-semibold hover:bg-success/90 touch-manipulation flex items-center gap-2"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              Confirm Received
                            </button>
                            <button
                              onClick={() =>
                                onRejectPayment && onRejectPayment(payment._id)
                              }
                              className="px-3 py-2.5 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm hover:bg-danger/20 touch-manipulation"
                            >
                              Not Received
                            </button>
                          </div>
                        </div>
                      )}

                      {isPending && !showConfirmButton && (
                        <div className="w-full space-y-2">
                          {/* Show payment details to payer */}
                          {payment && (
                            <div className="bg-darkBg/60 border border-warning/20 rounded-lg p-3 space-y-2">
                              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                                <div>
                                  <span className="text-textSecondary">
                                    Amount:{" "}
                                  </span>
                                  <span className="text-primary font-semibold">
                                    ₹{Number(payment.amount).toFixed(2)}
                                  </span>
                                </div>
                                {payment.transactionId && (
                                  <div>
                                    <span className="text-textSecondary">
                                      UPI Ref:{" "}
                                    </span>
                                    <span className="text-warning font-mono text-xs">
                                      {payment.transactionId}
                                    </span>
                                  </div>
                                )}
                                {payment.paidAt && (
                                  <div>
                                    <span className="text-textSecondary">
                                      Paid:{" "}
                                    </span>
                                    <span className="text-white/80 text-xs">
                                      {new Date(
                                        payment.paidAt,
                                      ).toLocaleDateString("en-IN", {
                                        day: "numeric",
                                        month: "short",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          <p className="text-textSecondary text-sm flex items-center gap-2">
                            <svg
                              className="w-4 h-4 animate-spin"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            Waiting for {getDisplayName(t.to, t.toName)} to
                            confirm
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={paymentModal.open}
        onClose={() => setPaymentModal({ open: false, transaction: null })}
        transaction={paymentModal.transaction}
        groupId={groupId}
        month={month}
        currentUserId={currentUserId}
        onPaymentComplete={() => {
          setPaymentModal({ open: false, transaction: null });
          if (onPaymentComplete) onPaymentComplete();
        }}
      />
    </div>
  );
}
