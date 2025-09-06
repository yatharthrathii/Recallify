import { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { useStats } from "../context/StatsContext";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy, Calendar, Star, Edit } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export default function Profile() {
  const { user, login } = useContext(AuthContext);
  const { stats, gainXP } = useStats();
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || "");

  if (!stats) return <p className="text-center mt-10 text-gray-300">Loading profile...</p>;

  const xpProgress = stats.xp % 100;

  const levels = [
    { name: "Bronze", value: 1, color: "#cd7f32" },
    { name: "Silver", value: 2, color: "#C0C0C0" },
    { name: "Gold", value: 3, color: "#FFD700" },
    { name: "Platinum", value: 4, color: "#E5E4E2" },
    { name: "Diamond", value: 5, color: "#00CFFF" },
  ];

  const currentLevel = levels.find((lvl) => lvl.value === stats.level) || { name: "Explorer", color: "#999" };

  const handleUsernameSave = () => {
    login({ ...user, username });
    setEditing(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Profile Info */}
        <Card className="p-6 rounded-2xl shadow-xl bg-gray-900/80 backdrop-blur-lg border border-gray-700">
          <h2 className="text-2xl font-bold mb-4 text-white">Profile</h2>
          <p className="text-gray-300 mb-2"><b>Email:</b> {user?.email}</p>
          <div className="flex items-center gap-2 mb-2">
            <b className="text-gray-300">Username:</b>
            {editing ? (
              <>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-gray-800 text-white px-2 py-1 rounded outline-none"
                />
                <button
                  onClick={handleUsernameSave}
                  className="bg-green-600 hover:bg-green-500 px-2 py-1 rounded text-white transition"
                >
                  Save
                </button>
              </>
            ) : (
              <>
                <span className="text-gray-200">{username || "Not set"}</span>
                <Edit
                  className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-200"
                  onClick={() => setEditing(true)}
                />
              </>
            )}
          </div>
          <p className="text-gray-400"><b>Last Login:</b> {stats.lastLogin}</p>
        </Card>

        {/* Stats */}
        <Card className="p-6 rounded-2xl shadow-xl bg-gray-900/80 backdrop-blur-lg border border-gray-700">
          <h2 className="text-2xl font-bold mb-4 text-white">Stats</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* XP */}
            <div>
              <p className="flex items-center gap-2 text-gray-300">
                <Star className="w-5 h-5 text-yellow-500" /> XP
              </p>
              <Progress value={xpProgress} className="h-3 mt-1 mb-1" />
              <p className="text-gray-200">{xpProgress}/100 XP</p>
              <p className="text-sm text-gray-400">{100 - xpProgress} XP left to next level</p>
            </div>

            {/* Level */}
            <div>
              <p className="flex items-center gap-2 text-gray-300">
                <Trophy className="w-5 h-5 text-green-500" /> Level
              </p>
              <p className="text-lg font-semibold text-gray-200">
                {stats.level} ({currentLevel.name})
              </p>
            </div>

            {/* Streak */}
            <div>
              <p className="flex items-center gap-2 text-gray-300">
                <Calendar className="w-5 h-5 text-blue-500" /> Streak
              </p>
              <p className="text-lg font-semibold text-gray-200">{stats.streak} 🔥 days</p>
            </div>
          </div>
        </Card>

        {/* Level Progress Graph */}
        <Card className="p-6 rounded-2xl shadow-xl bg-gray-900/80 backdrop-blur-lg border border-gray-700">
          <h2 className="text-2xl font-bold mb-4 text-white">Level Progress</h2>
          <div className="h-64 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={levels}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  isAnimationActive={true}
                >
                  {levels.map((lvl, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={lvl.color}
                      stroke={lvl.value === stats.level ? "white" : "gray"}
                      strokeWidth={lvl.value === stats.level ? 4 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: "#dadee3", borderRadius: "8px", border: "none", color: "#fff" }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center text */}
            <div className="absolute text-center">
              <p className="text-lg font-bold text-white">Level {stats.level}</p>
              <p style={{ color: currentLevel.color }}>{currentLevel.name}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
