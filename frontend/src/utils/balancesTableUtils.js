// Utility functions for Balances before and after advance table

export function getPaidLabel(paid, name) {
  if (paid > 0) {
    return `Paid by ${name}`;
  }
  return "";
}

export function getStatusLabel(finalNet) {
  if (finalNet < 0) {
    return `Pays ₹${Math.abs(finalNet).toFixed(2)}`;
  } else if (finalNet > 0) {
    return `Gets ₹${finalNet.toFixed(2)}`;
  }
  return "—";
}

export function getAdvanceDisplay(advanceShare, advanceReceived) {
  if (advanceReceived !== advanceShare) {
    return `+₹${advanceShare.toFixed(2)}\nActual: ₹${advanceReceived.toFixed(2)}`;
  }
  return `+₹${advanceShare.toFixed(2)}`;
}
