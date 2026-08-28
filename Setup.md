You are an expert full-stack developer. Please bootstrap a new web application using Next.js (App Router), Supabase (Database & Auth), and a strict RESTful API architecture using Next.js Route Handlers.

Follow these requirements and best practices precisely:

### 1. Tech Stack
*   **Framework:** Next.js 15+ (App Router) with React, TypeScript, and Tailwind CSS.
*   **Backend/Database:** Supabase (PostgreSQL).
*   **Auth & SDK:** `@supabase/supabase-js` and `@supabase/ssr` (for secure, cookie-based server-side auth).
*   **Validation:** Zod (for strictly typed API payload validation).

### 2. Initialization & Setup Instructions
1.  Provide the exact CLI commands to scaffold the Next.js app with TypeScript and Tailwind, and install the required dependencies (`@supabase/supabase-js`, `@supabase/ssr`, `zod`).
2.  Provide a template for `.env.local` containing placeholders for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### 3. Supabase Configuration & Auth
Write the exact code for the standard Supabase SSR utility files:
*   **Browser Client:** `lib/supabase/client.ts` using `createBrowserClient`.
*   **Server Client:** `lib/supabase/server.ts` utilizing `createServerClient` and Next.js `cookies()`. Ensure you account for Next.js 15+ asynchronous `cookies()`.
*   **Middleware:** `middleware.ts` at the project root to securely refresh sessions on navigation.

### 4. REST API (Route Handlers) Blueprint
Design a complete, production-ready REST API for a `todos` resource. Implement the following endpoints using standard HTTP methods in Next.js Route Handlers:

*   **Collection Route (`app/api/todos/route.ts`):**
    *   `GET`: Fetch all items belonging to the currently authenticated user.
    *   `POST`: Create a new item. Use a Zod schema to parse and validate `request.json()`.
*   **Dynamic Route (`app/api/todos/[id]/route.ts`):**
    *   `GET`: Fetch a specific item by ID. 
    *   `PATCH`: Update an item by ID (validate payload with Zod).
    *   `DELETE`: Delete an item by ID.

### 5. Strict API Guidelines to Follow
*   **Security First:** Always use `await supabase.auth.getUser()` at the top of every protected Route Handler to verify the token server-side. Do not rely on `getSession()` for authorization logic.
*   **Standardized Responses:** Use `NextResponse.json()` for all replies. Return clear HTTP status codes (e.g., `200` OK, `201` Created, `400` Bad Request for Zod validation failures, `401` Unauthorized, `500` Internal Server Error).
*   **Next.js 15 Parity:** Ensure dynamic route properties (like `params`) and `cookies()` are properly awaited according to the latest Next.js 15 API changes.
*   **Error Catching:** Wrap database calls and JSON parsing in `try/catch` blocks so the API never crashes ungracefully.

Please generate the CLI commands, file structures, and complete TypeScript code for these requirements.