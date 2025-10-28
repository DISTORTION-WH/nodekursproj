const Router = require("express");
const router = new Router();
const adminController = require("../Controllers/adminController");
const roleMiddleware = require("../middleware/roleMiddleware");

// Все маршруты доступны только ADMIN
router.use(roleMiddleware("ADMIN"));

// Пользователи
router.get("/users", adminController.getAllUsers);
router.put("/users/:id", adminController.updateUser);
router.delete("/users/:id", adminController.deleteUser);
router.get("/users/search", adminController.searchUsers);
router.delete("/chats/:id", adminController.deleteChat);

// Чаты
router.get("/chats", adminController.getAllChats);

module.exports = router;
