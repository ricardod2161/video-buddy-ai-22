
-- =========================================
-- user_credits
-- =========================================
CREATE TABLE public.user_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INT NOT NULL DEFAULT 10 CHECK (amount >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.user_credits TO authenticated;
GRANT ALL ON public.user_credits TO service_role;

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own credits"
  ON public.user_credits FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own credits"
  ON public.user_credits FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger: cria créditos automaticamente para novos usuários
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, amount)
  VALUES (NEW.id, 10)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Função para consumir 1 crédito de forma atômica
CREATE OR REPLACE FUNCTION public.consume_credit()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.user_credits
     SET amount = amount - 1,
         updated_at = now()
   WHERE user_id = auth.uid()
     AND amount > 0
  RETURNING amount INTO remaining;

  IF remaining IS NULL THEN
    RAISE EXCEPTION 'no_credits';
  END IF;

  RETURN remaining;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_credit() TO authenticated;

-- =========================================
-- videos
-- =========================================
CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  original_url TEXT NOT NULL,
  output_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed')),
  error_msg TEXT,
  clips_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_videos_user_status ON public.videos(user_id, status);
CREATE INDEX idx_videos_user_created ON public.videos(user_id, created_at DESC);

GRANT SELECT, INSERT ON public.videos TO authenticated;
GRANT ALL ON public.videos TO service_role;

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own videos"
  ON public.videos FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own videos"
  ON public.videos FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE/DELETE são bloqueados ao cliente; só service_role (backend) altera status.

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.videos;
ALTER TABLE public.videos REPLICA IDENTITY FULL;

-- =========================================
-- Storage bucket privado: videos-input
-- =========================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos-input', 'videos-input', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users read own input files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'videos-input'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users upload to own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'videos-input'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own input files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'videos-input'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
