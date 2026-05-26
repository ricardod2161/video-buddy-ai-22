-- Drop antigo
DROP TABLE IF EXISTS public.videos CASCADE;

-- updated_at helper (idempotente)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- PROJECTS
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'youtube',
  title TEXT,
  duration_sec INTEGER,
  status TEXT NOT NULL DEFAULT 'queued',
  progress INTEGER NOT NULL DEFAULT 0,
  error_msg TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_user ON public.projects(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "p_select" ON public.projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "p_insert" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "p_update" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "p_delete" ON public.projects FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CLIPS
CREATE TABLE public.clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  hashtags TEXT[] NOT NULL DEFAULT '{}',
  score INTEGER NOT NULL DEFAULT 0,
  start_sec NUMERIC NOT NULL,
  end_sec NUMERIC NOT NULL,
  transcript TEXT,
  virality_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clips_project ON public.clips(project_id);
CREATE INDEX idx_clips_user ON public.clips(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clips TO authenticated;
GRANT ALL ON public.clips TO service_role;

ALTER TABLE public.clips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "c_select" ON public.clips FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "c_insert" ON public.clips FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "c_update" ON public.clips FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "c_delete" ON public.clips FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- CLIP RENDERS
CREATE TABLE public.clip_renders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id UUID NOT NULL REFERENCES public.clips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  aspect_ratio TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  output_url TEXT,
  subtitle_style TEXT NOT NULL DEFAULT 'viral',
  error_msg TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (clip_id, aspect_ratio)
);
CREATE INDEX idx_renders_clip ON public.clip_renders(clip_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clip_renders TO authenticated;
GRANT ALL ON public.clip_renders TO service_role;

ALTER TABLE public.clip_renders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "r_select" ON public.clip_renders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "r_insert" ON public.clip_renders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "r_update" ON public.clip_renders FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "r_delete" ON public.clip_renders FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER renders_updated_at BEFORE UPDATE ON public.clip_renders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket de saída
INSERT INTO storage.buckets (id, name, public) VALUES ('videos-output', 'videos-output', false)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "out_read_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'videos-output' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clip_renders;