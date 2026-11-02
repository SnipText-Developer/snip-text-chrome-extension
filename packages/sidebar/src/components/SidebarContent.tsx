import EditorStatusTestPanel from "./EditorStatusTestPanel";
import TemplateListPage from "./TemplateListPage";
import ToneCorrectionPage from "./ToneCorrectionPage";

interface SidebarContentProps {
  showToneCorrection: boolean;
  onNotify: (message: string) => void;
  onOpenToneCorrection: () => void;
  onShowTemplates: () => void;
}

export default function SidebarContent({
  showToneCorrection,
  onNotify,
  onOpenToneCorrection,
  onShowTemplates,
}: SidebarContentProps) {
  if (showToneCorrection) {
    return <ToneCorrectionPage onNotify={onNotify} onClose={onShowTemplates} />;
  }

  return (
    <>
      <TemplateListPage onNotify={onNotify} onOpenToneCorrection={onOpenToneCorrection} />
      <EditorStatusTestPanel />
    </>
  );
}
