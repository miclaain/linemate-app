"use client";

import { useState } from "react";
import { fmtKRW } from "@/lib/admin/format";

type Role = "메인" | "보조";

export function ParticipationForm({
  projectId,
  defaultDate,
  mainRate,
  subRate,
  action,
}: {
  projectId: string;
  defaultDate: string;
  mainRate: number;
  subRate: number | null;
  action: (formData: FormData) => Promise<void>;
}) {
  const [role, setRole] = useState<Role>("메인");
  const [amount, setAmount] = useState<number>(mainRate);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(defaultDate);

  const defaultAmount = role === "메인" ? mainRate : (subRate ?? 0);
  const isModified = Number(amount) !== defaultAmount;
  const canSubmit =
    !!date && (!isModified || note.trim().length > 0);

  function chooseRole(next: Role) {
    setRole(next);
    setAmount(next === "메인" ? mainRate : (subRate ?? 0));
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="role" value={role} />

      {/* Date */}
      <div>
        <label className="mb-3 block text-xs font-black uppercase tracking-widest text-gray-500">
          참여 날짜
        </label>
        <input
          type="date"
          name="date"
          required
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3.5 text-base font-semibold transition-colors focus:border-teal-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900"
        />
      </div>

      {/* Role */}
      <div>
        <label className="mb-3 block text-xs font-black uppercase tracking-widest text-gray-500">
          역할 선택
        </label>
        <div
          className={`grid gap-3 ${subRate !== null ? "grid-cols-2" : "grid-cols-1"}`}
        >
          <RoleButton
            active={role === "메인"}
            label="메인"
            rate={mainRate}
            onClick={() => chooseRole("메인")}
          />
          {subRate !== null && (
            <RoleButton
              active={role === "보조"}
              label="보조"
              rate={subRate}
              onClick={() => chooseRole("보조")}
            />
          )}
        </div>
      </div>

      {/* Amount */}
      <div>
        <label className="mb-3 block text-xs font-black uppercase tracking-widest text-gray-500">
          정산 금액
        </label>
        <div className="relative">
          <input
            type="number"
            name="unit_price"
            required
            min="0"
            step="1"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3.5 pr-10 text-base font-bold tabular-nums transition-colors focus:border-teal-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900"
          />
          <span className="absolute right-4 top-4 text-sm font-medium text-gray-400">
            원
          </span>
        </div>
        {isModified && (
          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            ⚠ 기본 단가({fmtKRW(defaultAmount)})와 다릅니다.
            <br />
            아래 특이사항 란에 사유를 반드시 입력해주세요.
          </div>
        )}
      </div>

      {/* Note */}
      <div>
        <label className="mb-3 block text-xs font-black uppercase tracking-widest text-gray-500">
          특이사항
          {isModified && (
            <span className="ml-1 text-amber-500">* 필수</span>
          )}
        </label>
        <textarea
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={
            isModified
              ? "금액 수정 사유를 입력해주세요 (예: 장거리 교통비 추가)"
              : "특이사항이 있으면 입력해주세요 (선택)"
          }
          rows={3}
          className="w-full resize-none rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm transition-colors focus:border-teal-400 focus:outline-none dark:border-neutral-800 dark:bg-neutral-900"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 py-4 text-sm font-black text-white shadow-lg shadow-teal-100 transition-all hover:from-teal-600 hover:to-emerald-600 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
      >
        정산 제출하기
      </button>
    </form>
  );
}

function RoleButton({
  active,
  label,
  rate,
  onClick,
}: {
  active: boolean;
  label: string;
  rate: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border-2 py-4 text-sm font-bold transition-all duration-200 ${
        active
          ? "scale-105 border-teal-500 bg-teal-500 text-white shadow-lg shadow-teal-100"
          : "border-gray-200 bg-white text-gray-600 hover:border-teal-300 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
      }`}
    >
      <div className="text-base">{label}</div>
      <div
        className={`mt-1 text-xs font-semibold ${
          active ? "text-teal-100" : "text-gray-400"
        }`}
      >
        기본 {fmtKRW(rate)}
      </div>
    </button>
  );
}
