
import AchievementsManager from "@/components/achievements-manager";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Achievements - InterviewAI",
  description: "Log, track, and manage your career achievements using the STAR method.",
};

export default function AchievementsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-center text-primary">My Achievements</h1>
      <AchievementsManager />
    </div>
  );
}
