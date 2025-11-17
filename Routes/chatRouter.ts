import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware";
import chatController from "../Controllers/chatController";

const router = Router();

// Apply authentication middleware to all routes in this router
router.use(authMiddleware);

// Get all chats for the current user
router.get("/", chatController.getAllUserChats);

// Create a new group chat
router.post("/group", chatController.createGroupChat);

// Find or create a private chat with another user
router.post("/private", chatController.findOrCreatePrivateChat);

// Join a group chat using an invite code
router.post("/join", chatController.joinWithInviteCode);

// Get messages for a specific chat
router.get("/:id/messages", chatController.getChatMessages);

// Post a message to a specific chat
router.post("/:id/messages", chatController.postMessage);

// Delete messages (for self or for everyone)
router.post("/:id/messages/delete", chatController.deleteMessages);

// Get users in a specific chat
router.get("/:id/users", chatController.getChatUsers);

// Generate an invite code for a group chat
router.post("/:id/invite-code", chatController.createInviteCode);

// Invite a friend to a group chat
router.post("/:id/invite", chatController.inviteToGroup);

// Kick a user from a group chat
router.post("/:id/kick", chatController.kickFromGroup);

export default router;
