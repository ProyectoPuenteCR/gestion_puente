import { LockKeyhole, ShieldCheck } from "lucide-react";
import Image from "next/image";
import { signIn } from "@/auth";
import { ThemeToggle } from "@/components/theme-toggle";

function errorMessage(error?: string) {
  if (error === "AccessDenied") {
    return "El acceso está limitado a cuentas verificadas @proyecto-puente.org.";
  }
  if (error) return "Google no pudo completar el ingreso. Intentá nuevamente.";
  return null;
}

export function LoginForm({ error }: { error?: string }) {
  const message = errorMessage(error);
  return (
    <main className="login-page">
      <ThemeToggle className="login-theme-toggle" />
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-brand">
          <Image src="/logo-proyecto-puente.jpg" alt="Proyecto Puente" width={220} height={144} priority />
        </div>
        <div className="login-icon" aria-hidden="true"><LockKeyhole /></div>
        <div className="login-copy">
          <p className="eyebrow">ACCESO INSTITUCIONAL</p>
          <h1 id="login-title">Panel de gestión</h1>
          <p>Ingresá con tu cuenta de Google de Proyecto Puente. El rol se asigna automáticamente según el correo.</p>
        </div>
        <form
          className="login-form"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          {message ? <p className="form-error" role="alert">{message}</p> : null}
          <button type="submit" className="google-signin">
            <span className="google-mark" aria-hidden="true">G</span>
            Continuar con Google
          </button>
        </form>
        <div className="access-summary">
          <span><strong>Usuarios</strong><small>Cuentas @proyecto-puente.org</small></span>
          <span><strong>Administración</strong><small>Rol asignado por correo autorizado</small></span>
        </div>
        <p className="security-note"><ShieldCheck /> La aplicación nunca recibe ni almacena tu contraseña de Google.</p>
      </section>
      <aside className="login-art" aria-hidden="true">
        <div className="login-orbit orbit-one" />
        <div className="login-orbit orbit-two" />
        <div className="login-bridge"><span /><span /><span /></div>
        <div className="login-art-copy">
          <p>Información clara para acompañar mejor.</p>
          <strong>Sistema de gestión de usuarios.</strong>
        </div>
      </aside>
    </main>
  );
}
