-- Create Documents Table
create table documents (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text,
  content text,
  last_modified bigint,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create References Table
create table references (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  type text,
  title text,
  author text,
  year text,
  source text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table documents enable row level security;
alter table references enable row level security;

-- Policies for Documents
create policy "Users can select their own documents"
  on documents for select
  using (auth.uid() = user_id);

create policy "Users can insert their own documents"
  on documents for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own documents"
  on documents for update
  using (auth.uid() = user_id);

create policy "Users can delete their own documents"
  on documents for delete
  using (auth.uid() = user_id);

-- Policies for References
create policy "Users can select their own references"
  on references for select
  using (auth.uid() = user_id);

create policy "Users can insert their own references"
  on references for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own references"
  on references for update
  using (auth.uid() = user_id);

create policy "Users can delete their own references"
  on references for delete
  using (auth.uid() = user_id);
