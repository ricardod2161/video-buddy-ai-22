
-- Tighten realtime channel policies: exact match on last segment = auth.uid()
DROP POLICY IF EXISTS realtime_user_scoped_read ON realtime.messages;
DROP POLICY IF EXISTS realtime_user_scoped_write ON realtime.messages;

CREATE POLICY realtime_user_scoped_read ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    split_part(realtime.topic(), ':', 1) = 'project'
    AND split_part(realtime.topic(), ':', 3) = (auth.uid())::text
  );

CREATE POLICY realtime_user_scoped_write ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    split_part(realtime.topic(), ':', 1) = 'project'
    AND split_part(realtime.topic(), ':', 3) = (auth.uid())::text
  );

-- Explicit deny on client-side credit mutations (RLS already denies by default,
-- but make it explicit for auditors / future policy additions)
CREATE POLICY "Deny client insert credits" ON public.user_credits
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "Deny client update credits" ON public.user_credits
  FOR UPDATE TO authenticated USING (false);
CREATE POLICY "Deny client delete credits" ON public.user_credits
  FOR DELETE TO authenticated USING (false);
