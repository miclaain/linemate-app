-- Fix: request_login used max(uuid) which Postgres has no aggregate for.
-- Replace with two separate queries (count, then id when unambiguous).

CREATE OR REPLACE FUNCTION public.request_login(p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match_count int;
  v_linemate_id uuid;
  v_resolved text;
  v_request_id uuid;
  v_trimmed text;
BEGIN
  v_trimmed := btrim(coalesce(p_name, ''));
  IF char_length(v_trimmed) = 0 OR char_length(v_trimmed) > 100 THEN
    RAISE EXCEPTION 'invalid name';
  END IF;

  SELECT count(*) INTO v_match_count
  FROM public.linemates
  WHERE name = v_trimmed AND status = 'active';

  IF v_match_count = 1 THEN
    SELECT id INTO v_linemate_id
    FROM public.linemates
    WHERE name = v_trimmed AND status = 'active'
    LIMIT 1;
    v_resolved := 'matched';
  ELSIF v_match_count > 1 THEN
    v_resolved := 'ambiguous';
    v_linemate_id := NULL;
  ELSE
    v_resolved := 'unknown';
    v_linemate_id := NULL;
  END IF;

  INSERT INTO public.login_requests (name_input, linemate_id, status)
  VALUES (v_trimmed, v_linemate_id, 'pending')
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object('id', v_request_id, 'resolved', v_resolved);
END;
$$;
