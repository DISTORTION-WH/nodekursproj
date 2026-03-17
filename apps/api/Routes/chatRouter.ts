import { Router } from "express";
import multer from "multer";
import authMiddleware from "../middleware/authMiddleware";
import chatController from "../Controllers/chatController";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

router.use(authMiddleware);

router.get("/", chatController.getAllUserChats);

// Routes without :id param MUST come before /:id routes
router.get("/unread", chatController.getUnreadCounts);
router.get("/preview", chatController.getLinkPreview);

router.post("/group", chatController.createGroupChat);

router.post("/private", chatController.findOrCreatePrivateChat);

router.post("/join", chatController.joinWithInviteCode);

router.post("/report", chatController.reportMessage);

router.patch("/messages/:id", chatController.editMessage);
router.delete("/messages/:id", chatController.deleteMessage);
router.post("/messages/:msgId/react", chatController.reactToMessage);
router.delete("/messages/:msgId/react", chatController.unreactToMessage);
router.post("/messages/:msgId/pin", chatController.pinMessage);
router.delete("/messages/:msgId/pin", chatController.unpinMessage);

router.get("/:id/messages", chatController.getChatMessages);
router.post("/:id/messages", chatController.postMessage);
router.post("/:id/messages/delete", chatController.deleteMessages);

router.get("/:id/users", chatController.getChatUsers);

router.post("/:id/invite-code", chatController.createInviteCode);
router.post("/:id/invite", chatController.inviteToGroup);
router.post("/:id/kick", chatController.kickFromGroup);
router.patch("/:id/members/:userId/role", chatController.setChatMemberRole);

router.post("/:id/read", chatController.markAsRead);
router.get("/:id/search", chatController.searchMessages);
router.get("/:id/pinned", chatController.getPinnedMessages);
router.post("/:id/forward", chatController.forwardMessage);
router.post("/:id/upload", upload.single("file"), chatController.uploadFile);

export default router;