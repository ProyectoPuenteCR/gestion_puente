import { PublicMemberApplication } from "@/components/public-member-application";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function NewMemberApplicationPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return <PublicMemberApplication token={params.token ?? ""} />;
}
