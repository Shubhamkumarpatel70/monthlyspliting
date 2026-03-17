import React, { useState, useEffect } from "react";
import { payments as paymentsApi } from "../api";

export default function PaymentModal({
  isOpen,
  onClose,
  transaction,
  groupId,
  month,
  currentUserId,
  onPaymentComplete,
}) {
  const [step, setStep] = useState("method"); // method, upi, confirm, success
  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [transactionId, setTransactionId] = useState("");
  const [notes, setNotes] = useState("");
  const [receiverUpi, setReceiverUpi] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showQR, setShowQR] = useState(false);

  const fromId = transaction?.from?._id || transaction?.from;
  const toId = transaction?.to?._id || transaction?.to;
  const fromName =
    transaction?.fromName ?? transaction?.from?.name ?? "Unknown";
  const toName = transaction?.toName ?? transaction?.to?.name ?? "Unknown";

  // Use remainingAmount if provided (for partial payments), otherwise use full amount
  const payableAmount =
    transaction?.remainingAmount != null && transaction?.remainingAmount > 0
      ? Number(transaction.remainingAmount)
      : Number(transaction?.amount || 0);
  const amount = payableAmount.toFixed(2);
  const totalAmount = Number(transaction?.amount || 0).toFixed(2);
  const isPartialPayment =
    transaction?.remainingAmount != null &&
    transaction?.remainingAmount > 0 &&
    transaction?.remainingAmount < Number(transaction?.amount || 0);

  const isCurrentUserPayer = currentUserId === fromId;

  useEffect(() => {
    if (isOpen && toId && groupId) {
      loadReceiverUpi();
    }
  }, [isOpen, toId, groupId]);

  const loadReceiverUpi = async () => {
    try {
      const data = await paymentsApi.getUpiId(groupId, toId);
      setReceiverUpi(data.upiId || "");
    } catch (err) {
      console.error("Failed to load UPI:", err);
    }
  };

  const generateUpiLink = () => {
    if (!receiverUpi) return null;
    const params = new URLSearchParams({
      pa: receiverUpi,
      pn: toName,
      am: amount,
      cu: "INR",
      tn: `Monthly Split - ${month}`,
    });
    return `upi://pay?${params.toString()}`;
  };

  const generateQRCodeUrl = () => {
    const upiLink = generateUpiLink();
    if (!upiLink) return null;
    // Use a QR code API service to generate the QR code
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink)}`;
  };

  const openUpiApp = () => {
    const upiLink = generateUpiLink();
    if (upiLink) {
      // Open the UPI deep link which will trigger the OS to show supported payment apps
      window.location.href = upiLink;
      // After a short delay, move to the confirmation step
      setTimeout(() => {
        setStep("upi");
      }, 500);
    } else {
      // If no UPI ID, just go to the UPI step to show the warning
      setStep("upi");
    }
  };

  const handlePayment = async () => {
    if (!transactionId.trim() && paymentMethod === "upi") {
      setError("Please enter UPI transaction ID");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await paymentsApi.create(groupId, {
        month,
        toUserId: toId,
        amount: payableAmount, // Use the payable amount (remaining for partial payments)
        paymentMethod,
        transactionId: transactionId.trim(),
        notes: notes.trim(),
      });
      setStep("success");
      if (onPaymentComplete) onPaymentComplete();
    } catch (err) {
      setError(err.message || "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep("method");
    setPaymentMethod("upi");
    setTransactionId("");
    setNotes("");
    setError("");
    setShowQR(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
      onClick={handleClose}
    >
      <div
        className="bg-surface rounded-2xl border border-white/10 w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-textPrimary">
            {step === "success"
              ? "Payment Recorded"
              : isPartialPayment
                ? "Pay Remaining Amount"
                : "Pay Settlement"}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-white/5 text-textSecondary"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Amount Display */}
          <div className="text-center py-4 bg-darkBg/50 rounded-xl border border-white/5">
            {isPartialPayment && (
              <p className="text-warning text-xs mb-2 font-medium">
                Remaining balance
              </p>
            )}
            <p className="text-textSecondary text-sm mb-1">Amount to pay</p>
            <p className="text-3xl font-bold text-success">₹{amount}</p>
            {isPartialPayment && (
              <p className="text-textSecondary text-xs mt-1">
                of total ₹{totalAmount}
              </p>
            )}
            <p className="text-textSecondary text-sm mt-2">
              <span className="text-danger">{fromName}</span> →{" "}
              <span className="text-success">{toName}</span>
            </p>
            <p className="text-textSecondary text-xs mt-1">
              Supports GPay, PhonePe, Paytm, BHIM and most UPI apps.
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-sm">
              {error}
            </div>
          )}

          {step === "method" && (
            <>
              <div className="space-y-3">
                <p className="text-textSecondary text-sm">
                  Select payment method:
                </p>

                <button
                  onClick={() => {
                    setPaymentMethod("upi");
                    openUpiApp();
                  }}
                  className="w-full p-4 rounded-xl bg-darkBg/50 border border-white/10 hover:border-primary/50 flex items-center gap-4 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-green-500 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">UPI</span>
                  </div>
                  <div className="text-left">
                    <p className="text-textPrimary font-medium">Pay via UPI</p>
                    <p className="text-textSecondary text-sm">
                      {receiverUpi
                        ? "Opens your UPI app"
                        : "GPay, PhonePe, Paytm, etc."}
                    </p>
                  </div>
                  {receiverUpi && (
                    <span className="px-2 py-1 rounded bg-success/20 text-success text-xs font-medium">
                      Ready
                    </span>
                  )}
                  <svg
                    className="w-5 h-5 text-textSecondary ml-auto"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>

                <button
                  onClick={() => {
                    setPaymentMethod("cash");
                    setStep("confirm");
                  }}
                  className="w-full p-4 rounded-xl bg-darkBg/50 border border-white/10 hover:border-primary/50 flex items-center gap-4 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-600 to-green-400 flex items-center justify-center">
                    <span className="text-white text-xl">💵</span>
                  </div>
                  <div className="text-left">
                    <p className="text-textPrimary font-medium">Cash</p>
                    <p className="text-textSecondary text-sm">
                      Pay in cash directly
                    </p>
                  </div>
                  <svg
                    className="w-5 h-5 text-textSecondary ml-auto"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>

                <button
                  onClick={() => {
                    setPaymentMethod("bank_transfer");
                    setStep("confirm");
                  }}
                  className="w-full p-4 rounded-xl bg-darkBg/50 border border-white/10 hover:border-primary/50 flex items-center gap-4 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-400 flex items-center justify-center">
                    <span className="text-white text-xl">🏦</span>
                  </div>
                  <div className="text-left">
                    <p className="text-textPrimary font-medium">
                      Bank Transfer
                    </p>
                    <p className="text-textSecondary text-sm">
                      NEFT, IMPS, RTGS
                    </p>
                  </div>
                  <svg
                    className="w-5 h-5 text-textSecondary ml-auto"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>
            </>
          )}

          {step === "upi" && (
            <>
              {receiverUpi ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-darkBg/50 border border-white/5">
                    <p className="text-textSecondary text-sm mb-1">
                      Receiver's UPI ID
                    </p>
                    <p className="text-textPrimary font-mono text-lg">
                      {receiverUpi}
                    </p>
                  </div>

                  {/* Scan & Pay QR Code */}
                  {showQR ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-textPrimary font-medium">
                          Scan & Pay
                        </p>
                        <button
                          onClick={() => setShowQR(false)}
                          className="text-textSecondary hover:text-primary text-sm"
                        >
                          Hide QR
                        </button>
                      </div>
                      <div className="flex flex-col items-center p-4 bg-white rounded-xl">
                        <img
                          src={generateQRCodeUrl()}
                          alt="UPI QR Code"
                          className="w-48 h-48"
                        />
                        <p className="mt-2 text-gray-600 text-sm font-medium">
                          ₹{amount}
                        </p>
                      </div>
                      <p className="text-textSecondary text-xs text-center">
                        Scan this QR code with any UPI app (GPay, PhonePe,
                        Paytm, etc.)
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowQR(true)}
                      className="w-full py-3 px-4 rounded-xl bg-surface border-2 border-dashed border-primary/50 text-primary font-medium hover:bg-primary/10 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                        />
                      </svg>
                      Scan & Pay (Show QR Code)
                    </button>
                  )}

                  <div className="text-center text-textSecondary text-sm">
                    <p>— OR —</p>
                  </div>

                  {/* UPI Deep Link Button */}
                  <button
                    onClick={() => {
                      window.location.href = generateUpiLink();
                    }}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-green-500 text-white font-semibold text-center hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                    Open UPI App to Pay ₹{amount}
                  </button>

                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(receiverUpi);
                    }}
                    className="w-full py-2 px-4 rounded-lg bg-surface border border-white/10 text-textPrimary hover:border-primary/30 flex items-center justify-center gap-2"
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
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Copy UPI ID
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-warning/10 border border-warning/30 text-warning text-sm">
                  <p className="font-medium mb-1">UPI ID not set</p>
                  <p>
                    {toName} hasn't added their UPI ID yet. Please ask them to
                    add it in their profile, or pay via another method.
                  </p>
                </div>
              )}

              <div className="border-t border-white/5 pt-4 mt-4">
                <p className="text-textSecondary text-sm mb-3">
                  After payment, enter transaction details:
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-textSecondary text-sm mb-1 block">
                      UPI Transaction ID / Reference
                    </label>
                    <input
                      type="text"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="e.g., 123456789012"
                      className="w-full px-4 py-3 rounded-xl bg-darkBg border border-white/10 text-textPrimary placeholder-textSecondary/50 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-textSecondary text-sm mb-1 block">
                      Notes (optional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any notes for the payment"
                      className="w-full px-4 py-3 rounded-xl bg-darkBg border border-white/10 text-textPrimary placeholder-textSecondary/50 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep("method")}
                  className="flex-1 py-3 px-4 rounded-xl bg-surface border border-white/10 text-textPrimary hover:bg-white/5"
                >
                  Back
                </button>
                <button
                  onClick={handlePayment}
                  disabled={loading || !transactionId.trim()}
                  className="flex-1 py-3 px-4 rounded-xl bg-primary text-darkBg font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Recording..." : "I have paid"}
                </button>
              </div>
            </>
          )}

          {step === "confirm" && (
            <>
              <div className="space-y-3">
                <p className="text-textSecondary text-sm">
                  {paymentMethod === "cash"
                    ? "Confirm that you have paid in cash:"
                    : "Enter bank transfer details:"}
                </p>
                <div>
                  <label className="text-textSecondary text-sm mb-1 block">
                    {paymentMethod === "cash"
                      ? "Reference (optional)"
                      : "Transaction ID / Reference"}
                  </label>
                  <input
                    type="text"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    placeholder={
                      paymentMethod === "cash"
                        ? "e.g., date/location"
                        : "e.g., UTR number"
                    }
                    className="w-full px-4 py-3 rounded-xl bg-darkBg border border-white/10 text-textPrimary placeholder-textSecondary/50 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-textSecondary text-sm mb-1 block">
                    Notes (optional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any notes for the payment"
                    className="w-full px-4 py-3 rounded-xl bg-darkBg border border-white/10 text-textPrimary placeholder-textSecondary/50 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setStep("method")}
                  className="flex-1 py-3 px-4 rounded-xl bg-surface border border-white/10 text-textPrimary hover:bg-white/5"
                >
                  Back
                </button>
                <button
                  onClick={handlePayment}
                  disabled={loading}
                  className="flex-1 py-3 px-4 rounded-xl bg-primary text-darkBg font-semibold hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading ? "Recording..." : "Confirm Payment"}
                </button>
              </div>
            </>
          )}

          {step === "success" && (
            <div className="text-center py-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/20 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-success"
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
              </div>
              <h3 className="text-lg font-semibold text-textPrimary mb-2">
                Payment Recorded!
              </h3>
              <p className="text-textSecondary text-sm mb-4">
                Your payment of ₹{amount} to {toName} has been recorded. They
                will need to confirm receipt.
              </p>
              <button
                onClick={handleClose}
                className="w-full py-3 px-4 rounded-xl bg-primary text-darkBg font-semibold hover:bg-primary/90"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
