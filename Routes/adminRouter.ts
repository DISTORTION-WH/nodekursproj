import { Router } from "express";
import adminController from "../Controllers/adminController";
import roleMiddleware from "../middleware/roleMiddleware";

const router = Router();

// Применяем middleware для всех роутов в этом файле
router.use(roleMiddleware("ADMIN"));

router.get("/users", adminController.getAllUsers);
router.put("/users/:id", adminController.updateUser);
router.delete("/users/:id", adminController.deleteUser);
router.get("/users/search", adminController.searchUsers);

router.get("/chats", adminController.getAllChats);
router.delete("/chats/:id", adminController.deleteChat);

router.get("/stats", adminController.getStats);
router.get("/logs", adminController.getLogs);

export default router;
