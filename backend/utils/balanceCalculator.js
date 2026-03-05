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
  // Net expense = Total expense - Total advance (advances reduce the amount to be split)
  const netExpense = totalExpense - totalAdvance;
  const sharePerPerson = netExpense / memberIds.length;
  const paidByUser = {};
  memberIds.forEach((id) => {
    paidByUser[id.toString()] = 0;
  });
  expenses.forEach((e) => {
    const key = e.payer?._id?.toString() ?? e.payer?.toString();
    if (key && paidByUser[key] !== undefined) paidByUser[key] += e.amount;
  });
  advances.forEach((a) => {
    const key = a.user?._id?.toString() ?? a.user?.toString();
    if (key && paidByUser[key] !== undefined) paidByUser[key] += a.amount;
  });
  const balances = {};
  memberIds.forEach((id) => {
    const idStr = id.toString();
    const paid = paidByUser[idStr] ?? 0;
    balances[idStr] = paid - sharePerPerson; // positive = creditor, negative = debtor
  });
  return {
    totalExpense,
    totalAdvance,
    netExpense,
    sharePerPerson,
    paidByUser,
    balances,
  };
}
