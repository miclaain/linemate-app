# linemate-app

라인메이트 스케줄·정산 관리 시스템 (라인교육연구소 내부 도구)

## What it does

- **라인메이트 (모바일)**: 매직링크 로그인 → 참여 내역 등록 → 월별 누적 금액 확인
- **관리자 (데스크탑)**: 가입 승인, 참여 내역 검토(승인/거절), 월 마감, Excel 내보내기

## Tech Stack

| 영역 | 선택 |
| --- | --- |
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| 스타일 | Tailwind CSS 4 |
| Backend | Supabase (Postgres + Auth + RLS + Edge Functions) |
| Excel | ExcelJS |
| 배포 | Vercel (`mate.lineedu.kr`) |
| Runtime | Bun 1.3 |

## 개발 환경

```bash
bun install
bunx supabase start        # 로컬 Postgres + Studio
bun dev                    # http://localhost:3000
```

마이그레이션:

```bash
bunx supabase migration up
bunx supabase migration new <이름>
```

## 디렉토리 구조

```
linemate-app/
├── app/                    # Next.js App Router
├── components/             # 공용 UI
├── lib/
│   ├── supabase/          # 클라이언트 / 서버 / Edge
│   └── excel/             # ExcelJS 템플릿 빌더
├── supabase/
│   ├── migrations/        # SQL 마이그레이션
│   └── functions/         # Edge Functions (service_role 격리)
└── docs/
    ├── DESIGN.md          # 설계 도큐먼트 v4
    └── TEST-PLAN.md       # QA 시나리오
```

## 문서

- [docs/DESIGN.md](./docs/DESIGN.md) — 설계 도큐먼트 v4 (보안 8/10 반영)
- [docs/TEST-PLAN.md](./docs/TEST-PLAN.md) — QA 시나리오

## Roadmap (MVP 4주)

- **Week 1 (현재)**: Supabase 스키마 + RLS + 인증 골격
- **Week 2**: 라인메이트 모바일 플로우 (등록·이력·내정산)
- **Week 3**: 관리자 데스크탑 (승인 큐, 월 마감, Excel)
- **Week 4**: QA, 접근성, 배포

## 보안 주요 결정 (설계 v4)

- 인증: 매직링크 (라인메이트), 매직링크 + TOTP 2FA (관리자)
- 가입 게이트: 도메인 화이트리스트 + 관리자 승인 (`status='pending'`)
- 역할 저장: `auth.users.app_metadata.role` (사용자 변경 불가)
- 마감 잠금: 3중 방어 (RPC 트랜잭션 + `locked` 컬럼 + BEFORE 트리거)
- 관리자 2FA 필수 (Supabase MFA Enforcement)
- `service_role` 키: Edge Function에만, Vercel/클라이언트 노출 금지
- JWT 만료: 라인메이트 1h, 관리자 30m

## License

Internal — 라인교육연구소
