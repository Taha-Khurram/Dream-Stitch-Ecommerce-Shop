-- ==============================================================================
-- Supabase PostgreSQL Schema for 'todos' Table with Row Level Security (RLS)
-- Run this in your Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Create the todos table
CREATE TABLE IF NOT EXISTS public.todos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Create index on user_id for fast queries
CREATE INDEX IF NOT EXISTS todos_user_id_idx ON public.todos(user_id);
CREATE INDEX IF NOT EXISTS todos_created_at_idx ON public.todos(created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.todos ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies: Authenticated users can only access their own todos

-- SELECT Policy
CREATE POLICY "Users can select their own todos"
ON public.todos
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- INSERT Policy
CREATE POLICY "Users can insert their own todos"
ON public.todos
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- UPDATE Policy
CREATE POLICY "Users can update their own todos"
ON public.todos
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- DELETE Policy
CREATE POLICY "Users can delete their own todos"
ON public.todos
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
