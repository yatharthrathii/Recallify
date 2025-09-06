import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import {
  getUserStats,
  updateUserStats,
  initUserStats,
} from "../firebase/firebase";

const StatsContext = createContext();

export const StatsProvider = ({ children }) => {
  const { user } = useAuth(); 
  const [stats, setStats] = useState(null);

  const normalizeStats = (data) => ({
    xp: data?.xp ?? 0,
    level: data?.level ?? 1,
    streak: data?.streak ?? 0,
    lastLogin: data?.lastLogin ?? new Date().toISOString().split("T")[0],
    badges: {
      first100: data?.badges?.first100 ?? false,
      streak7: data?.badges?.streak7 ?? false,
    },
    history: data?.history ?? [], // XP history track
  });

  useEffect(() => {
    const fetchStats = async () => {
      if (user?.id && user?.token) {
        let data = await getUserStats(user.id, user.token);

        if (!data || Object.keys(data).length === 0) {
          data = await initUserStats(user.id, user.token);
        }

        const normalized = normalizeStats(data);
        setStats(normalized);

        await checkStreak(normalized);
      } else {
        setStats(null);
      }
    };

    fetchStats();
  }, [user]);

  const updateStats = async (newStats) => {
    if (!user) return;

    const updated = normalizeStats({ ...stats, ...newStats });
    await updateUserStats(user.id, user.token, updated);
    setStats(updated);
  };

  const gainXP = async (points) => {
    if (!user || !stats) return;

    let newXP = stats.xp + points;
    let newLevel = stats.level;

    if (newXP >= 100) {
      newLevel += Math.floor(newXP / 100);
      newXP = newXP % 100;
    }

    const today = new Date().toISOString().split("T")[0];
    const history = [...(stats.history || [])];
    const todayIndex = history.findIndex(h => h.date === today);

    if (todayIndex > -1) {
      history[todayIndex].xp = newXP;
    } else {
      history.push({ date: today, xp: newXP });
    }

    const updated = {
      ...stats,
      xp: newXP,
      level: newLevel,
      badges: { ...stats.badges },
      history,
    };

    if (!updated.badges.first100 && newLevel > 1) updated.badges.first100 = true;

    await updateUserStats(user.id, user.token, updated);
    setStats(normalizeStats(updated));
  };

  const checkStreak = async (currentStats) => {
    if (!user) return;

    const today = new Date().toISOString().split("T")[0];
    const last = currentStats.lastLogin;

    if (last === today) return;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    let newStreak = last === yesterdayStr ? currentStats.streak + 1 : 1;

    const updated = {
      ...currentStats,
      streak: newStreak,
      lastLogin: today,
      badges: { ...currentStats.badges },
      history: currentStats.history || [],
    };

    if (!updated.badges.streak7 && newStreak >= 7) updated.badges.streak7 = true;

    await updateUserStats(user.id, user.token, updated);
    setStats(normalizeStats(updated));
  };

  return (
    <StatsContext.Provider value={{ stats, updateStats, gainXP }}>
      {children}
    </StatsContext.Provider>
  );
};

export const useStats = () => useContext(StatsContext);
