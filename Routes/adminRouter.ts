import { Router } from "express";
import adminController from "../Controllers/adminController";
import roleMiddleware from "../middleware/roleMiddleware";
import authMiddleware from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);

router.get("/users", roleMiddleware(["ADMIN", "MODERATOR"]), adminController.getAllUsers);
router.get("/users/search", roleMiddleware(["ADMIN", "MODERATOR"]), adminController.searchUsers); 
router.put("/users/:id", roleMiddleware(["ADMIN"]), adminController.updateUser);
router.delete("/users/:id", roleMiddleware(["ADMIN"]), adminController.deleteUser);

router.get("/chats", roleMiddleware(["ADMIN"]), adminController.getAllChats);
router.delete("/chats/:id", roleMiddleware(["ADMIN"]), adminController.deleteChat);

router.get("/stats", roleMiddleware(["ADMIN"]), adminController.getStats);
router.get("/logs", roleMiddleware(["ADMIN"]), adminController.getLogs);

router.post("/broadcast", roleMiddleware(["ADMIN"]), adminController.broadcastMessage);

export default router;