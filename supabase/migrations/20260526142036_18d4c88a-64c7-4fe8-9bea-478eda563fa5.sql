
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_credit() FROM PUBLIC, anon;
-- consume_credit permanece executável apenas por authenticated (já concedido).
