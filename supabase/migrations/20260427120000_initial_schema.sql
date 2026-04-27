-- =====================================================================
-- LineMate 스케줄·정산 관리 시스템 — 초기 스키마
-- =====================================================================
-- 설계 도큐먼트 v4 기준 (보안 8/10 반영)
-- 4 테이블 + RLS 정책 + finalize_month RPC + 마감 잠금 트리거
-- =====================================================================

-- ──────────────────────────────────────────────────────────────────────
-- 1. linemates: 라인메이트(파트너 퍼실리테이터) 본인 정보
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE linemates (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  phone        TEXT,
  email        TEXT NOT NULL UNIQUE,
  role_default TEXT,                                  -- 기본 역할 (입력 폼 기본값)
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'active', 'inactive')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at  TIMESTAMPTZ,
  approved_by  UUID REFERENCES auth.users(id)
);

COMMENT ON TABLE linemates IS '라인메이트 명단. id는 auth.users 1:1 매핑. role은 auth.users.app_metadata에 저장 (사용자 변경 불가).';
COMMENT ON COLUMN linemates.status IS 'pending=가입신청, active=승인됨, inactive=비활성';

-- ──────────────────────────────────────────────────────────────────────
-- 2. projects: 프로젝트(워크숍/출강) 마스터
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE projects (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  client              TEXT,                            -- 발주처
  period_start        DATE,
  period_end          DATE,
  default_unit_price  NUMERIC NOT NULL CHECK (default_unit_price >= 0),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN projects.default_unit_price IS '기본 단가. participations.unit_price가 NULL이면 이 값 사용.';

-- ──────────────────────────────────────────────────────────────────────
-- 3. participations: 라인메이트 참여 내역 (정산의 원자료)
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE participations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linemate_id   UUID NOT NULL REFERENCES linemates(id) ON DELETE RESTRICT,
  project_id    UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  date          DATE NOT NULL,
  role          TEXT,
  hours         NUMERIC CHECK (hours IS NULL OR hours > 0),
  unit_price    NUMERIC CHECK (unit_price IS NULL OR unit_price >= 0),  -- NULL이면 project.default_unit_price 사용
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected')),
  reject_reason TEXT,                                  -- 거절 시 사유 (라인메이트에게 그대로 전달)
  locked        BOOLEAN NOT NULL DEFAULT FALSE,        -- 마감 후 수정 잠금
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at   TIMESTAMPTZ,
  approved_by   UUID REFERENCES auth.users(id),
  UNIQUE (linemate_id, project_id, date)               -- 중복 제출 방지
);

COMMENT ON COLUMN participations.unit_price IS 'NULL이면 projects.default_unit_price 폴백. 관리자가 케이스별 보정 시에만 채움.';
COMMENT ON COLUMN participations.locked IS 'finalize_month 실행 시 TRUE. 트리거가 UPDATE/DELETE 차단.';

CREATE INDEX idx_participations_status         ON participations(status);
CREATE INDEX idx_participations_linemate_date  ON participations(linemate_id, date DESC);
CREATE INDEX idx_participations_project_status ON participations(project_id, status);

-- ──────────────────────────────────────────────────────────────────────
-- 4. settlements: 월별 정산 (finalize 시점에만 계산·저장)
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE settlements (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year_month    CHAR(7) NOT NULL CHECK (year_month ~ '^\d{4}-\d{2}$'),  -- '2026-04'
  linemate_id   UUID NOT NULL REFERENCES linemates(id) ON DELETE RESTRICT,
  total_amount  NUMERIC NOT NULL CHECK (total_amount >= 0),
  status        TEXT NOT NULL DEFAULT 'finalized'
                CHECK (status IN ('finalized')),       -- draft는 실시간 SUM, 저장 안 함
  finalized_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalized_by  UUID NOT NULL REFERENCES auth.users(id),
  exported_at   TIMESTAMPTZ,
  UNIQUE (year_month, linemate_id)                     -- 한 라인메이트는 월별 1개만
);

COMMENT ON TABLE settlements IS 'finalize_month RPC를 통해서만 INSERT. draft는 클라이언트에서 실시간 SUM으로 표시.';

CREATE INDEX idx_settlements_year_month ON settlements(year_month);
CREATE INDEX idx_settlements_linemate   ON settlements(linemate_id);

-- ──────────────────────────────────────────────────────────────────────
-- 마감 잠금 트리거 (3중 방어 중 1개)
-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prevent_locked_participation_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.locked = TRUE THEN
    RAISE EXCEPTION '마감된 월의 참여 내역은 수정 불가 (id=%, date=%)',
      OLD.id, to_char(OLD.date, 'YYYY-MM');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_locked_participation
  BEFORE UPDATE OR DELETE ON participations
  FOR EACH ROW EXECUTE FUNCTION prevent_locked_participation_change();

-- ──────────────────────────────────────────────────────────────────────
-- finalize_month RPC: 월 마감 (트랜잭션, 이중 마감 방지, 원자성)
-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION finalize_month(p_year_month CHAR(7))
RETURNS TABLE (linemate_id UUID, total_amount NUMERIC) AS $$
DECLARE
  v_actor_role TEXT;
  v_admin_id   UUID;
BEGIN
  -- 권한: 관리자만 (RPC SECURITY DEFINER이므로 클라이언트 role 명시 검증)
  v_actor_role := auth.jwt() -> 'app_metadata' ->> 'role';
  IF v_actor_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION '관리자만 월 마감 가능 (current role=%)', COALESCE(v_actor_role, 'none');
  END IF;
  v_admin_id := auth.uid();

  -- 이미 마감된 월 차단
  IF EXISTS (SELECT 1 FROM settlements WHERE year_month = p_year_month) THEN
    RAISE EXCEPTION '%월은 이미 마감되었습니다', p_year_month;
  END IF;

  -- 해당 월 approved participations에 대해 락 + 합산
  -- (FOR UPDATE로 동시 마감 시도 차단)
  WITH locked_rows AS (
    SELECT p.id, p.linemate_id,
           COALESCE(p.unit_price, pr.default_unit_price) AS effective_price
    FROM participations p
    JOIN projects pr ON pr.id = p.project_id
    WHERE p.status = 'approved'
      AND to_char(p.date, 'YYYY-MM') = p_year_month
    FOR UPDATE OF p
  ),
  totals AS (
    SELECT lr.linemate_id, SUM(lr.effective_price) AS total
    FROM locked_rows lr
    GROUP BY lr.linemate_id
  ),
  inserted AS (
    INSERT INTO settlements (year_month, linemate_id, total_amount, finalized_by)
    SELECT p_year_month, t.linemate_id, t.total, v_admin_id
    FROM totals t
    RETURNING settlements.linemate_id, settlements.total_amount
  )
  SELECT i.linemate_id, i.total_amount FROM inserted i;

  -- 해당 월 participations 모두 잠금
  UPDATE participations
  SET locked = TRUE
  WHERE status = 'approved'
    AND to_char(date, 'YYYY-MM') = p_year_month;

  RETURN QUERY
  SELECT s.linemate_id, s.total_amount
  FROM settlements s
  WHERE s.year_month = p_year_month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

REVOKE ALL ON FUNCTION finalize_month(CHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finalize_month(CHAR) TO authenticated;

COMMENT ON FUNCTION finalize_month IS '월 마감. SECURITY DEFINER + JWT role 검증. 호출자는 authenticated여야 하지만 함수 내부에서 admin role 재검증.';

-- ──────────────────────────────────────────────────────────────────────
-- RLS 정책 (설계 도큐먼트 v4 §보안.1)
-- ──────────────────────────────────────────────────────────────────────

-- Helper: JWT에서 role 추출
CREATE OR REPLACE FUNCTION auth_role()
RETURNS TEXT AS $$
  SELECT auth.jwt() -> 'app_metadata' ->> 'role'
$$ LANGUAGE SQL STABLE;

-- linemates ────────────────────────────────────────────────────────────
ALTER TABLE linemates ENABLE ROW LEVEL SECURITY;

CREATE POLICY linemates_select ON linemates FOR SELECT
  USING (
    id = auth.uid()
    OR auth_role() = 'admin'
  );

CREATE POLICY linemates_insert_self ON linemates FOR INSERT
  WITH CHECK (
    id = auth.uid()
    AND status = 'pending'
  );

CREATE POLICY linemates_update_admin ON linemates FOR UPDATE
  USING (auth_role() = 'admin');

-- participations ───────────────────────────────────────────────────────
ALTER TABLE participations ENABLE ROW LEVEL SECURITY;

CREATE POLICY participations_select ON participations FOR SELECT
  USING (
    linemate_id = auth.uid()
    OR auth_role() = 'admin'
  );

CREATE POLICY participations_insert_self ON participations FOR INSERT
  WITH CHECK (
    linemate_id = auth.uid()
    AND status = 'pending'
    AND locked = FALSE
    AND EXISTS (
      SELECT 1 FROM linemates
      WHERE id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY participations_update_admin ON participations FOR UPDATE
  USING (
    auth_role() = 'admin'
    AND locked = FALSE
  );

-- projects ─────────────────────────────────────────────────────────────
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_select ON projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM linemates
      WHERE id = auth.uid() AND status = 'active'
    )
    OR auth_role() = 'admin'
  );

CREATE POLICY projects_write_admin ON projects FOR ALL
  USING (auth_role() = 'admin');

-- settlements ──────────────────────────────────────────────────────────
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY settlements_select ON settlements FOR SELECT
  USING (
    linemate_id = auth.uid()
    OR auth_role() = 'admin'
  );

-- INSERT/UPDATE/DELETE는 finalize_month RPC를 통해서만 (정책 자체는 admin 허용)
CREATE POLICY settlements_write_admin ON settlements FOR ALL
  USING (auth_role() = 'admin');
