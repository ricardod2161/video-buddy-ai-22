
-- 1) Remove user-controlled UPDATE on user_credits (prevents balance inflation)
DROP POLICY IF EXISTS "Users update own credits" ON public.user_credits;

-- 2) Replace consume_credit: take explicit user_id, callable only by service_role
DROP FUNCTION IF EXISTS public.consume_credit();
DROP FUNCTION IF EXISTS public.consume_credit(uuid);

CREATE OR REPLACE FUNCTION public.consume_credit(_user_id uuid)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining INT;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_user';
  END IF;

  UPDATE public.user_credits
     SET amount = amount - 1,
         updated_at = now()
   WHERE user_id = _user_id
     AND amount > 0
  RETURNING amount INTO remaining;

  IF remaining IS NULL THEN
    RAISE EXCEPTION 'no_credits';
  END IF;

  RETURN remaining;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_credit(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_credit(uuid) TO service_role;

-- 3) Storage: explicit user-scoped write policies on videos-output
DROP POLICY IF EXISTS "out_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "out_update_own" ON storage.objects;
DROP POLICY IF EXISTS "out_delete_own" ON storage.objects;

CREATE POLICY "out_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'videos-output'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "out_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'videos-output'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'videos-output'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "out_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'videos-output'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- 4) Realtime: scope channel subscriptions to topics containing the user's id
DROP POLICY IF EXISTS "realtime_user_scoped_read" ON realtime.messages;
DROP POLICY IF EXISTS "realtime_user_scoped_write" ON realtime.messages;

CREATE POLICY "realtime_user_scoped_read" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    realtime.topic() LIKE '%:' || (auth.uid())::text
    OR realtime.topic() LIKE '%:' || (auth.uid())::text || ':%'
  );

CREATE POLICY "realtime_user_scoped_write" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    realtime.topic() LIKE '%:' || (auth.uid())::text
    OR realtime.topic() LIKE '%:' || (auth.uid())::text || ':%'
  );
