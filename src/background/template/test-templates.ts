import type { Template } from "../../core/data-types";

const initialDate = "1970-01-01T00:00:00.000Z";

export const testTemplates: Template[] = [
  {
    templateId: 1,
    title: "감사 인사",
    shortcut: "/감사",
    content: "안녕하세요. 도와주셔서 감사합니다. 좋은 하루 보내세요.",
    variables: [],
    lastUsedAt: initialDate,
    createdAt: initialDate,
    editedAt: initialDate,
  },
  {
    templateId: 2,
    title: "미팅 일정 제안",
    shortcut: "/일정",
    content: "안녕하세요. {{날짜}} {{시간}}에 미팅이 가능하실까요? 편하신 시간을 알려주세요.",
    variables: ["날짜", "시간"],
    lastUsedAt: initialDate,
    createdAt: initialDate,
    editedAt: initialDate,
  },
  {
    templateId: 3,
    title: "프로젝트 견적 안내",
    shortcut: "/견적",
    content: "{{고객명}}님, 요청하신 프로젝트의 예상 견적은 {{금액}}원입니다. 검토 후 회신 부탁드립니다.",
    variables: ["고객명", "금액"],
    lastUsedAt: initialDate,
    createdAt: initialDate,
    editedAt: initialDate,
  },
];
