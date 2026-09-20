import {
  CalendarCheck,
  ChevronsUpDown,
  CircleHelp,
  ClipboardList,
  Code,
  Columns3,
  Compass,
  FileText,
  GitCommitVertical,
  Grid2x2,
  Heading,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  LayoutList,
  Link2,
  ListChecks,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  Minus,
  MousePointerClick,
  MoveVertical,
  Newspaper,
  Package,
  PanelLeft,
  PanelTop,
  Quote,
  Rows3,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
  Star,
  Table,
  Table2,
  TrendingUp,
  Type,
  UserPlus,
  Video,
  type LucideIcon,
} from "lucide-react";

/**
 * Icons for the element library and the canvas.
 *
 * Deliberately separate from `BUILDER_ICONS`, which is the *content* icon
 * picker an admin chooses from for a feature card — that set is travel
 * imagery (Plane, Hotel, Palmtree) and has no business offering "Columns3".
 *
 * Kept in the editor folder so these only load with the builder: the public
 * renderer needs the content icons, never these.
 *
 * Every name the registry uses must appear here, or that element shows a
 * generic placeholder and the library becomes a wall of identical tiles.
 * `lib/builder/__tests__/builder.test.ts` asserts the two stay in step.
 */
export const ELEMENT_ICONS: Record<string, LucideIcon> = {
  CalendarCheck,
  ChevronsUpDown,
  CircleHelp,
  ClipboardList,
  Code,
  Columns3,
  Compass,
  FileText,
  GitCommitVertical,
  Grid2x2,
  Heading,
  Image: ImageIcon,
  Images,
  LayoutGrid,
  LayoutList,
  Link2,
  ListChecks,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  Minus,
  MousePointerClick,
  MoveVertical,
  Newspaper,
  Package,
  PanelLeft,
  PanelTop,
  Quote,
  Rows3,
  Search,
  ShieldCheck,
  Sparkles,
  Square,
  Star,
  Table,
  Table2,
  TrendingUp,
  Type,
  UserPlus,
  Video,
};

export function getElementIcon(name: string | undefined): LucideIcon {
  return (name && ELEMENT_ICONS[name]) || Sparkles;
}
