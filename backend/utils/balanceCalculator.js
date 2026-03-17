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
  const finalShare = originalShare - advanceShare;
  const paidByUser = {};
  memberIds.forEach((id) => {
    paidByUser[id.toString()] = 0;
  });
  expenses.forEach((e) => {
    const key = e.payer?._id?.toString() ?? e.payer?.toString();
    if (key && paidByUser[key] !== undefined) paidByUser[key] += e.amount;
  });
  const balances = {};
  let netSum = 0;
  memberIds.forEach((id) => {
    const idStr = id.toString();
    const paid = paidByUser[idStr] ?? 0;
    const originalNet = paid - originalShare;
    const finalNet = originalNet + advanceShare;
    balances[idStr] = {
      paid,
      originalNet,
      advanceShare,
      finalNet,
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
    paidByUser,
    balances,
  };
}
