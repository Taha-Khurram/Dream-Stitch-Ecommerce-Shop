You are an expert full-stack developer. Generate a complete, secure Supabase Authentication flow for a Next.js 15 (App Router) application. 

Follow these requirements exactly:
1. UI Components: Provide the code for a Login page (`app/login/page.tsx`) and a Sign-up page (`app/signup/page.tsx`) using Tailwind CSS.
2. Server Actions: Implement `app/auth/actions.ts` for `signIn`, `signUp`, and `signOut` utilizing Supabase Auth.
3. Client Configurations: Use `@supabase/ssr` and ensure compatibility with Next.js 15 by `await`ing `cookies()` before using them in the server client setup.
4. Middleware: Provide the exact `middleware.ts` code to refresh user sessions securely via HTTP-only cookies on every navigation.
5. Route Protection: Create a protected route example (e.g., `app/dashboard/page.tsx`) that enforces access control by calling `await supabase.auth.getUser()`. Do not use `getSession()` for server-side protection logic.
6. Email Verification: Include the route handler for email verification callbacks (`app/auth/confirm/route.ts`).