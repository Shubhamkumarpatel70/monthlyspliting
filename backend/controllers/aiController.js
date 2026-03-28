import Expense, { EXPENSE_CATEGORIES } from "../models/Expense.js";
import Group from "../models/Group.js";
import Advance from "../models/Advance.js";
import { computeMonthlyBalances } from "../utils/balanceCalculator.js";
import { geminiChatJson } from "../utils/geminiClient.js";

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

/** Return safe API error text so production (e.g. Render) shows real Gemini hints, not a blind 503. */
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
    const parsed = await geminiChatJson({
      system,
      user: input.trim(),
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
    const out = await geminiChatJson({
      system,
      user: text,
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
      whoOwesMost: owesMost
        ? { name: owesMost.name, amountOwed: Math.abs(owesMost.finalNet) }
        : null,
      whoIsOwedMost: owedMost
        ? { name: owedMost.name, amountOwed: owedMost.finalNet }
        : null,
      memberBalances: balanceRows,
    };

    const system = `You write concise personal finance summaries for a shared expense group in India (amounts in ₹).
You will receive JSON with computed totals and balances. Write ONE short paragraph (3-5 sentences max) that is specific to this data — name categories, people, and numbers when relevant.
Cover: where most money went (category), who owes the most net (if any), whether spending vs last month went up or down, and one practical suggestion.
Avoid generic filler. Respond with JSON only: {"summary":"<your paragraph>"}`;

    const out = await geminiChatJson({
      system,
      user: JSON.stringify(payload),
    });
    const summary =
      typeof out.summary === "string" && out.summary.trim()
        ? out.summary.trim()
        : "Summary unavailable.";
    return res.json({ summary, meta: { month, groupName: group.name } });
  } catch (err) {
    console.error("monthSummary:", err);
    return jsonError(
      res,
      503,
      aiFailureMessage(err, "Could not generate monthly summary."),
    );
  }
}
