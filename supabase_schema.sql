-- 1. Quizzes Table (Library features added)
CREATE TABLE quizzes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  questions JSONB NOT NULL DEFAULT '[]',
  is_public BOOLEAN DEFAULT true, -- For Library sharing
  school_level TEXT, -- 초, 중, 고
  subjects TEXT[], -- ['국어', '수학', ...]
  created_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'Asia/Seoul') NOT NULL
);

-- 2. Games Table
CREATE TABLE games (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE SET NULL,
  host_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'WAITING', -- WAITING, PLAYING, RESULT, ENDED
  current_q_index INTEGER DEFAULT 0,
  current_hint_stage INTEGER DEFAULT 0, -- 0: No hint, 1: Length, 2: First char/Consonant
  options JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'Asia/Seoul') NOT NULL
);

-- 3. Players Table
CREATE TABLE players (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  team TEXT, -- RED, BLUE, GREEN, YELLOW
  buffs TEXT[] DEFAULT '{}',
  is_alive BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'Asia/Seoul') NOT NULL,
  UNIQUE(game_id, nickname)
);

-- 4. Answers Table
CREATE TABLE answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  q_index INTEGER NOT NULL,
  answer TEXT,
  is_correct BOOLEAN DEFAULT false,
  points_awarded INTEGER DEFAULT 0,
  event TEXT, -- double, swap, strike, shield, etc.
  created_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'Asia/Seoul') NOT NULL
);

-- 5. Posts Table (Community)
CREATE TABLE posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  author_email TEXT NOT NULL, -- To display who wrote it
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'Asia/Seoul') NOT NULL
);

-- 6. Comments Table (Community)
CREATE TABLE comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  author_email TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'Asia/Seoul') NOT NULL
);

-- Set up Row Level Security (RLS)
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Quizzes: Teachers can manage their own, Public can read if is_public = true
CREATE POLICY "Public can view shared quizzes" ON quizzes FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "Teachers can manage their own quizzes" ON quizzes FOR ALL USING (auth.uid() = user_id);

-- Games: Everyone can read active games (to join), but only host can manage
CREATE POLICY "Public can read games" ON games FOR SELECT USING (true);
CREATE POLICY "Hosts can manage their own games" ON games FOR ALL USING (auth.uid() = host_id);

-- Players: Public can join games and read, players update their own
CREATE POLICY "Public can join games" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can read players" ON players FOR SELECT USING (true);
CREATE POLICY "Players can update their own status" ON players FOR UPDATE USING (true);

-- Answers: Players submit, Host reads
CREATE POLICY "Players can submit answers" ON answers FOR INSERT WITH CHECK (true);
CREATE POLICY "Everyone can read answers" ON answers FOR SELECT USING (true);
CREATE POLICY "Everyone can update answers" ON answers FOR UPDATE USING (true);

-- Posts: Anyone can read, Users insert, Users edit/delete own or admin
CREATE POLICY "Anyone can read posts" ON posts FOR SELECT USING (true);
CREATE POLICY "Users can insert posts" ON posts FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can edit/delete their own posts or admin can delete any" ON posts FOR ALL USING (
  auth.uid() = user_id OR auth.jwt() ->> 'email' = 'dltjdrms320@gmail.com'
);

-- Comments: Anyone can read, Users insert, Users edit/delete own or admin
CREATE POLICY "Anyone can read comments" ON comments FOR SELECT USING (true);
CREATE POLICY "Users can insert comments" ON comments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can edit/delete their own comments or admin can delete any" ON comments FOR ALL USING (
  auth.uid() = user_id OR auth.jwt() ->> 'email' = 'dltjdrms320@gmail.com'
);

-- 7. Profiles Table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  school_name TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT (now() AT TIME ZONE 'Asia/Seoul') NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Connect other tables to profiles
ALTER TABLE posts ADD CONSTRAINT posts_user_id_fkey_profiles FOREIGN KEY (user_id) REFERENCES profiles(id);
ALTER TABLE comments ADD CONSTRAINT comments_user_id_fkey_profiles FOREIGN KEY (user_id) REFERENCES profiles(id);
ALTER TABLE quizzes ADD CONSTRAINT quizzes_user_id_fkey_profiles FOREIGN KEY (user_id) REFERENCES profiles(id);

-- Add avatar_url column to profiles
ALTER TABLE profiles ADD COLUMN avatar_url TEXT;

-- Storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Storage bucket for AI generation buffer (Temporary)
INSERT INTO storage.buckets (id, name, public) VALUES ('ai-temp', 'ai-temp', true);

-- Policies for avatar storage
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can insert avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Users can update avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid() = owner);

-- Policies for AI Temp storage (Publicly readable so the server can fetch them easily, but insertable by authenticated users)
CREATE POLICY "Public AI Temp Access" ON storage.objects FOR SELECT USING (bucket_id = 'ai-temp');
CREATE POLICY "Users can upload to AI Temp" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'ai-temp' AND auth.role() = 'authenticated');
CREATE POLICY "Users can delete from AI Temp" ON storage.objects FOR DELETE USING (bucket_id = 'ai-temp' AND auth.role() = 'authenticated');