/**
 * Backend-only balance calculation.
 * Total monthly expense, per-person share, individual paid total, net balance (paid - share).
 */

export function getMonthFromDate(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function computeMonthlyBalances(expenses, memberIds) {
  if (!memberIds?.length) {
    return { totalExpense: 0, sharePerPerson: 0, paidByUser: {}, balances: {} };
  }
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const sharePerPerson = totalExpense / memberIds.length;
  const paidByUser = {};
  memberIds.forEach(id => { paidByUser[id.toString()] = 0; });
  expenses.forEach(e => {
    const key = e.payer?._id?.toString() ?? e.payer?.toString();
    if (key && paidByUser[key] !== undefined) paidByUser[key] += e.amount;
  });
  const balances = {};
  memberIds.forEach(id => {
    const idStr = id.toString();
    const paid = paidByUser[idStr] ?? 0;
    balances[idStr] = paid - sharePerPerson; // positive = creditor, negative = debtor
  });
  return { totalExpense, sharePerPerson, paidByUser, balances };
}
