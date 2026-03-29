// Utility to compute per-member balances for frontend display
export function computeBalances({
  expenses,
  members,
  advances = [],
  settlements = [],
}) {
  const memberIds = members.map((m) => m._id || m.id || m);
  const totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const numMembers = memberIds.length;
  const originalShare =
    numMembers > 0 ? +(totalExpense / numMembers).toFixed(2) : 0;
  const totalAdvance = advances.reduce((sum, a) => sum + Number(a.amount), 0);
  const advanceShare =
    numMembers > 0 ? +(totalAdvance / numMembers).toFixed(2) : 0;
  const effectiveExpense = +(totalExpense - totalAdvance).toFixed(2);
  let finalShare = 0;
  let surplusCredit = 0;
  if (numMembers === 1) {
    finalShare = 0;
    surplusCredit =
      totalAdvance > totalExpense
        ? +(totalAdvance - totalExpense).toFixed(2)
        : 0;
  } else if (effectiveExpense > 0) {
    finalShare = +(effectiveExpense / numMembers).toFixed(2);
    surplusCredit = 0;
  } else {
    finalShare = 0;
    surplusCredit =
      totalAdvance > totalExpense
        ? +(totalAdvance - totalExpense).toFixed(2)
        : 0;
  }

  // Paid by each member
  const paidByUser = {};
  memberIds.forEach((id) => {
    paidByUser[id] = 0;
  });
  expenses.forEach((e) => {
    const key = e.payer?._id || e.payer?.id || e.payer;
    if (key && paidByUser[key] !== undefined)
      paidByUser[key] += Number(e.amount);
  });

  const toIdString = (x) => (x?._id || x?.id || x ? String(x._id || x.id || x) : "");

  const getExpenseParticipants = (e) => {
    const parts = Array.isArray(e?.participants)
      ? e.participants.map(toIdString).filter(Boolean)
      : [];
    const unique = [...new Set(parts)];
    const valid = unique.filter((id) => memberIds.includes(id));
    return valid.length ? valid : memberIds;
  };

  const getExpenseShareMap = (e) => {
    const amt = Number(e?.amount || 0);
    const participants = getExpenseParticipants(e);
    const splitType = e?.splitType || "equal";
    const out = {};
    if (!participants.length || amt <= 0) return out;

    const valuesObj =
      e?.splitValues && typeof e.splitValues === "object" ? e.splitValues : null;

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

    const per = amt / participants.length;
    participants.forEach((id) => {
      out[id] = per;
    });
    return out;
  };

  // Share owed by each member based on splits (defaults to equal across all)
  const shareByUser = {};
  memberIds.forEach((id) => {
    shareByUser[id] = 0;
  });
  expenses.forEach((e) => {
    const shareMap = getExpenseShareMap(e);
    Object.entries(shareMap).forEach(([id, share]) => {
      if (shareByUser[id] !== undefined) shareByUser[id] += Number(share) || 0;
    });
  });

  // Advances received by each member
  const advancesByUser = {};
  memberIds.forEach((id) => {
    advancesByUser[id] = 0;
  });
  advances.forEach((a) => {
    const key = a.user?._id || a.user?.id || a.user;
    if (key && advancesByUser[key] !== undefined)
      advancesByUser[key] += Number(a.amount);
  });

  // Settlement amounts for each member
  const settlementByUser = {};
  memberIds.forEach((id) => {
    settlementByUser[id] = 0;
  });
  settlements.forEach((s) => {
    const from = s.from?._id || s.from?.id || s.from;
    const to = s.to?._id || s.to?.id || s.to;
    if (from && settlementByUser[from] !== undefined)
      settlementByUser[from] -= Number(s.amount);
    if (to && settlementByUser[to] !== undefined)
      settlementByUser[to] += Number(s.amount);
  });

  // Build balance object
  const balances = {};
  memberIds.forEach((id) => {
    const paid = +(paidByUser[id] ?? 0).toFixed(2);
    const share = +(shareByUser[id] ?? originalShare).toFixed(2);
    const originalNet = +(paid - share).toFixed(2);
    // Advance share: totalAdvance / numMembers
    // Final net: paid - finalShare
    const finalNet = +(paid - share + advanceShare).toFixed(2);
    const settlement = +(settlementByUser[id] ?? 0).toFixed(2);
    let advanceReceived = +(advancesByUser[id] ?? 0).toFixed(2);
    // For single-member group, show totalAdvance as received
    if (numMembers === 1) {
      advanceReceived = +totalAdvance.toFixed(2);
    }
    balances[id] = {
      paid,
      share,
      originalNet,
      advanceShare,
      advanceReceived,
      finalNet,
      settlement,
    };
  });

  return {
    totalExpense: +totalExpense.toFixed(2),
    totalAdvance: +totalAdvance.toFixed(2),
    originalShare,
    advanceShare,
    effectiveExpense,
    finalShare,
    surplusCredit,
    paidByUser,
    advancesByUser,
    settlementByUser,
    balances,
  };
}
