-- Mate-supplied note on participation submission. UI requires this when the
-- entered amount differs from the project default (matches the reference
-- app's "특이사항" pattern).

ALTER TABLE public.participations
  ADD COLUMN IF NOT EXISTS notes text;

COMMENT ON COLUMN public.participations.notes
  IS '메이트가 정산 등록 시 입력한 특이사항. 단가 수정 시 사유 필수.';
