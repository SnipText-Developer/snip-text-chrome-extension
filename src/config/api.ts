export const snipTextOrigin = "https://sniptext.kr";
export const snipTextApiOrigin = "https://api.sniptext.kr";

export const apiConfig = {
  loginUrl: `${snipTextOrigin}/login`,
  newTemplateUrl: `${snipTextOrigin}/templates/new`,
  // 템플릿 조회 API URL. 비어 있으면 로컬 템플릿을 사용합니다.
  templatesUrl: `${snipTextApiOrigin}/api/v1/templates`,
};
