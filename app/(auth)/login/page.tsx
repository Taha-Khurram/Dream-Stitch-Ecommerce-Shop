import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const { error, message } = await searchParams;
  const queryString = new URLSearchParams();
  if (error) queryString.set("error", error);
  if (message) queryString.set("message", message);

  const query = queryString.toString();
  redirect(`/signin${query ? `?${query}` : ""}`);
}
