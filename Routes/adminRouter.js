const Router = require("express");
const router = new Router();
const adminController = require("../Controllers/adminController");
const roleMiddleware = require("../middleware/roleMiddleware");

router.use(roleMiddleware("ADMIN"));

router.get("/users", adminController.getAllUsers);
router.put("/users/:id", adminController.updateUser);
router.delete("/users/:id", adminController.deleteUser);
router.get("/users/search", adminController.searchUsers);

router.get("/chats", adminController.getAllChats);
router.delete("/chats/:id", adminController.deleteChat);

router.get("/stats", adminController.getStats);
router.get("/logs", adminController.getLogs);

module.exports = router;