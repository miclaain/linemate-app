import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { ProjectForm } from "@/components/admin/project-form";
import { createProject } from "../actions";

export default async function NewProjectPage() {
  await requireAdmin();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link
          href="/admin/projects"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← 프로젝트 목록
        </Link>
      </div>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">새 프로젝트</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          기본 단가는 참여 등록 시 단가 미지정 항목에 자동 적용됩니다.
        </p>
      </header>

      <ProjectForm action={createProject} submitLabel="생성" />
    </div>
  );
}
