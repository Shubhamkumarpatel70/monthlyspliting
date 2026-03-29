/**
 * Backend-only balance calculation.
 * Total monthly expense, per-person share, individual paid total, net balance (paid - share).
 */

export function getMonthFromDate(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function toIdString(x) {
  if (!x) return "";
  if (typeof x === "string") return x;
  if (typeof x === "object" && x._id) return String(x._id);
  return String(x);
}

function getExpenseParticipants(expense, memberIds) {
  const parts = Array.isArray(expense?.participants)
    ? expense.participants.map(toIdString).filter(Boolean)
    : [];
  const unique = [...new Set(parts)];
  const valid = unique.filter((id) => memberIds.includes(id));
  return valid.length ? valid : memberIds;
}

function getExpenseShareMap(expense, memberIds) {
  const amt = Number(expense?.amount || 0);
  const participants = getExpenseParticipants(expense, memberIds);
  const splitType = expense?.splitType || "equal";
  const out = {};

  if (!participants.length || amt <= 0) return out;

  // Mongoose Map can serialize to object; handle both
  const valuesObj =
    expense?.splitValues && typeof expense.splitValues === "object"
      ? expense.splitValues instanceof Map
        ? Object.fromEntries(expense.splitValues.entries())
        : expense.splitValues
      : null;

  if (splitType === "percentage" && valuesObj) {
    participants.forEach((id) => {
      const pct = Number(valuesObj[id] ?? 0);
      if (Number.isFinite(pct) && pct > 0) out[id] = (amt * pct) / 100;
    });
    return out;
  }

  if (splitType === "exact" && valuesObj) {
    participants.forEach((id) => {
      const v = Number(valuesObj[id] ?? 0);
      if (Number.isFinite(v) && v > 0) out[id] = v;
    });
    return out;
  }

  // default: equal split
  const per = amt / participants.length;
  participants.forEach((id) => {
    out[id] = per;
  });
  return out;
}

export function computeMonthlyBalances(expenses, memberIds, advances = []) {
  const memberIdStrs = (memberIds || []).map((id) => id.toString());
  if (!memberIds?.length) {
    return {
      totalExpense: 0,
      totalAdvance: 0,
      netExpense: 0,
      sharePerPerson: 0,
      paidByUser: {},
      balances: {},
    };
  }
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalAdvance = advances.reduce((sum, a) => sum + a.amount, 0);
  const numMembers = memberIds.length;
  // Backwards-compatible "originalShare" (equal split across all members)
  const originalShare = numMembers > 0 ? totalExpense / numMembers : 0;
  const advanceShare = numMembers > 0 ? totalAdvance / numMembers : 0;

  const effectiveExpense = totalExpense - totalAdvance;
  let finalShare = 0; // legacy per-person share after advances
  let surplusCredit = 0;

  if (effectiveExpense > 0 && numMembers > 0) {
    finalShare = effectiveExpense / numMembers;
  } else {
    finalShare = 0;
    if (totalAdvance > totalExpense) {
      surplusCredit = totalAdvance - totalExpense;
    }
  }
  const paidByUser = {};
  memberIdStrs.forEach((id) => {
    paidByUser[id] = 0;
  });
  expenses.forEach((e) => {
    let key;
    if (e.payer && typeof e.payer === "object" && e.payer._id) {
      key = e.payer._id.toString();
    } else {
      key = e.payer?.toString();
    }
    if (key && paidByUser[key] !== undefined) {
      paidByUser[key] += e.amount;
    }
  });

  // Share owed by each member (based on per-expense participants + splitType)
  const shareByUser = {};
  memberIdStrs.forEach((id) => (shareByUser[id] = 0));
  expenses.forEach((e) => {
    const shareMap = getExpenseShareMap(e, memberIdStrs);
    Object.entries(shareMap).forEach(([id, share]) => {
      if (shareByUser[id] !== undefined) shareByUser[id] += Number(share) || 0;
    });
  });

  const balances = {};
  let netSum = 0;
  // Calculate advances received by each member
  const advancesByUser = {};
  memberIdStrs.forEach((id) => {
    advancesByUser[id] = 0;
  });
  advances.forEach((a) => {
    const key = a.user?._id?.toString() || a.user?.toString() || a.user;
    if (key && advancesByUser[key] !== undefined) {
      advancesByUser[key] += a.amount;
    }
  });

  memberIdStrs.forEach((idStr) => {
    const paid = paidByUser[idStr] ?? 0;
    const share = shareByUser[idStr] ?? 0;
    const originalNet = paid - share;
    // Apply advances equally as shared credit
    const finalNet = paid - share + advanceShare;
    const advanceReceived = advancesByUser[idStr] ?? 0;
    let status = "-";
    if (finalNet < 0) status = `Pays ₹${Math.abs(finalNet).toFixed(2)}`;
    else if (finalNet > 0) status = `Gets ₹${finalNet.toFixed(2)}`;
    balances[idStr] = {
      paid,
      share,
      originalNet,
      advanceShare,
      advanceReceived,
      finalNet,
      status,
    };
    netSum += finalNet;
  });
  // Ensure sum of all final nets = 0 (floating point tolerance)
  if (Math.abs(netSum) > 0.01) {
    console.warn("Final net sum not zero:", netSum);
  }
  return {
    totalExpense,
    totalAdvance,
    originalShare,
    advanceShare,
    finalShare,
    // Backwards-compatible alias for "per person share"
    sharePerPerson: finalShare,
    effectiveExpense,
    surplusCredit,
    paidByUser,
    balances,
  };
}
