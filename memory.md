# 작업 메모리 (세션 핸드오프)

마지막 갱신: 2026-04-27 (메이트 PIN 로그인 추가 후)

이 문서는 새 세션에서 컨텍스트를 빠르게 복원하기 위한 핵심 사실 모음입니다. 코드는 git 에 있고, 운영 비밀은 `.env.local` 에 있습니다.

---

## 진행 상태 한 줄

Week 1 (인증 골격) + Week 3 (관리자 콘솔) 완료, 프로덕션 배포 완료. **Week 2 (라인메이트 모바일) 미착수**.

---

## 운영 환경

| 항목 | 값 |
| --- | --- |
| Production URL | https://linemate-app-ten.vercel.app |
| GitHub | https://github.com/miclaain/linemate-app (private) |
| Vercel team | `team_WfwJM5vYALnx7rCpR1AlmDwZ` (annys-projects-a27c266d) |
| Vercel project | `linemate-app` |
| Supabase project ref | `quilgavywezdtvteptaq` (icn1 / Seoul) |
| Marketplace integration | `icfg_eZepoijK0z0xDrR5N1EIn5uz` |
| Git author (이 repo만) | 김연미 \<bfzymy1004@gmail.com\> |

Supabase 대시보드는 Vercel Marketplace SSO 로만 접근 가능: `vercel integration open supabase supabase-copper-lighthouse`.

---

## 관리자 계정

- `mic@laain.kr` (auth.users id `8a2e971d-cfa3-4c0a-9d8f-95e07cdd0aed`) → `app_metadata.role = "admin"` 부여 완료
- 비밀번호: `793207` (service_role 로 직접 설정. 변경 시 아래 generateLink 스크립트의 `updateUserById` 패턴 동일)
- linemates 테이블에는 행 없음(admin 은 라인메이트가 아님). 콜백은 admin role 감지 시 linemates 행 생성을 건너뜀.

**로그인 흐름 (권장 — 비밀번호/PIN)**: `/auth/login` 기본 모드가 비밀번호. 이메일 + 비밀번호(admin) 또는 PIN(메이트) 입력 → `signInWithPassword` 가 클라이언트에서 세션 쿠키 설정 → `window.location.assign(next)` 로 풀 리로드 → 미들웨어가 role 감지 → admin 은 `/admin`, 메이트는 `/`.

**로그인 흐름 (대안 — 매직링크)**: 토글 "이메일 링크로 로그인" → 매직링크 받기 → 클릭하면 `/auth/callback?code=...` → 콜백이 linemates 행 upsert (admin 은 건너뜀).

**Supabase 기본 SMTP 레이트리밋**: 같은 메일에 시간당 ~4회만 가능. 한도 걸리면 service_role 로 매직링크 직접 생성:

```bash
cd linemate-app && export SR=$(grep ^SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d'"' -f2) && bun -e "
import { createClient } from '@supabase/supabase-js';
const sb = createClient('https://quilgavywezdtvteptaq.supabase.co', process.env.SR, { auth: { autoRefreshToken: false, persistSession: false } });
const { data, error } = await sb.auth.admin.generateLink({
  type: 'magiclink',
  email: 'mic@laain.kr',
  options: { redirectTo: 'https://linemate-app-ten.vercel.app/auth/callback?next=/admin' }
});
if (error) { console.error(error); process.exit(1); }
console.log(data.properties.action_link);
"
```

---

## 스택

- Next.js 16.2.4 (App Router, Turbopack)
- React 19.2.4 / TypeScript 5.9
- Tailwind CSS 4 (`@tailwindcss/postcss`)
- `@supabase/ssr` 0.10.2 + `@supabase/supabase-js` 2.104.1 (SSR 쿠키 바인딩)
- Bun 1.3.13 (런타임 + dev 명령)
- 배포: Vercel + Supabase Marketplace 통합 (env 자동 주입)

`tsconfig.json` paths: `@/*` → `./*`.

---

## 디렉토리 구조 (현재 시점)

```
linemate-app/
├── app/
│   ├── layout.tsx, globals.css, page.tsx (admin 자동 리다이렉트)
│   ├── auth/
│   │   ├── login/                      # PIN/비밀번호 (기본) + 매직링크 토글, Suspense + force-dynamic
│   │   ├── callback/route.ts           # 코드 교환 + linemates upsert (admin 건너뜀)
│   │   └── signout/route.ts
│   ├── signup/pending/page.tsx
│   └── admin/                          # ★ Week 3 ★
│       ├── layout.tsx                  # requireAdmin + 사이드바
│       ├── page.tsx                    # 대시보드
│       ├── linemates/
│       │   ├── page.tsx                # 탭별 목록 (신청대기/활성/비활성/전체)
│       │   └── [id]/page.tsx + actions.ts  # 승인(+PIN 발급)/거절/비활성/프로필/PIN 재발급
│       ├── projects/
│       │   ├── page.tsx, actions.ts    # 목록 + 생성/수정 액션
│       │   ├── new/page.tsx
│       │   └── [id]/page.tsx           # 상세 + 참여 내역
│       ├── participations/
│       │   ├── page.tsx                # 필터 (status/월/프로젝트/라인메이트)
│       │   └── [id]/page.tsx + actions.ts  # 승인/거절/단가 보정 (locked 시 readonly)
│       └── settlements/
│           ├── page.tsx                # 이번달 draft + 마감 + 과거 기록
│           ├── actions.ts              # finalizeMonth (RPC), markExported
│           └── [ym]/
│               ├── page.tsx            # 월 상세
│               └── export/route.ts     # CSV (UTF-8 BOM + CRLF)
├── components/
│   └── admin/
│       ├── nav.tsx                     # client, usePathname
│       ├── status-badge.tsx            # 색상 매핑 + 한글 라벨
│       └── project-form.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts, server.ts        # NEXT_PUBLIC anon 키 사용
│   │   ├── admin.ts                    # service_role 클라이언트 + generatePin() — admin 액션에서만
│   │   └── middleware.ts               # 세션 갱신 + linemates.status='active' OR admin gate
│   └── admin/
│       ├── guard.ts                    # requireAdmin() — 모든 /admin/* + 서버 액션 입구
│       └── format.ts                   # fmtKRW, fmtDate, currentYearMonth, recentYearMonths
├── middleware.ts                       # matcher: 정적 자산 제외
├── supabase/
│   ├── config.toml                     # site_url + redirect URLs (production + preview wildcard)
│   └── migrations/20260427120000_initial_schema.sql
└── .env.local                          # NEXT_PUBLIC_SUPABASE_URL/ANON_KEY, POSTGRES_URL_*, SUPABASE_SERVICE_ROLE_KEY
```

---

## 데이터 모델 핵심

4 테이블 + RLS + RPC 1개 + BEFORE 트리거 1개. 자세한 정의는 `supabase/migrations/20260427120000_initial_schema.sql`.

- **linemates** — id PK = auth.users.id. status: pending/active/inactive. role 은 여기 아니라 `auth.users.app_metadata.role`.
- **projects** — `default_unit_price` 가 참여 단가의 폴백.
- **participations** — `(linemate_id, project_id, date)` UNIQUE. `unit_price` NULL 이면 project 기본단가 적용. `locked` BOOLEAN — 마감 시 TRUE 로 잠김.
- **settlements** — 월별 라인메이트 합계. **`finalize_month` RPC 로만 INSERT 가능**. `(year_month, linemate_id)` UNIQUE.

**3중 마감 방어**:
1. RLS 정책 `participations_update_admin` USING `locked = FALSE`
2. BEFORE UPDATE/DELETE 트리거 `prevent_locked_participation_change`
3. `finalize_month` RPC 가 SECURITY DEFINER + JWT role 재검증 + idempotency (이미 마감된 월 거부)

**RLS 자체 검증 헬퍼**: `auth_role()` SQL 함수가 JWT app_metadata.role 추출.

---

## Week 3 관리자 콘솔 — 무엇이 가능한가

대시보드 (`/admin`)
- 가입 신청 / 참여 승인 대기 / 활성 라인메이트 수 카드 (액션 필요 항목은 강조)
- 이번 달 정산 합계 (마감 전이면 실시간 SUM, 후면 settlements 합계)
- 빠른 이동 (새 프로젝트, 프로젝트 목록 등)

라인메이트 (`/admin/linemates`)
- 탭: 신청대기(기본) / 활성 / 비활성 / 전체
- 상세 페이지: 승인 (활성화) / 거절 또는 비활성화 (status=inactive) / 프로필 편집 (이름·연락처·기본 역할) / 최근 참여 20건
- **PIN 발급/재발급**: 승인 시 6자리 PIN 자동 생성, 활성 메이트는 "PIN 재발급" 버튼. PIN 은 발급 직후 화면에 1회 표시 (URL flash param). 메이트가 분실하면 admin 이 재발급. 카톡 등으로 직접 전달.

프로젝트 (`/admin/projects`)
- CRUD + 프로젝트별 참여 내역 50건

참여 내역 (`/admin/participations`)
- 필터: status (탭), 월, 프로젝트, 라인메이트
- 상세: 승인 / 거절 (사유 필수) / 단가·시간·역할·날짜 편집
- `locked=true` 면 폼 disabled + 안내 배너

정산 (`/admin/settlements`)
- 이번 달 진행: 라인메이트별 예상 합계 + 미처리 대기 건수 경고 + 마감 버튼
- 월별 기록 표 (최근 6개월 + 마감된 모든 월)
- `/admin/settlements/[ym]`: 마감 후 라인메이트별 확정 합계, 참여 내역 상세, **CSV 다운로드** (`/admin/settlements/[ym]/export`), 송금 완료 표시

CSV: UTF-8 BOM + CRLF, 컬럼 = 라인메이트 / 이메일 / 합계.

---

## 결정/주의 사항 (놓치면 곤란)

1. **PostgREST 관계 타입 캐스트**: 조인된 to-one 관계 (`projects(name, default_unit_price)` 등) 는 TS 가 배열로 추론하지만 런타임은 객체. 모든 조인 쿼리 결과는 `as unknown as Array<...>` 로 캐스트.
2. **Server Component 에서 `force-dynamic` 필수**: `requireAdmin()` 호출하는 layout 자체에 `export const dynamic = "force-dynamic"`. 자식 페이지는 자동 상속.
3. **Server Actions 의 redirect**: `redirect()` 는 throw 처럼 동작하므로 try/catch 로 감싸지 말 것.
4. **Vercel git 작성자 정책**: Vercel 팀 멤버 이메일이 git author 여야 빌드 통과. 이 repo 의 git author 는 `bfzymy1004@gmail.com` 으로 고정.
5. **Next.js 16 의 "middleware → proxy" 경고**: 현재 `middleware.ts` 가 작동 중. 16.2.4 에서는 deprecation warning 만 뜸. 향후 마이그레이션 대상.
6. **Supabase JWT role 반영 시점**: DB 에서 `app_metadata.role` 을 바꿔도 **다음 토큰 발급 시** 반영됨. 기존 세션은 로그아웃 후 재로그인 필요.
7. **콜백의 admin 분기**: `app/auth/callback/route.ts` 에서 `role==='admin'` 이면 linemates 행을 만들지 않고 곧장 `next` 로 보냄.

---

## 미완료 / 다음 작업 후보

### Week 2 (다음 우선순위) — 라인메이트 모바일

`/` 가 현재 admin 만 `/admin` 으로 리다이렉트하고, 라인메이트(active)는 임시 안내만 표시. Week 2 에서 이 자리를 채워야 함.

화면:
- `/mate` (또는 `/`) — 모바일 홈: 내 정산 요약, 최근 참여, "+ 참여 등록" CTA
- `/mate/participations/new` — 참여 등록 폼 (프로젝트 선택, 날짜, 역할 [기본값=role_default], 시간, 단가는 선택)
- `/mate/participations` — 내 참여 이력 (status 별 / 월별)
- `/mate/settlements` — 내 월별 정산 (마감된 것 + 이번 달 draft)

서버 액션은 RLS `participations_insert_self` (status='pending', linemate_id=auth.uid(), linemates.status='active' 필요) 정책에 맞춰 INSERT.

모바일 우선이라 layout.tsx 별도, 하단 탭바 패턴 권장.

**메이트 로그인 = PIN**: 가입승인 시 자동 발급된 6자리 PIN 으로 `/auth/login` 비밀번호 모드에서 로그인. 매직링크 흐름은 fallback. 따라서 `/mate` 진입까지는 별도 인증 작업 불필요.

### Week 4 (마무리)

- **Resend / SendGrid 등 운영 SMTP** 를 Supabase Auth 에 붙여 매직링크 레이트리밋 해제
- **mate.lineedu.kr 커스텀 도메인** Vercel + Supabase redirect URL 등록
- ~~`SUPABASE_SERVICE_ROLE_KEY` 가 Vercel production env 에 들어가 있는지 점검~~ (Production/Preview/Development 모두 등록 완료. 사용처: `lib/supabase/admin.ts` — admin 액션에서 PIN 발급에 사용. requireAdmin() 게이트 뒤에서만 import 보장)
- middleware → proxy 마이그레이션
- 디자인 정리 (관리자 콘솔은 기능 우선으로 만들었음, Tailwind 4 토큰 정리 + ko 폰트)
- E2E 시나리오 한 번 돌리기 (가입 → 승인 → 참여 등록 → 승인 → 마감 → CSV)

### 잡일

- 콜백 중 매직링크 만료(`otp_expired`) 시 사용자 안내는 1ddcd1c 에서 처리. hash fragment 의 다른 코드도 future-proof 하려면 `lib/auth/error.ts` 같은 곳으로 추출 고려.
- 관리자 페이지 디자인은 데스크톱 가정. 모바일 대응은 우선순위 낮음.
- finalize_month 결과(어떤 라인메이트가 얼마인지)를 actions.ts 에서 받아서 토스트로 보여주면 UX 개선 (현재는 redirect 후 settlements 페이지에서 확인).

---

## 자주 쓰는 명령

```bash
# 로컬 개발
cd "C:/Users/USER/Documents/라인랩/2026/linemate-app"
bun run dev          # Next dev (Turbopack)
bun run build        # production 빌드 (TypeScript 타입체크 포함)

# 배포
bunx vercel --prod --yes

# Supabase 마이그레이션 적용
bun supabase migration list --db-url "$POSTGRES_URL_NON_POOLING"
bun supabase db push --db-url "$POSTGRES_URL_NON_POOLING"

# Auth admin (service_role 직접 사용)
export SR=$(grep ^SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d'"' -f2)
bun -e "import { createClient } from '@supabase/supabase-js'; ..."
```

---

## 최근 커밋 스택 (참고)

```
65197ee feat(auth): admin-issued 6-digit PIN for mate login
3cb93a5 docs: update memory.md for password login
0e787d4 feat(auth): add password login mode for admin
338483f docs: add memory.md for cross-session handoff
1ddcd1c fix(auth): surface OTP-expired error on login page
8ae5f9d feat(admin): Week 3 관리자 콘솔 (대시보드/라인메이트/프로젝트/참여/정산)
94fe9f1 fix(auth): skip linemates row creation for admin users
2ebf79e chore(auth): set production site_url + redirect URLs in config.toml
47b8bc2 chore: trigger Vercel deploy with team-eligible git author
0887c84 fix(auth): force /auth/login dynamic to satisfy Vercel build adapter
60ecb59 fix(auth): wrap LoginForm in Suspense for prerender
366e526 feat(auth): magic-link login + middleware gate (Week 1)
3042f09 chore: add .vercel and .env*.local to gitignore
1642d87 chore: initial scaffold for linemate-app (Week 1)
```
