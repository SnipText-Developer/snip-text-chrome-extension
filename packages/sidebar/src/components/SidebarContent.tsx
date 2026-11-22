import TemplateListPage from "./TemplateListPage";
import ToneCorrectionPage from "./ToneCorrectionPage";

interface SidebarContentProps {
  showToneCorrection: boolean;
  onNotify: (message: string) => void;
  onOpenToneCorrection: () => void;
  onShowTemplates: () => void;
  onLogout?: () => Promise<void>;
}

export default function SidebarContent({
  showToneCorrection,
  onNotify,
  onOpenToneCorrection,
  onShowTemplates,
  onLogout,
}: SidebarContentProps) {
  if (showToneCorrection) {
    return <ToneCorrectionPage onNotify={onNotify} onClose={onShowTemplates} />;
  }

  return (
    <TemplateListPage onNotify={onNotify} onOpenToneCorrection={onOpenToneCorrection} onLogout={onLogout} />
  );
}
