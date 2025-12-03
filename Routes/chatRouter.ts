import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import chatController from "../Controllers/chatController";

const router = Router();

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

router.delete("/messages/:id", chatController.deleteMessage); 
router.post("/report", authMiddleware, chatController.reportMessage);
export default router;