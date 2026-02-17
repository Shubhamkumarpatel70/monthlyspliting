/**
 * Identify creditors/debtors and generate minimal transactions (who pays whom).
 */

export function generateMinimalTransactions(balances, userMap) {
  const entries = Object.entries(balances)
    .map(([id, balance]) => ({ id, balance: Math.round(balance * 100) / 100 }))
    .filter(e => e.balance !== 0);
  const creditors = entries.filter(e => e.balance > 0).sort((a, b) => b.balance - a.balance);
  const debtors = entries.filter(e => e.balance < 0).sort((a, b) => a.balance - b.balance);
  const transactions = [];
  let c = 0,
    d = 0;
  while (c < creditors.length && d < debtors.length) {
    const cred = creditors[c];
    const deb = debtors[d];
    const amount = Math.min(cred.balance, -deb.balance);
    if (amount <= 0) break;
    transactions.push({
      from: deb.id,
      to: cred.id,
      amount: Math.round(amount * 100) / 100,
      fromName: userMap.get(deb.id)?.name ?? deb.id,
      toName: userMap.get(cred.id)?.name ?? cred.id,
    });
    cred.balance -= amount;
    deb.balance += amount;
    if (cred.balance < 0.01) c++;
    if (deb.balance > -0.01) d++;
  }
  return transactions;
}
