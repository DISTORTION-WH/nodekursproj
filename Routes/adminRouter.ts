import { Router } from "express";
import adminController from "../Controllers/adminController";
import roleMiddleware from "../middleware/roleMiddleware";
import authMiddleware from "../middleware/authMiddleware";

const router = Router();

router.use(authMiddleware);
router.use(roleMiddleware(["ADMIN"]));


router.get("/users", adminController.getAllUsers);
router.get("/users/search", adminController.searchUsers); 
router.put("/users/:id", adminController.updateUser);
router.delete("/users/:id", adminController.deleteUser);

router.get("/chats", adminController.getAllChats);
router.delete("/chats/:id", adminController.deleteChat);

router.get("/stats", adminController.getStats);
router.get("/logs", adminController.getLogs);

router.post("/broadcast", adminController.broadcastMessage);

export default router;