import { PasswordForm, ProfileForm } from "@/components/account/profile-forms";

export default function ProfilePage() {
  return (
    <div className="max-w-xl space-y-10">
      <ProfileForm />
      <PasswordForm />
    </div>
  );
}
