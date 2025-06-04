
import UserSettingsForm from "@/components/user-settings-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "User Settings - InterviewAI",
  description: "Manage your application settings and preferences.",
};

export default function SettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-center text-primary">
        User Settings
      </h1>
      <UserSettingsForm />
    </div>
  );
}
