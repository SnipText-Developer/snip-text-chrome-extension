export const apiConfig = {
  newTemplateUrl: "http://localhost:3000/templates/new",
  // 템플릿 조회 API URL. 비어 있으면 로컬 템플릿을 사용합니다.
  templatesUrl: "http://localhost:8080/api/template",
  // 로컬 HTTP API가 실패했을 때 사용할 개발 대시보드. 배포 시 빈 문자열로 설정합니다.
  testDashboardOrigin: "http://localhost:3000",
};
