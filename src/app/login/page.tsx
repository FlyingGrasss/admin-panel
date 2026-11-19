import type { Metadata } from "next";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "Giriş",
};

export default function LoginPage() {
  return (
    <main className="login-page">
      <LoginForm />
    </main>
  );
}
