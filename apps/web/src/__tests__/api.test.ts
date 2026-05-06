/**
 * Unit tests for the api.tsx service layer.
 * Mocks axios so no real HTTP requests are made.
 */

jest.mock('axios', () => {
  const mockAxios: any = {
    create: jest.fn(() => mockAxios),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    defaults: { headers: { common: {} } },
  };
  return { default: mockAxios, ...mockAxios };
});

import * as apiModule from '../services/api';

const mockStorage: Record<string, string> = {};
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (k: string) => mockStorage[k] ?? null,
    setItem: (k: string, v: string) => { mockStorage[k] = v; },
    removeItem: (k: string) => { delete mockStorage[k]; },
  },
  writable: true,
});

// ─── API function signature tests ─────────────────────────────────────────────

describe('api service exports', () => {
  it('exports login function', () => expect(typeof apiModule.login).toBe('function'));
  it('exports register function', () => expect(typeof apiModule.register).toBe('function'));
  it('exports getProfile function', () => expect(typeof apiModule.getProfile).toBe('function'));
  it('exports getUserChats function', () => expect(typeof apiModule.getUserChats).toBe('function'));
  it('exports getChatMessages function', () => expect(typeof apiModule.getChatMessages).toBe('function'));
  it('exports postMessage function', () => expect(typeof apiModule.postMessage).toBe('function'));
  it('exports createGroupChat function', () => expect(typeof apiModule.createGroupChat).toBe('function'));
  it('exports getChatUsers function', () => expect(typeof apiModule.getChatUsers).toBe('function'));
  it('exports createInviteCode function', () => expect(typeof apiModule.createInviteCode).toBe('function'));
  it('exports joinWithInviteCode function', () => expect(typeof apiModule.joinWithInviteCode).toBe('function'));
  it('exports inviteToGroup function', () => expect(typeof apiModule.inviteToGroup).toBe('function'));
  it('exports findOrCreatePrivateChat function', () => expect(typeof apiModule.findOrCreatePrivateChat).toBe('function'));
  it('exports getFriends function', () => expect(typeof apiModule.getFriends).toBe('function'));
  it('exports getIncomingRequests function', () => expect(typeof apiModule.getIncomingRequests).toBe('function'));
  it('exports sendFriendRequest function', () => expect(typeof apiModule.sendFriendRequest).toBe('function'));
  it('exports acceptFriendRequest function', () => expect(typeof apiModule.acceptFriendRequest).toBe('function'));
  it('exports removeFriend function', () => expect(typeof apiModule.removeFriend).toBe('function'));
  it('exports deleteMessage function', () => expect(typeof apiModule.deleteMessage).toBe('function'));
  it('exports addReaction function', () => expect(typeof apiModule.addReaction).toBe('function'));
  it('exports removeReaction function', () => expect(typeof apiModule.removeReaction).toBe('function'));
  it('exports kickUserFromGroup function', () => expect(typeof apiModule.kickUserFromGroup).toBe('function'));
  it('exports setChatMemberRole function', () => expect(typeof apiModule.setChatMemberRole).toBe('function'));
  it('exports warnUser function', () => expect(typeof apiModule.warnUser).toBe('function'));
  it('exports banUser function', () => expect(typeof apiModule.banUser).toBe('function'));
  it('exports unbanUser function', () => expect(typeof apiModule.unbanUser).toBe('function'));
  it('exports reportMessage function', () => expect(typeof apiModule.reportMessage).toBe('function'));
  it('exports getReports function', () => expect(typeof apiModule.getReports).toBe('function'));
  it('exports dismissReport function', () => expect(typeof apiModule.dismissReport).toBe('function'));
  it('exports deleteMessageByMod function', () => expect(typeof apiModule.deleteMessageByMod).toBe('function'));
  it('exports searchUsers function', () => expect(typeof apiModule.searchUsers).toBe('function'));
  it('exports getAllUsers function', () => expect(typeof apiModule.getAllUsers).toBe('function'));
  it('exports updateUser function', () => expect(typeof apiModule.updateUser).toBe('function'));
  it('exports deleteUser function', () => expect(typeof apiModule.deleteUser).toBe('function'));
  it('exports getAllChats function', () => expect(typeof apiModule.getAllChats).toBe('function'));
  it('exports deleteChat function', () => expect(typeof apiModule.deleteChat).toBe('function'));
  it('exports getStats function', () => expect(typeof apiModule.getStats).toBe('function'));
  it('exports getLogs function', () => expect(typeof apiModule.getLogs).toBe('function'));
  it('exports broadcastMessage function', () => expect(typeof apiModule.broadcastMessage).toBe('function'));
  it('exports editMessage function', () => expect(typeof apiModule.editMessage).toBe('function'));
  it('exports getUnreadCounts function', () => expect(typeof apiModule.getUnreadCounts).toBe('function'));
  it('exports markChatAsRead function', () => expect(typeof apiModule.markChatAsRead).toBe('function'));
  it('exports getPinnedMessages function', () => expect(typeof apiModule.getPinnedMessages).toBe('function'));
  it('exports pinMessage function', () => expect(typeof apiModule.pinMessage).toBe('function'));
  it('exports unpinMessage function', () => expect(typeof apiModule.unpinMessage).toBe('function'));
  it('exports searchMessagesInChat function', () => expect(typeof apiModule.searchMessagesInChat).toBe('function'));
  it('exports forwardMessage function', () => expect(typeof apiModule.forwardMessage).toBe('function'));
  it('exports uploadFile function', () => expect(typeof apiModule.uploadFile).toBe('function'));
  it('exports getLinkPreview function', () => expect(typeof apiModule.getLinkPreview).toBe('function'));
  it('exports updateUserStatus function', () => expect(typeof apiModule.updateUserStatus).toBe('function'));
  it('exports updateUserTheme function', () => expect(typeof apiModule.updateUserTheme).toBe('function'));
  it('exports updateUserAvatarFrame function', () => expect(typeof apiModule.updateUserAvatarFrame).toBe('function'));
  it('exports updateUserBio function', () => expect(typeof apiModule.updateUserBio).toBe('function'));
  it('exports updateUserCountry function', () => expect(typeof apiModule.updateUserCountry).toBe('function'));
  it('exports updateUserUsername function', () => expect(typeof apiModule.updateUserUsername).toBe('function'));
  it('exports updateProfileBg function', () => expect(typeof apiModule.updateProfileBg).toBe('function'));
  it('exports updateUsernameStyle function', () => expect(typeof apiModule.updateUsernameStyle).toBe('function'));
  it('exports updateProfileExtras function', () => expect(typeof apiModule.updateProfileExtras).toBe('function'));
  it('exports resetProfile function', () => expect(typeof apiModule.resetProfile).toBe('function'));
  it('exports getChatMessagesBefore function', () => expect(typeof apiModule.getChatMessagesBefore).toBe('function'));
  it('exports getMentions function', () => expect(typeof apiModule.getMentions).toBe('function'));
  it('exports getMediaGallery function', () => expect(typeof apiModule.getMediaGallery).toBe('function'));
  it('exports exportChat function', () => expect(typeof apiModule.exportChat).toBe('function'));
  it('exports createPoll function', () => expect(typeof apiModule.createPoll).toBe('function'));
  it('exports createScheduledMessage function', () => expect(typeof apiModule.createScheduledMessage).toBe('function'));
  it('exports getScheduledMessages function', () => expect(typeof apiModule.getScheduledMessages).toBe('function'));
  it('exports deleteScheduledMessage function', () => expect(typeof apiModule.deleteScheduledMessage).toBe('function'));
});
