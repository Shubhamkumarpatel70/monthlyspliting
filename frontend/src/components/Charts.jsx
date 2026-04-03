import React, { useMemo } from "react";
import { format } from "date-fns";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

const CHART_COLORS = [
  "#22D3EE",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
];
const MEMBER_COLORS = [
  "#22D3EE",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
];

function formatMonthLabel(yyyyMm) {
  if (!yyyyMm) return "";
  const [y, m] = yyyyMm.split("-").map(Number);
  return format(new Date(y, m - 1, 1), "MMM yyyy");
}

function getPreviousMonth(yyyyMm) {
  if (!yyyyMm) return null;
  const [yr, mo] = yyyyMm.split("-").map(Number);
  if (mo === 1) return `${yr - 1}-12`;
  return `${yr}-${String(mo - 1).padStart(2, "0")}`;
}

export default function Charts({
  expenses,
  group,
  balances,
  selectedMonth,
  previousMonthBalances,
  yearTotalsByMonth,
}) {
  const expenseList = Array.isArray(expenses) ? expenses : [];

  const categoryData = useMemo(() => {
    const byCat = {};
    expenseList.forEach((e) => {
      const label =
        e.category === "Custom" && e.customCategory
          ? e.customCategory
          : e.category;
      byCat[label] = (byCat[label] || 0) + e.amount;
    });
    return Object.entries(byCat)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [expenseList]);

  const memberData = useMemo(() => {
    if (!balances?.paidByUser || !Array.isArray(group?.members)) return [];
    const totalExpense = balances?.totalExpense || 0;
    return group.members
      .map((m, index) => {
        const u = m.user;
        const id = (u?._id || u)?.toString();
        const paid = balances.paidByUser[id] ?? 0;
        const percentage =
          totalExpense > 0 ? ((paid / totalExpense) * 100).toFixed(1) : 0;
        return {
          name: u?.name ?? "Unknown",
          paid: Math.round(paid * 100) / 100,
          percentage: Number(percentage),
          fill: MEMBER_COLORS[index % MEMBER_COLORS.length],
        };
      })
      .sort((a, b) => b.paid - a.paid);
  }, [balances, group]);

  const monthCompareData = useMemo(() => {
    if (!selectedMonth || yearTotalsByMonth == null) return null;
    const m = /^(\d{4})-(\d{2})$/.exec(selectedMonth);
    if (!m) return null;
    const year = parseInt(m[1], 10);
    const monthNum = parseInt(m[2], 10);
    if (monthNum < 1 || monthNum > 12) return null;

    const prevMonthKey = getPreviousMonth(selectedMonth);
    const prevTotal =
      prevMonthKey && prevMonthKey.startsWith(`${year}-`)
        ? yearTotalsByMonth[prevMonthKey] ?? 0
        : previousMonthBalances?.totalExpense ?? 0;

    const currentTotal =
      yearTotalsByMonth[selectedMonth] ?? balances?.totalExpense ?? 0;

    const difference = currentTotal - prevTotal;
    const percentChange =
      prevTotal > 0
        ? Number(((difference / prevTotal) * 100).toFixed(1))
        : 0;

    const data = [];
    for (let im = 1; im <= monthNum; im++) {
      const monthKey = `${year}-${String(im).padStart(2, "0")}`;
      const total = yearTotalsByMonth[monthKey] ?? 0;
      const label = format(new Date(year, im - 1, 1), "MMM");
      const prevKey =
        im > 1 ? `${year}-${String(im - 1).padStart(2, "0")}` : null;
      const prevT = prevKey != null ? yearTotalsByMonth[prevKey] ?? 0 : null;
      let pctVsPrev = null;
      if (im > 1 && prevT != null && prevT > 0) {
        pctVsPrev = Number((((total - prevT) / prevT) * 100).toFixed(1));
      }
      data.push({
        month: label,
        monthKey,
        total: Number(total),
        role: monthKey === selectedMonth ? "current" : "year",
        isSelectedMonth: monthKey === selectedMonth,
        isFirstInSeries: im === 1,
        pctVsPrev,
      });
    }

    return {
      data,
      difference,
      percentChange: Number(percentChange),
      prevTotal,
      currentTotal,
      prevLabel: prevMonthKey ? formatMonthLabel(prevMonthKey) : "Previous month",
      currLabel: formatMonthLabel(selectedMonth),
      year,
    };
  }, [
    selectedMonth,
    yearTotalsByMonth,
    balances?.totalExpense,
    previousMonthBalances?.totalExpense,
  ]);

  const totalContribution = memberData.reduce((sum, m) => sum + m.paid, 0);

  return (
    <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2">
      {categoryData.length > 0 && (
        <div className="bg-surface rounded-2xl border border-white/5 p-4 sm:p-5">
          <h3 className="text-textPrimary font-semibold mb-3 sm:mb-4">
            By category
          </h3>

          {/* Category list for mobile */}
          <div className="space-y-2 mb-4 sm:hidden">
            {categoryData.map((cat, i) => (
              <div
                key={cat.name}
                className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                    }}
                  />
                  <span className="text-textPrimary text-sm">{cat.name}</span>
                </div>
                <span className="text-primary font-medium text-sm">
                  ₹{cat.value.toFixed(0)}
                </span>
              </div>
            ))}
          </div>

          {/* Pie chart for larger screens */}
          <div className="h-48 sm:h-64 hidden sm:block">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={70}
                  label={({ name, value }) => `${name}: ₹${value.toFixed(0)}`}
                  labelLine={{ stroke: "#64748B", strokeWidth: 1 }}
                >
                  {categoryData.map((_, i) => (
                    <Cell
                      key={i}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v) => [`₹${Number(v).toFixed(2)}`, "Amount"]}
                  contentStyle={{
                    backgroundColor: "#1E293B",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {memberData.length > 0 && (
        <div className="bg-surface rounded-2xl border border-white/5 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3 sm:mb-4">
            <h3 className="text-textPrimary font-semibold text-sm sm:text-base">
              Contribution by member
            </h3>
            <span className="text-textSecondary text-xs sm:text-sm">
              Total: ₹{totalContribution.toFixed(2)}
            </span>
          </div>

          {/* Progress bars for each member */}
          <div className="space-y-3 sm:space-y-4 mb-3 sm:mb-4">
            {memberData.map((member, i) => (
              <div key={member.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-textPrimary text-xs sm:text-sm font-medium truncate max-w-[120px] sm:max-w-none">
                    {member.name}
                  </span>
                  <span className="text-textSecondary text-xs sm:text-sm">
                    ₹{member.paid.toFixed(2)}
                    <span className="text-xs ml-1">({member.percentage}%)</span>
                  </span>
                </div>
                <div className="h-2.5 sm:h-3 bg-darkBg rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${member.percentage}%`,
                      backgroundColor: member.fill,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Small bar chart - hidden on mobile */}
          <div className="h-28 sm:h-32 mt-3 sm:mt-4 hidden sm:block">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={memberData}
                margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fill: "#94A3B8", fontSize: 11 }}
                  interval={0}
                />
                <YAxis
                  tick={{ fill: "#94A3B8", fontSize: 10 }}
                  tickFormatter={(v) => `₹${v}`}
                  width={45}
                />
                <Tooltip
                  formatter={(v) => [`₹${Number(v).toFixed(2)}`, "Paid"]}
                  contentStyle={{
                    backgroundColor: "#1E293B",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="paid" radius={[4, 4, 0, 0]} name="Paid">
                  {memberData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {monthCompareData &&
        monthCompareData.data?.length > 0 && (
        <div className="bg-surface rounded-2xl border border-white/5 p-4 sm:p-5 col-span-1 sm:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-textPrimary font-semibold">
                Month comparison — {monthCompareData.year}
              </h3>
              <p className="text-textSecondary text-xs mt-1">
                January through {monthCompareData.currLabel} only; later months
                in {monthCompareData.year} are hidden until you select them.
              </p>
            </div>
            {monthCompareData.prevTotal > 0 && (
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${monthCompareData.difference > 0 ? "bg-danger/10 text-danger" : monthCompareData.difference < 0 ? "bg-success/10 text-success" : "bg-white/5 text-textSecondary"}`}
              >
                {monthCompareData.difference > 0 ? (
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
                      d="M5 10l7-7m0 0l7 7m-7-7v18"
                    />
                  </svg>
                ) : monthCompareData.difference < 0 ? (
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
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                ) : null}
                <span className="text-sm font-medium">
                  {monthCompareData.difference > 0 ? "+" : ""}₹
                  {Math.abs(monthCompareData.difference).toFixed(2)}
                  <span className="text-xs ml-1">
                    ({monthCompareData.difference > 0 ? "+" : ""}
                    {monthCompareData.percentChange}%)
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* Comparison cards */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div className="bg-darkBg/50 rounded-xl p-3 sm:p-4 border border-white/5">
              <p className="text-textSecondary text-xs mb-1">
                {monthCompareData.prevLabel}
              </p>
              <p className="text-base sm:text-xl font-bold text-textSecondary">
                ₹{monthCompareData.prevTotal.toFixed(0)}
              </p>
            </div>
            <div className="bg-primary/10 rounded-xl p-3 sm:p-4 border border-primary/30">
              <p className="text-primary text-xs mb-1">
                {monthCompareData.currLabel}
              </p>
              <p className="text-base sm:text-xl font-bold text-primary">
                ₹{monthCompareData.currentTotal.toFixed(0)}
              </p>
            </div>
          </div>

          <div className="h-52 sm:h-64 hidden sm:block">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={monthCompareData.data}
                margin={{ top: 44, right: 12, left: 8, bottom: 12 }}
              >
                <CartesianGrid
                  stroke="rgba(148, 163, 184, 0.15)"
                  strokeDasharray="4 4"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#94A3B8", fontSize: 11 }}
                  tickLine={{ stroke: "#475569" }}
                  axisLine={{ stroke: "#475569" }}
                  angle={-25}
                  textAnchor="end"
                  height={52}
                  interval={0}
                />
                <YAxis
                  tick={{ fill: "#94A3B8", fontSize: 11 }}
                  tickFormatter={(v) => `₹${v}`}
                  width={52}
                  tickLine={{ stroke: "#475569" }}
                  axisLine={{ stroke: "#475569" }}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload;
                    return (
                      <div
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs shadow-lg"
                        style={{
                          backgroundColor: "#1E293B",
                        }}
                      >
                        <p className="font-medium text-textPrimary mb-1">
                          {formatMonthLabel(p.monthKey)}
                        </p>
                        {p.isSelectedMonth && (
                          <p className="text-primary/90 text-[10px] uppercase tracking-wide mb-1">
                            Selected month
                          </p>
                        )}
                        <p className="text-primary font-semibold">
                          ₹{Number(p.total).toFixed(2)}
                        </p>
                        {p.pctVsPrev != null && (
                          <p className="text-textSecondary mt-1">
                            vs previous month:{" "}
                            <span
                              className={
                                p.pctVsPrev > 0
                                  ? "text-danger"
                                  : p.pctVsPrev < 0
                                    ? "text-success"
                                    : "text-textSecondary"
                              }
                            >
                              {p.pctVsPrev > 0 ? "+" : ""}
                              {p.pctVsPrev}%
                            </span>
                          </p>
                        )}
                        {!p.isFirstInSeries &&
                          p.isSelectedMonth &&
                          p.pctVsPrev == null &&
                          p.total > 0 && (
                            <p className="text-textSecondary mt-1">
                              No spend in the prior month — % vs prior not
                              shown.
                            </p>
                          )}
                      </div>
                    );
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Total expense"
                  stroke="#22D3EE"
                  strokeWidth={2.5}
                  dot={(dotProps) => {
                    const { cx, cy, payload } = dotProps;
                    if (cx == null || cy == null || !payload) return null;
                    const active = payload.isSelectedMonth;
                    const r = active ? 6 : 4;
                    const stroke = active ? "#38bdf8" : "#22D3EE";
                    const strokeW = active ? 2.5 : 2;
                    const labelSize = monthCompareData.data.length > 6 ? 9 : 11;
                    const pctSize = monthCompareData.data.length > 6 ? 8 : 10;
                    return (
                      <g>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={r}
                          fill="#0f172a"
                          stroke={stroke}
                          strokeWidth={strokeW}
                        />
                        <text
                          x={cx}
                          y={cy - 12}
                          textAnchor="middle"
                          fill="#e2e8f0"
                          fontSize={labelSize}
                          fontWeight={600}
                        >
                          ₹{Number(payload.total).toLocaleString("en-IN", {
                            maximumFractionDigits: 0,
                          })}
                        </text>
                        {payload.pctVsPrev != null && (
                          <text
                            x={cx}
                            y={cy - 26}
                            textAnchor="middle"
                            fill={
                              payload.pctVsPrev > 0
                                ? "#f87171"
                                : payload.pctVsPrev < 0
                                  ? "#4ade80"
                                  : "#94a3b8"
                            }
                            fontSize={pctSize}
                            fontWeight={500}
                          >
                            {payload.pctVsPrev > 0 ? "+" : ""}
                            {payload.pctVsPrev}% vs prev
                          </text>
                        )}
                      </g>
                    );
                  }}
                  activeDot={{ r: 8, stroke: "#38bdf8", fill: "#0f172a" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
