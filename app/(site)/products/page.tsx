import { redirect } from "next/navigation";

export default async function ProductsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const queryString = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "string") {
      queryString.set(key, value);
    }
  });

  const query = queryString.toString();
  redirect(`/shop${query ? `?${query}` : ""}`);
}
