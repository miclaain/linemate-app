-- Adds 보조 단가 to projects so the mate-facing UI can offer the
-- 메인/보조 role split (matches the reference workshop-settlement-app UX).
--
-- Existing data: default_unit_price is treated as the 메인 (main) rate.
-- sub_rate is nullable; mates without a sub rate just see no 보조 option.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS sub_rate integer
    CHECK (sub_rate IS NULL OR sub_rate >= 0);

COMMENT ON COLUMN public.projects.sub_rate
  IS '보조 역할 단가. NULL이면 보조 옵션 비활성화.';
