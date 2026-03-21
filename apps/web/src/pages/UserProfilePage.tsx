import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import { User } from "../types";
import { getImageUrl } from "../utils/imageUrl";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n";
import ProfileBackground from "../components/profile/ProfileBackground";
import { AvatarWithFrame } from "../components/profile/AvatarFrameShop";
import UsernameDisplay from "../components/profile/UsernameDisplay";
import { useHoverCard } from "../context/HoverCardContext";

type FriendStatus = "none" | "pending_sent" | "pending_received" | "accepted";

export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [friends, setFriends] = useState<User[]>([]);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>("none");
  const [friendLoading, setFriendLoading] = useState(false);
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { t, lang } = useI18n();
  const { showCard, hideCard } = useHoverCard();

  useEffect(() => {
    if (!userId) return;

    api
      .get<User>(`/users/${userId}`)
      .then((res) => {
        setUser(res.data);
        setFriends(res.data.friends || []);
      })
      .catch((err) => {
        console.error(err);
        alert(t.profile.loading);
        navigate(-1);
      });

    api
      .get<{ status: FriendStatus }>(`/friends/status/${userId}`)
      .then((res) => setFriendStatus(res.data.status))
      .catch(() => setFriendStatus("none"));
  }, [userId, navigate, t]);

  const startChat = async () => {
    if (!user) return;
    try {
      const res = await api.post<{ id: number }>("/chats/private", { friendId: user.id });
      if (!res.data?.id) {
        alert(t.common.error);
        return;
      }
      navigate("/", {
        state: {
          openChatId: res.data.id,
          friend: { username: user.username, avatar_url: user.avatar_url },
        },
      });
    } catch (err: any) {
      alert(err.response?.data?.message || err.message);
    }
  };

  const addFriend = async () => {
    if (!user || friendLoading) return;
    setFriendLoading(true);
    try {
      await api.post("/friends/request", { friendId: user.id });
      setFriendStatus("pending_sent");
    } catch (err: any) {
      alert(err.response?.data?.message || t.common.error);
    } finally {
      setFriendLoading(false);
    }
  };

  const removeFriend = async () => {
    if (!user || !window.confirm(t.profile.remove_confirm)) return;
    setFriendLoading(true);
    try {
      await api.post(`/friends/remove`, { friendId: user.id });
      setFriends((prev) => prev.filter((f) => Number(f.id) !== Number(user.id)));
      setUser((prev) =>
        prev
          ? {
              ...prev,
              friends: (prev.friends || []).filter(
                (f) => Number(f.id) !== Number(currentUser?.id)
              ),
            }
          : prev
      );
      setFriendStatus("none");
      alert(t.profile.removed_success);
    } catch (err) {
      console.error(err);
      alert(t.common.error);
    } finally {
      setFriendLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex-1 flex items-center justify-center text-discord-text-muted bg-discord-bg">
        {t.common.loading}
      </div>
    );
  }

  const isMe = Number(currentUser?.id) === Number(user.id);

  const COUNTRIES: Record<string, { flag: string; name_ru: string; name_en: string }> = {
    RU: { flag: "\u{1F1F7}\u{1F1FA}", name_ru: "Россия", name_en: "Russia" },
    US: { flag: "\u{1F1FA}\u{1F1F8}", name_ru: "США", name_en: "USA" },
    GB: { flag: "\u{1F1EC}\u{1F1E7}", name_ru: "Великобритания", name_en: "UK" },
    DE: { flag: "\u{1F1E9}\u{1F1EA}", name_ru: "Германия", name_en: "Germany" },
    FR: { flag: "\u{1F1EB}\u{1F1F7}", name_ru: "Франция", name_en: "France" },
    UA: { flag: "\u{1F1FA}\u{1F1E6}", name_ru: "Украина", name_en: "Ukraine" },
    KZ: { flag: "\u{1F1F0}\u{1F1FF}", name_ru: "Казахстан", name_en: "Kazakhstan" },
    BY: { flag: "\u{1F1E7}\u{1F1FE}", name_ru: "Беларусь", name_en: "Belarus" },
    JP: { flag: "\u{1F1EF}\u{1F1F5}", name_ru: "Япония", name_en: "Japan" },
    CN: { flag: "\u{1F1E8}\u{1F1F3}", name_ru: "Китай", name_en: "China" },
    KR: { flag: "\u{1F1F0}\u{1F1F7}", name_ru: "Южная Корея", name_en: "South Korea" },
    BR: { flag: "\u{1F1E7}\u{1F1F7}", name_ru: "Бразилия", name_en: "Brazil" },
    IN: { flag: "\u{1F1EE}\u{1F1F3}", name_ru: "Индия", name_en: "India" },
    TR: { flag: "\u{1F1F9}\u{1F1F7}", name_ru: "Турция", name_en: "Turkey" },
    IT: { flag: "\u{1F1EE}\u{1F1F9}", name_ru: "Италия", name_en: "Italy" },
    ES: { flag: "\u{1F1EA}\u{1F1F8}", name_ru: "Испания", name_en: "Spain" },
    PL: { flag: "\u{1F1F5}\u{1F1F1}", name_ru: "Польша", name_en: "Poland" },
    CA: { flag: "\u{1F1E8}\u{1F1E6}", name_ru: "Канада", name_en: "Canada" },
    AU: { flag: "\u{1F1E6}\u{1F1FA}", name_ru: "Австралия", name_en: "Australia" },
  };

  const countryInfo = user.country ? COUNTRIES[user.country] : null;

  return (
    <div className="flex-1 overflow-y-auto bg-discord-bg p-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-4">
        <h2 className="text-white text-2xl font-bold">
          <UsernameDisplay username={user.username} color={user.username_color} anim={user.username_anim} badge={user.profile_badge} />
        </h2>

        {/* Profile header with banner */}
        <div className="bg-discord-secondary rounded-xl">
          <ProfileBackground profileBg={user.profile_bg} height={100} />
          <div className="px-6 pb-6">
            <div className="flex items-end gap-4 -mt-10 mb-3 flex-wrap">
              <div className="ring-4 ring-discord-secondary rounded-full shrink-0">
                <AvatarWithFrame
                  src={getImageUrl(user.avatar_url)}
                  frame={user.avatar_frame}
                  size={80}
                />
              </div>
              <div className="flex flex-col gap-0.5 pb-1 min-w-0">
                <UsernameDisplay
                  username={user.username}
                  color={user.username_color}
                  anim={user.username_anim}
                  badge={user.profile_badge}
                  className="text-white text-xl font-bold truncate"
                />
                {countryInfo && (
                  <p className="text-discord-text-secondary text-sm">
                    {countryInfo.flag} {lang === "ru" ? countryInfo.name_ru : countryInfo.name_en}
                  </p>
                )}
                <p className="text-discord-text-muted text-sm">
                  {t.profile.role}:{" "}
                  <span className="text-discord-accent font-medium">{user.role || "USER"}</span>
                </p>
                <p className="text-discord-text-muted text-sm">
                  {t.profile.registered}:{" "}
                  <span className="text-discord-text-secondary">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bio + social link */}
        {(user.bio || user.social_link) && (
          <div className="bg-discord-secondary rounded-xl p-6 flex flex-col gap-2">
            {user.bio && (
              <>
                <h3 className="text-white font-semibold text-base mb-1">{t.profile.bio}</h3>
                <p className="text-discord-text-secondary text-sm">{user.bio}</p>
              </>
            )}
            {user.social_link && (
              <a
                href={user.social_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-discord-accent text-sm hover:underline truncate"
              >
                🔗 {user.social_link.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        )}

        {/* Friends */}
        <div className="bg-discord-secondary rounded-xl p-6">
          <h3 className="text-white font-semibold text-base mb-3">{t.profile.friends}</h3>
          {friends.length === 0 ? (
            <p className="text-discord-text-muted text-sm">{t.profile.no_friends}</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {friends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl bg-discord-input hover:bg-discord-input-hover cursor-pointer hover:-translate-y-1 transition w-28 shrink-0"
                  onClick={() => navigate(`/profile/${friend.id}`)}
                >
                  <img
                    src={getImageUrl(friend.avatar_url)}
                    alt={friend.username}
                    className="w-12 h-12 rounded-full object-cover"
                    onMouseEnter={(e) => showCard(friend.id, (e.currentTarget as HTMLElement).getBoundingClientRect())}
                    onMouseLeave={hideCard}
                  />
                  <span className="text-discord-text-secondary text-xs text-center truncate w-full">
                    {friend.username}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {!isMe && (
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={startChat}
              style={user.accent_color ? { background: user.accent_color } : undefined}
              className="bg-discord-accent hover:bg-discord-accent-hover text-white font-semibold px-4 py-2 rounded transition"
            >
              {t.profile.start_chat}
            </button>

            {friendStatus === "accepted" && user.username !== "LumeOfficial" && (
              <button
                onClick={removeFriend}
                disabled={friendLoading}
                className="bg-discord-danger/20 hover:bg-discord-danger text-discord-danger hover:text-white font-semibold px-4 py-2 rounded transition disabled:opacity-50"
              >
                {t.profile.remove_friend}
              </button>
            )}

            {friendStatus === "none" && (
              <button
                onClick={addFriend}
                disabled={friendLoading}
                className="bg-discord-success/20 hover:bg-discord-success text-discord-success hover:text-white font-semibold px-4 py-2 rounded transition disabled:opacity-50"
              >
                {friendLoading ? "..." : t.profile.add_friend}
              </button>
            )}

            {(friendStatus === "pending_sent" || friendStatus === "pending_received") && (
              <button
                disabled
                className="bg-discord-tertiary text-discord-text-muted font-semibold px-4 py-2 rounded cursor-not-allowed opacity-60"
              >
                {t.profile.friend_request_pending}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
