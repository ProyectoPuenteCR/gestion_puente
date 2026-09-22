import { LogOut } from "lucide-react";
import { signOut } from "@/auth";

export function SignOutButton() {
  return (
    <form
      className="signout-form"
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button type="submit" className="sidebar-signout">
        <LogOut />
        <span>Cerrar sesión</span>
      </button>
    </form>
  );
}
