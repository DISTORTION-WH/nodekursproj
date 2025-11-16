const Router = require("express");
const router = new Router();
const authMiddleware = require("../middleware/authMiddleware");
const chatController = require("../Controllers/chatController");

router.use(authMiddleware);

router.get("/", chatController.getAllUserChats);

router.post("/group", chatController.createGroupChat);

router.post("/private", chatController.findOrCreatePrivateChat);

router.post("/join", chatController.joinWithInviteCode);

router.get("/:id/messages", chatController.getChatMessages);

router.post("/:id/messages", chatController.postMessage);

router.post("/:id/messages/delete", chatController.deleteMessages);

router.get("/:id/users", chatController.getChatUsers);

router.post("/:id/invite-code", chatController.createInviteCode);

router.post("/:id/invite", chatController.inviteToGroup);

router.post("/:id/kick", chatController.kickFromGroup);

module.exports = router;
