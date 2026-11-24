export const snipTextApiOrigin = "https://api.sniptext.kr";

export const apiConfig = {
  loginUrl: "http://localhost:3000/login",
  newTemplateUrl: "http://localhost:3000/templates/new",
  // 템플릿 조회 API URL. 비어 있으면 로컬 템플릿을 사용합니다.
  templatesUrl: `${snipTextApiOrigin}/api/v1/templates`,
};
