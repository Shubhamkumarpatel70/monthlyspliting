import Expense, { EXPENSE_CATEGORIES } from "../models/Expense.js";
import Group from "../models/Group.js";
import Advance from "../models/Advance.js";
import { computeMonthlyBalances } from "../utils/balanceCalculator.js";
import { groqChatJson } from "../utils/groqClient.js";

const AI_SUGGEST_CATEGORIES = [
  "Food",
  "Travel",
  "Rent",
  "Bills",
  "Shopping",
  "Entertainment",
  "Groceries",
  "Health",
  "Others",
];

function jsonError(res, status, message) {
  return res.status(status).json({ message });
}

/** Return safe API error text so production (e.g. Render) shows real Groq hints, not a blind 503. */
function aiFailureMessage(err, fallback) {
  const msg = String(err?.message || "").trim();
  if (!msg) return fallback;
  if (msg.length > 400) return fallback;
  return msg;
}

function normalizeCategory(value) {
  if (!value || typeof value !== "string") return "Others";
  const t = value.trim();
  const match = EXPENSE_CATEGORIES.find(
    (c) => c.toLowerCase() === t.toLowerCase(),
  );
  if (match) return match;
  const fromAi = AI_SUGGEST_CATEGORIES.find(
    (c) => c.toLowerCase() === t.toLowerCase(),
  );
  return fromAi || "Others";
}

function normalizeSplitType(value) {
  const allowed = ["equal", "exact", "percentage", "shares", "unknown"];
  if (!value || typeof value !== "string") return "equal";
  const v = value.toLowerCase().trim();
  return allowed.includes(v) ? v : "equal";
}

async function ensureGroupMember(req, groupId) {
  if (!groupId) return { ok: false, status: 400, message: "groupId is required." };
  const group = await Group.findById(groupId).populate("members.user", "name");
  if (!group) return { ok: false, status: 404, message: "Group not found." };
  const uid = req.user._id.toString();
  const isMember = group.members.some(
    (m) => (m.user?._id || m.user)?.toString() === uid,
  );
  if (!isMember) {
    return { ok: false, status: 403, message: "Not a member of this group." };
  }
  return { ok: true, group };
}

export async function parseExpense(req, res) {
  const { input, groupId } = req.body;
  if (!input || typeof input !== "string" || !input.trim()) {
    return jsonError(res, 400, "Natural language input is required.");
  }

  let memberHint = "";
  if (groupId) {
    const g = await ensureGroupMember(req, groupId);
    if (!g.ok) return jsonError(res, g.status, g.message);
    const { group } = g;
    const names = group.members
      .map((m) => m.user?.name)
      .filter(Boolean);
    memberHint = `\nKnown group member names (match paidBy and participants to these when possible): ${names.join(", ")}.`;
  }

  const today = new Date().toISOString().slice(0, 10);
  const system = `You extract structured expense data from informal text. Respond with a single JSON object only (no markdown).
Required keys: title (string), amount (number or null), category (one of: ${AI_SUGGEST_CATEGORIES.join(", ")}), paidBy (string name or null), participants (array of name strings, include payer if splitting with others), splitType (one of: equal, exact, percentage, shares, unknown), note (string or null), date (YYYY-MM-DD or null).
Rules: Infer category from context. If amount is missing, use null. If date is missing, use null (client may default to today). paidBy is who paid; if unclear, null.${memberHint}
Example: {"title":"Pizza","amount":1200,"category":"Food","paidBy":"Rahul","participants":["Rahul","Aman"],"splitType":"equal","note":null,"date":"${today}"}`;

  try {
    const parsed = await groqChatJson({
      system,
      user: input.trim(),
      maxOutputTokens: 512,
    });
    const normalized = {
      title: typeof parsed.title === "string" ? parsed.title : String(parsed.title ?? ""),
      amount:
        parsed.amount != null && !Number.isNaN(Number(parsed.amount))
          ? Number(parsed.amount)
          : null,
      category: normalizeCategory(parsed.category),
      paidBy: parsed.paidBy != null ? String(parsed.paidBy) : null,
      participants: Array.isArray(parsed.participants)
        ? parsed.participants.map((p) => String(p))
        : [],
      splitType: normalizeSplitType(parsed.splitType),
      note: parsed.note != null ? String(parsed.note) : null,
      date:
        typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
          ? parsed.date
          : null,
    };
    return res.json({ parsed: normalized });
  } catch (err) {
    console.error("parseExpense:", err);
    return jsonError(
      res,
      503,
      aiFailureMessage(
        err,
        "Could not parse expense. Try again or enter details manually.",
      ),
    );
  }
}

export async function suggestCategory(req, res) {
  const { title, description } = req.body;
  const text = [title, description].filter(Boolean).join(" ").trim();
  if (!text) {
    return jsonError(res, 400, "Title or description is required.");
  }

  const system = `Pick exactly one category from this list: ${AI_SUGGEST_CATEGORIES.join(", ")}.
Respond with JSON only: {"category":"<one of the list>"} based on the expense text.`;

  try {
    const out = await groqChatJson({
      system,
      user: text,
      maxOutputTokens: 256,
    });
    const category = normalizeCategory(out.category);
    return res.json({ category });
  } catch (err) {
    console.error("suggestCategory:", err);
    return jsonError(
      res,
      503,
      aiFailureMessage(err, "Could not suggest a category."),
    );
  }
}

export async function monthSummary(req, res) {
  const { groupId, month: monthParam } = req.body;
  const g = await ensureGroupMember(req, groupId);
  if (!g.ok) return jsonError(res, g.status, g.message);
  const { group } = g;

  const now = new Date();
  const month =
    typeof monthParam === "string" && /^\d{4}-\d{2}$/.test(monthParam)
      ? monthParam
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [y, m] = month.split("-").map(Number);
  const prevDate = new Date(y, m - 2, 1);
  const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

  try {
    const memberIds = group.members.map((mem) => mem.user?._id || mem.user);
    const [expenses, advances, prevExpenses] = await Promise.all([
      Expense.find({ group: groupId, month })
        .populate("payer", "name")
        .lean(),
      Advance.find({ group: groupId, month }).lean(),
      Expense.find({ group: groupId, month: prevMonth }).lean(),
    ]);

    const totalThis = expenses.reduce((s, e) => s + (e.amount || 0), 0);
    const totalPrev = prevExpenses.reduce((s, e) => s + (e.amount || 0), 0);

    if (!expenses.length) {
      return res.json({
        summary:
          "No expenses recorded for this month yet. Add expenses to see an AI summary.",
        meta: { month, groupName: group.name, empty: true },
      });
    }

    const result = computeMonthlyBalances(expenses, memberIds, advances);
    const userMap = new Map();
    group.members.forEach((mem) => {
      const u = mem.user;
      const id = (u?._id || u)?.toString();
      if (id) userMap.set(id, u?.name || id);
    });

    const byCategory = {};
    expenses.forEach((e) => {
      const c =
        e.category === "Custom" && e.customCategory
          ? e.customCategory
          : e.category || "Others";
      byCategory[c] = (byCategory[c] || 0) + e.amount;
    });

    const byCategoryPrev = {};
    prevExpenses.forEach((e) => {
      const c =
        e.category === "Custom" && e.customCategory
          ? e.customCategory
          : e.category || "Others";
      byCategoryPrev[c] = (byCategoryPrev[c] || 0) + e.amount;
    });

    const topCategoriesDetailed = Object.entries(byCategory)
      .map(([name, amount]) => {
        const prevAmt = byCategoryPrev[name] || 0;
        const pct =
          totalThis > 0 ? Math.round((amount / totalThis) * 1000) / 10 : 0;
        let monthOverMonthPct = null;
        if (prevAmt > 0.01) {
          monthOverMonthPct =
            Math.round(((amount - prevAmt) / prevAmt) * 1000) / 10;
        } else if (amount > 0.01) {
          monthOverMonthPct = "new";
        }
        return {
          category: name,
          amountThisMonth: Math.round(amount * 100) / 100,
          percentOfTotal: pct,
          amountLastMonth: Math.round(prevAmt * 100) / 100,
          monthOverMonthPercentChange: monthOverMonthPct,
        };
      })
      .sort((a, b) => b.amountThisMonth - a.amountThisMonth)
      .slice(0, 10);

    const miscPct =
      totalThis > 0
        ? Math.round(((byCategory.Misc || 0) / totalThis) * 1000) / 10
        : 0;

    const balanceRows = Object.entries(result.balances || {}).map(([id, b]) => ({
      name: userMap.get(id) || id,
      finalNet: b.finalNet ?? 0,
    }));
    const owesMost = balanceRows
      .filter((r) => r.finalNet < -0.01)
      .sort((a, b) => a.finalNet - b.finalNet)[0];
    const owedMost = balanceRows
      .filter((r) => r.finalNet > 0.01)
      .sort((a, b) => b.finalNet - a.finalNet)[0];

    const payload = {
      groupName: group.name,
      month,
      totalExpense: result.totalExpense,
      totalAdvance: result.totalAdvance,
      sharePerPerson: result.finalShare,
      spendingVsPreviousMonth: {
        previousMonth: prevMonth,
        previousTotal: totalPrev,
        currentTotal: totalThis,
        percentChange:
          totalPrev > 0
            ? Math.round(((totalThis - totalPrev) / totalPrev) * 1000) / 10
            : null,
      },
      topCategory: Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0],
      categoryTotals: byCategory,
      topCategoriesDetailed,
      miscCategoryPercentOfTotal: miscPct,
      previousMonthCategoryTotals: byCategoryPrev,
      whoOwesMost: owesMost
        ? { name: owesMost.name, amountOwed: Math.abs(owesMost.finalNet) }
        : null,
      whoIsOwedMost: owedMost
        ? { name: owedMost.name, amountOwed: owedMost.finalNet }
        : null,
      memberBalances: balanceRows,
    };

    const system = `You are a concise financial coach for shared household / flat / group expenses in India. Amounts are in ₹.

You receive JSON with: totals, categoryTotals, topCategoriesDetailed (with percentOfTotal, vs last month), member balances, who owes whom.

Respond with JSON ONLY in this exact shape (no markdown):
{
  "summary": "string — 3–5 sentences: group name + month, total spend in ₹, which categories dominated (with ₹), who has the largest net balance to pay or receive (with ₹), and how spending vs the previous month changed.",
  "savingsIdeas": ["string", "string", ...]
}

Rules for savingsIdeas (3–6 short bullets, each one line):
- Every bullet MUST use this group's data (category names, ₹ amounts, or % from topCategoriesDetailed). No vague advice with no numbers.
- If one category (especially Misc, Food, Shopping, Entertainment) is a large % of total, say how to cut it (e.g. split Misc into real labels, meal prep vs delivery, subscription audit).
- If spending rose vs last month, point to categories in topCategoriesDetailed that grew and give one concrete savings step each.
- If miscCategoryPercentOfTotal is high (>25%), urge clearer categories + a monthly cap for "Misc".
- Include at least one idea that is clearly about "where to save" money next month, not only describing past spend.
- Tone: practical, friendly, India-relevant where natural (UPI, local markets, etc.).`;

    const out = await groqChatJson({
      system,
      user: JSON.stringify(payload),
      maxOutputTokens: 2560,
    });
    const summary =
      typeof out.summary === "string" && out.summary.trim()
        ? out.summary.trim()
        : "Summary unavailable.";
    const savingsIdeas = Array.isArray(out.savingsIdeas)
      ? out.savingsIdeas
          .filter((s) => typeof s === "string" && s.trim())
          .map((s) => s.trim())
          .slice(0, 8)
      : [];
    return res.json({
      summary,
      savingsIdeas,
      meta: { month, groupName: group.name },
    });
  } catch (err) {
    console.error("monthSummary:", err);
    return jsonError(
      res,
      503,
      aiFailureMessage(err, "Could not generate monthly summary."),
    );
  }
}

export async function forecastNextMonth(req, res) {
  const { groupId, month: monthHint } = req.body;
  const g = await ensureGroupMember(req, groupId);
  if (!g.ok) return jsonError(res, g.status, g.message);
  const { group } = g;

  const parseMonth = (yyyyMm) => {
    if (typeof yyyyMm !== "string" || !/^\d{4}-\d{2}$/.test(yyyyMm)) return null;
    const [y, m] = yyyyMm.split("-").map(Number);
    return new Date(y, m - 1, 1);
  };
  const monthToStr = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);

  const baseMonthDate = parseMonth(monthHint) || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const baseMonth = monthToStr(baseMonthDate);
  const nextMonth = monthToStr(addMonths(baseMonthDate, 1));

  try {
    // Use months with actual data up to base month (avoids false doubling from a zero month).
    const months = await Expense.distinct("month", { group: groupId });
    const usableMonths = (months || [])
      .filter((m) => /^\d{4}-\d{2}$/.test(m) && m <= baseMonth)
      .sort();

    if (!usableMonths.length) {
      return res.json({
        nextMonth,
        forecast: 0,
        basis: { months: [], totals: [] },
        message: "Not enough past data to forecast next month yet.",
      });
    }

    const m1 = usableMonths[usableMonths.length - 1];
    const m0 = usableMonths[usableMonths.length - 2] || null;

    const [e0, e1] = await Promise.all([
      m0 ? Expense.find({ group: groupId, month: m0 }).lean() : Promise.resolve([]),
      Expense.find({ group: groupId, month: m1 }).lean(),
    ]);

    const total0 = e0.reduce((s, e) => s + (e.amount || 0), 0);
    const total1 = e1.reduce((s, e) => s + (e.amount || 0), 0);

    let forecast = Math.round(total1 * 100) / 100;
    let pct = null;
    if (m0 && total0 > 0) {
      const delta = total1 - total0;
      forecast = Math.max(0, Math.round((total1 + delta) * 100) / 100);
      pct = Math.round(((total1 - total0) / total0) * 1000) / 10;
    }

    return res.json({
      groupName: group.name,
      nextMonth,
      forecast,
      basis: {
        months: m0 ? [m0, m1] : [m1],
        totals: [Math.round(total0 * 100) / 100, Math.round(total1 * 100) / 100],
        percentChange: pct,
        method: m0 ? "simple-trend" : "last-month-carry-forward",
      },
      message:
        `Estimated ${nextMonth} spend based on recent month data up to ${baseMonth}.` +
        (pct != null ? ` Last month changed by ${pct}% vs the month before.` : " Added one month data only, so this is a carry-forward estimate."),
    });
  } catch (err) {
    console.error("forecastNextMonth:", err);
    return jsonError(res, 500, err.message || "Failed to forecast next month.");
  }
}
