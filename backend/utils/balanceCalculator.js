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

export function computeMonthlyBalances(expenses, memberIds, advances = []) {
  console.log("DEBUG: memberIds", memberIds);
  console.log(
    "DEBUG: expenses",
    expenses.map((e) => ({ payer: e.payer, amount: e.amount })),
  );
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
  const originalShare = numMembers > 0 ? totalExpense / numMembers : 0;
  const advanceShare = numMembers > 0 ? totalAdvance / numMembers : 0;

  const effectiveExpense = totalExpense - totalAdvance;
  let finalShare = 0;
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
  memberIds.forEach((id) => {
    paidByUser[id.toString()] = 0;
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
    } else {
      console.log("DEBUG: payer not matched", key, paidByUser);
    }
  });
  const balances = {};
  let netSum = 0;
  // Calculate advances received by each member
  const advancesByUser = {};
  memberIds.forEach((id) => {
    advancesByUser[id.toString()] = 0;
  });
  advances.forEach((a) => {
    const key = a.user?._id?.toString() || a.user?.toString() || a.user;
    if (key && advancesByUser[key] !== undefined) {
      advancesByUser[key] += a.amount;
    }
  });

  memberIds.forEach((id) => {
    const idStr = id.toString();
    const paid = paidByUser[idStr] ?? 0;
    const originalNet = paid - originalShare;
    const finalNet = paid - finalShare;
    const advanceReceived = advancesByUser[idStr] ?? 0;
    let status = "-";
    if (finalNet < 0) status = `Pays ₹${Math.abs(finalNet).toFixed(2)}`;
    else if (finalNet > 0) status = `Gets ₹${finalNet.toFixed(2)}`;
    balances[idStr] = {
      paid,
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
