-- Login requests for the "name only" mate flow.
--
-- Mate enters their name on /auth/login -> server resolves to a linemate row
-- (must be active) -> inserts a row here -> admin sees it under
-- /admin/login-requests and clicks "PIN 발급" to issue/reset a PIN, which is
-- communicated to the mate out-of-band (Kakao). Mate then enters name + PIN
-- on the login page to actually authenticate.
--
-- Inserts go through a SECURITY DEFINER RPC so anonymous callers cannot
-- enumerate the linemates table directly via this surface.

CREATE TABLE public.login_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Whatever the mate typed. Stored verbatim for admin to disambiguate
  -- when name lookup is ambiguous.
  name_input text NOT NULL CHECK (char_length(name_input) BETWEEN 1 AND 100),
  -- Resolved active linemate, when there's exactly one match. Null means the
  -- admin needs to clarify with the mate before issuing a PIN.
  linemate_id uuid REFERENCES public.linemates(id) ON DELETE SET NULL,
  -- 'pending'   = waiting for admin
  -- 'pin_sent'  = admin issued PIN (out-of-band)
  -- 'cancelled' = admin dismissed
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'pin_sent', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  handled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  handled_at timestamptz
);

CREATE INDEX login_requests_status_created_idx
  ON public.login_requests (status, created_at DESC);

ALTER TABLE public.login_requests ENABLE ROW LEVEL SECURITY;

-- Only admin can read/write. Anonymous mate inserts go through RPC below.
CREATE POLICY login_requests_select_admin ON public.login_requests
  FOR SELECT USING (auth_role() = 'admin');

CREATE POLICY login_requests_update_admin ON public.login_requests
  FOR UPDATE USING (auth_role() = 'admin');

-- No INSERT policy for clients: all writes from the mate flow are funnelled
-- through the request_login() RPC which is SECURITY DEFINER.

-- ---------------------------------------------------------------------------
-- request_login: anonymous-callable RPC. Resolves name to an active linemate
-- (if exactly one match) and inserts a login_request. Returns the request id
-- and a coarse status code for the UI.
--
-- Returns JSON { id, resolved } where resolved is one of:
--   'matched'    : exactly one active linemate by name
--   'ambiguous'  : multiple active linemates with that name
--   'unknown'    : no active linemate with that name (still records the
--                  request so admin can see attempted access)
-- ---------------------------------------------------------------------------
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

  SELECT count(*), max(id) INTO v_match_count, v_linemate_id
  FROM public.linemates
  WHERE name = v_trimmed AND status = 'active';

  IF v_match_count = 1 THEN
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

-- Allow anonymous callers to invoke the RPC. They never see linemates rows.
GRANT EXECUTE ON FUNCTION public.request_login(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- resolve_linemate_for_login: given a name, return the matching active
-- linemate's email when there is exactly one match. Used during the actual
-- name + PIN login submission to look up which auth account to authenticate
-- against. SECURITY DEFINER so it bypasses RLS on linemates, but only ever
-- exposes the email when there's an unambiguous match.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_linemate_for_login(p_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_match_count int;
  v_trimmed text;
BEGIN
  v_trimmed := btrim(coalesce(p_name, ''));
  IF char_length(v_trimmed) = 0 OR char_length(v_trimmed) > 100 THEN
    RETURN NULL;
  END IF;

  SELECT count(*) INTO v_match_count
  FROM public.linemates
  WHERE name = v_trimmed AND status = 'active';

  IF v_match_count <> 1 THEN
    RETURN NULL;
  END IF;

  SELECT email INTO v_email
  FROM public.linemates
  WHERE name = v_trimmed AND status = 'active'
  LIMIT 1;

  RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_linemate_for_login(text) TO anon, authenticated;
