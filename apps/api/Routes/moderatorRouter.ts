import { Router } from "express";
import moderatorController from "../Controllers/moderatorController";
import authMiddleware from "../middleware/authMiddleware";
import roleMiddleware from "../middleware/roleMiddleware";

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware(["ADMIN", "MODERATOR"]));

router.post("/warn", moderatorController.warnUser);
router.post("/ban", moderatorController.banUser);
router.post("/unban", moderatorController.unbanUser);
router.get("/reports", authMiddleware, roleMiddleware(["MODERATOR", "ADMIN"]), moderatorController.getReports);
router.post("/reports/dismiss", authMiddleware, roleMiddleware(["MODERATOR", "ADMIN"]), moderatorController.dismissReport);
router.post("/delete-message", authMiddleware, roleMiddleware(["MODERATOR", "ADMIN"]), moderatorController.deleteMessage);
export default router;