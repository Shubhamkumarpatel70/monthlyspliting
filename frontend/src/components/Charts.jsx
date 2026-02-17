import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const CHART_COLORS = ['#22D3EE', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

function formatMonthLabel(yyyyMm) {
  if (!yyyyMm) return '';
  const [y, m] = yyyyMm.split('-').map(Number);
  return format(new Date(y, m - 1, 1), 'MMM yyyy');
}

function getPreviousMonth(yyyyMm) {
  if (!yyyyMm) return null;
  const [yr, mo] = yyyyMm.split('-').map(Number);
  if (mo === 1) return `${yr - 1}-12`;
  return `${yr}-${String(mo - 1).padStart(2, '0')}`;
}

export default function Charts({ expenses, group, balances, selectedMonth, previousMonthBalances }) {
  const categoryData = useMemo(() => {
    const byCat = {};
    expenses.forEach((e) => {
      const label = e.category === 'Custom' && e.customCategory ? e.customCategory : e.category;
      byCat[label] = (byCat[label] || 0) + e.amount;
    });
    return Object.entries(byCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [expenses]);

  const memberData = useMemo(() => {
    if (!balances?.paidByUser || !group?.members) return [];
    return group.members.map((m) => {
      const u = m.user;
      const id = (u?._id || u)?.toString();
      const paid = balances.paidByUser[id] ?? 0;
      return { name: u?.name ?? 'Unknown', paid: Math.round(paid * 100) / 100 };
    }).filter((d) => d.paid > 0 || categoryData.length === 0);
  }, [balances, group, categoryData.length]);

  const monthCompareData = useMemo(() => {
    if (!selectedMonth) return [];
    const currentTotal = balances?.totalExpense ?? 0;
    const prevMonth = getPreviousMonth(selectedMonth);
    const prevTotal = previousMonthBalances?.totalExpense ?? 0;
    const prevLabel = prevMonth ? formatMonthLabel(prevMonth) : 'Previous month';
    const currLabel = formatMonthLabel(selectedMonth);
    return [
      { month: prevLabel, total: Number(prevTotal), fill: '#64748B' },
      { month: currLabel, total: Number(currentTotal), fill: '#22D3EE' },
    ];
  }, [selectedMonth, balances?.totalExpense, previousMonthBalances?.totalExpense]);

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {categoryData.length > 0 && (
        <div className="bg-surface rounded-2xl border border-white/5 p-5">
          <h3 className="text-textPrimary font-semibold mb-4">By category</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name} ₹${value.toFixed(0)}`}
                >
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`₹${Number(v).toFixed(2)}`, 'Amount']} contentStyle={{ backgroundColor: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {memberData.length > 0 && (
        <div className="bg-surface rounded-2xl border border-white/5 p-5">
          <h3 className="text-textPrimary font-semibold mb-4">Contribution by member</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={memberData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 12 }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip formatter={(v) => [`₹${Number(v).toFixed(2)}`, 'Paid']} contentStyle={{ backgroundColor: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                <Bar dataKey="paid" fill="#22D3EE" radius={[4, 4, 0, 0]} name="Paid" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {monthCompareData.length > 0 && (
        <div className="bg-surface rounded-2xl border border-white/5 p-5 sm:col-span-2">
          <h3 className="text-textPrimary font-semibold mb-4">Month comparison</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthCompareData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 12 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 12 }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip formatter={(v) => [`₹${Number(v).toFixed(2)}`, 'Total expense']} contentStyle={{ backgroundColor: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                <Bar dataKey="total" radius={[4, 4, 0, 0]} name="Total expense">
                  {monthCompareData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
