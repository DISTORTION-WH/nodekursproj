import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import roleMiddleware from "../middleware/roleMiddleware";
import callAnalyticsController from "../Controllers/callAnalyticsController";

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// POST /api/call-analytics — save call analytics (any authenticated user)
router.post("/", callAnalyticsController.saveAnalytics);

// GET /api/call-analytics/history — current user's call history
router.get("/history", callAnalyticsController.getHistory);

// GET /api/call-analytics/team — aggregated team stats (admins + moderators)
router.get(
  "/team",
  roleMiddleware(["ADMIN", "MODERATOR"]),
  callAnalyticsController.getTeamStats
);

// GET /api/call-analytics/:callId — single session detail
// (must be after /history and /team routes to avoid param clash)
router.get("/:callId", callAnalyticsController.getCallDetail);

export default router;
