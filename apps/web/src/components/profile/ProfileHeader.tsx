import { useState } from "react";
import { User } from "../../types";
import { getImageUrl } from "../../utils/imageUrl";
import { AvatarWithFrame } from "./AvatarFrameShop";
import { useI18n } from "../../i18n";
import { updateUserUsername } from "../../services/api";
import { useAuth } from "../../context/AuthContext";

interface ProfileHeaderProps {
  currentUser: User | null;
  handleAvatarChange: (file: File) => Promise<void>;
}

export default function ProfileHeader({ currentUser, handleAvatarChange }: ProfileHeaderProps) {
  const [newAvatar, setNewAvatar] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState("");
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameValue, setUsernameValue] = useState("");
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState("");
  const { t } = useI18n();
  const { setCurrentUser } = useAuth();

  const handleUploadClick = async () => {
    if (!newAvatar) {
      setUploadMessage(t.profile.select_file_first);
      return;
    }
    setUploadMessage("");
    try {
      await handleAvatarChange(newAvatar);
      setUploadMessage(t.profile.avatar_updated);
      setNewAvatar(null);
    } catch (err: any) {
      setUploadMessage(err.response?.data?.message || t.common.error);
    }
  };

  const startEditUsername = () => {
    setUsernameValue(currentUser?.username ?? "");
    setUsernameMessage("");
    setEditingUsername(true);
  };

  const handleUsernameSave = async () => {
    const trimmed = usernameValue.trim();
    if (trimmed.length < 3) {
      setUsernameMessage(t.profile.username_min);
      return;
    }
    setUsernameSaving(true);
    setUsernameMessage("");
    try {
      await updateUserUsername(trimmed);
      if (currentUser) setCurrentUser({ ...currentUser, username: trimmed });
      setUsernameMessage(t.profile.username_saved);
      setEditingUsername(false);
    } catch (err: any) {
      const status = err.response?.status;
      setUsernameMessage(status === 409 ? t.profile.username_taken : (err.response?.data?.message || t.common.error));
    } finally {
      setUsernameSaving(false);
    }
  };

  return (
    <div className="bg-discord-secondary rounded-xl p-4 sm:p-6 flex items-start gap-4 sm:gap-6 flex-wrap overflow-hidden">
      <AvatarWithFrame
        src={getImageUrl(currentUser?.avatar_url)}
        frame={currentUser?.avatar_frame}
        size={128}
      />
      <div className="flex flex-col gap-2 flex-1 min-w-0 overflow-hidden">
        <div className="flex flex-col gap-1 text-sm">
          {/* Username row with edit */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-discord-text-muted shrink-0">{t.profile.name}:</span>
            {editingUsername ? (
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <input
                  value={usernameValue}
                  onChange={(e) => setUsernameValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleUsernameSave(); if (e.key === "Escape") setEditingUsername(false); }}
                  className="bg-discord-input text-discord-text-primary rounded px-2 py-0.5 text-sm outline-none focus:ring-2 focus:ring-discord-accent min-w-0 w-36"
                  autoFocus
                  maxLength={32}
                />
                <button
                  onClick={handleUsernameSave}
                  disabled={usernameSaving}
                  className="text-discord-accent text-xs hover:underline disabled:opacity-50 shrink-0"
                >
                  {usernameSaving ? "..." : t.profile.username_save}
                </button>
                <button
                  onClick={() => setEditingUsername(false)}
                  className="text-discord-text-muted text-xs hover:text-discord-text-primary shrink-0"
                >
                  {t.common.cancel}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-white font-medium">{currentUser?.username || "—"}</span>
                <button
                  onClick={startEditUsername}
                  className="text-discord-text-muted hover:text-discord-accent text-xs transition shrink-0"
                  title={t.profile.username_edit}
                >
                  ✏️
                </button>
              </div>
            )}
          </div>
          {usernameMessage && (
            <p className={`text-xs ${usernameMessage === t.profile.username_saved ? "text-discord-success" : "text-discord-danger"}`}>
              {usernameMessage}
            </p>
          )}

          <p className="text-discord-text-secondary">
            <span className="text-discord-text-muted">{t.profile.role}: </span>
            <span className="text-discord-accent font-medium">{currentUser?.role || "USER"}</span>
          </p>
          <p className="text-discord-text-secondary break-all">
            <span className="text-discord-text-muted">{t.profile.email}: </span>
            <span className="text-white break-all">{currentUser?.email || "—"}</span>
          </p>
          <p className="text-discord-text-secondary">
            <span className="text-discord-text-muted">{t.profile.registered}: </span>
            <span className="text-white">
              {currentUser?.created_at
                ? new Date(currentUser.created_at).toLocaleString()
                : "—"}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap mt-2 max-w-full overflow-hidden">
          <input
            type="file"
            accept="image/*"
            className="text-xs text-discord-text-secondary file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-discord-input file:text-white hover:file:bg-discord-input-hover cursor-pointer max-w-full min-w-0"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) setNewAvatar(e.target.files[0]);
              setUploadMessage("");
            }}
          />
          <button
            onClick={handleUploadClick}
            className="bg-discord-accent hover:bg-discord-accent-hover text-white text-sm px-3 py-1 rounded transition shrink-0"
          >
            {t.profile.change_avatar}
          </button>
        </div>
        {uploadMessage && (
          <p className="text-discord-success text-xs mt-1">{uploadMessage}</p>
        )}
      </div>
    </div>
  );
}
