import { auth, isGoogleAuthConfigured } from "@/auth";
import { LoginForm } from "@/components/login-form";
import { PortalShell } from "@/components/portal-shell";
import { SignOutButton } from "@/components/sign-out-button";
import { hasAcceptedCurrentCode, lookupPlatformAccess } from "@/lib/google-sheets";
import { getPortalData, scopePortalData } from "@/lib/portal-data";

export const dynamic = "force-dynamic";

function ConfigurationRequired() {
  return (
    <main className="configuration-page">
      <section className="configuration-panel">
        <p className="eyebrow">CONFIGURACIÓN INCOMPLETA</p>
        <h1>Falta conectar el acceso con Google</h1>
        <p>
          Configurá <code>AUTH_GOOGLE_ID</code>, <code>AUTH_GOOGLE_SECRET</code> y <code>AUTH_SECRET</code>
          en Vercel. Hasta entonces la aplicación no mostrará ningún dato.
        </p>
      </section>
    </main>
  );
}

type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function Home({ searchParams }: PageProps) {
  if (!isGoogleAuthConfigured()) return <ConfigurationRequired />;

  const [session, params] = await Promise.all([auth(), searchParams]);
  if (!session?.user?.email) return <LoginForm error={params.error} />;

  const [access, unscopedData] = await Promise.all([lookupPlatformAccess(session.user.email), getPortalData()]);
  if (!access?.active) {
    return (
      <main className="configuration-page">
        <section className="configuration-panel">
          <p className="eyebrow">ACCESO DESACTIVADO</p>
          <h1>Tu cuenta no está habilitada</h1>
          <p>Pedile a un administrador que active tu email-puente en la plataforma.</p>
          <SignOutButton />
        </section>
      </main>
    );
  }
  let conductAcceptanceRequired = false;
  if (access.role !== "admin") {
    try {
      conductAcceptanceRequired = !(await hasAcceptedCurrentCode(access.email));
    } catch {
      conductAcceptanceRequired = false;
    }
  }
  const data = scopePortalData(unscopedData, access);
  return (
    <PortalShell
      data={data}
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        role: access.role,
      }}
      logoutControl={<SignOutButton />}
      conductAcceptanceRequired={conductAcceptanceRequired}
    />
  );
}
