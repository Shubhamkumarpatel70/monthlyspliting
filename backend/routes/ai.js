import express from "express";
import * as aiController from "../controllers/aiController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.post("/parse-expense", protect, aiController.parseExpense);
router.post("/suggest-category", protect, aiController.suggestCategory);
router.post("/month-summary", protect, aiController.monthSummary);
router.post("/forecast-next-month", protect, aiController.forecastNextMonth);

export default router;
