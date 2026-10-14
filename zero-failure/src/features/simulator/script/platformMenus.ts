// Per-platform menus that ring a planet when it is clicked on the canvas.
// Entries are recursive: an item with `children` opens its submenu as a
// mini-planet ring circling the opened item, one nesting level up in
// paint order (see PlanetMenuLayer). Authored from the real consoles'
// navigations: the OS sun carries the OS console's own sidebar, and every
// planet mirrors its product's sidebar — IAM alone has none (the real
// IAM console adds no navigation of its own, so its pick shows the
// "no menu planets yet" empty state).

import {
  Activity,
  AppWindow,
  AtSign,
  BadgeCheck,
  Bell,
  Blocks,
  BookOpen,
  Bot,
  Building2,
  CalendarClock,
  Cable,
  Code2,
  Cpu,
  CreditCard,
  CirclePlus,
  Database,
  FileBarChart,
  FileText,
  Fingerprint,
  FlaskConical,
  FunctionSquare,
  Gauge,
  GitBranch,
  Globe,
  HardDrive,
  HelpCircle,
  KeyRound,
  KeySquare,
  Languages,
  Landmark,
  Layers,
  LayoutGrid,
  LayoutDashboard,
  LayoutTemplate,
  Library,
  Link2,
  ListChecks,
  Lock,
  Mail,
  MessageSquare,
  MessageSquareText,
  MousePointerClick,
  Percent,
  Plug,
  Puzzle,
  ReceiptText,
  Repeat,
  Rocket,
  Route,
  ScrollText,
  Send,
  Server,
  Settings,
  ShieldCheck,
  Shuffle,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Store,
  TrendingUp,
  User,
  UserCheck,
  UserCog,
  Users,
  Wallet,
  Wand2,
  Workflow,
  Wrench,
  Zap,
  type LucideIcon
} from "lucide-react";
import type { PlatformId } from "../engine/types";

export interface PlatformMenuItem {
  label: string;
  icon: LucideIcon;
  children?: PlatformMenuItem[];
}

export const PLATFORM_MENUS: Partial<Record<PlatformId, PlatformMenuItem[]>> = {
  os: [
    { label: "Overview", icon: Gauge },
    {
      label: "Secrets & Configs",
      icon: KeyRound,
      children: [
        { label: "Secret", icon: KeySquare },
        { label: "My Services", icon: Blocks },
        { label: "OIDC", icon: Fingerprint },
        { label: "Client Credentials", icon: BadgeCheck },
        { label: "Identity Provider", icon: UserCheck },
        { label: "External IdP", icon: Globe },
        { label: "Captcha", icon: Puzzle },
        { label: "MFA", icon: Smartphone },
        { label: "Email", icon: AtSign },
        { label: "Notification", icon: Bell },
        { label: "Storage", icon: HardDrive },
        { label: "Data Gateway", icon: Database },
        { label: "Integrations", icon: Plug }
      ]
    },
    { label: "Email Management", icon: Mail },
    {
      label: "Identity & Access",
      icon: ShieldCheck,
      children: [
        { label: "Settings", icon: Settings },
        { label: "Users", icon: Users },
        { label: "Organizations", icon: Building2 },
        { label: "Roles", icon: UserCog },
        { label: "Permissions", icon: Lock },
        { label: "One-Click Signup", icon: MousePointerClick }
      ]
    },
    {
      label: "Logs & Traces",
      icon: ScrollText,
      children: [
        { label: "Usage", icon: Activity },
        { label: "Tracing", icon: Route },
        { label: "Logs", icon: FileText }
      ]
    }
  ],
  "data-gateway": [
    { label: "Overview", icon: Gauge },
    { label: "Data Gateway", icon: Database },
    { label: "Storage", icon: HardDrive }
  ],
  localization: [
    { label: "Overview", icon: Gauge },
    { label: "Translations", icon: Languages },
    { label: "Modules", icon: LayoutGrid },
    { label: "Glossary", icon: BookOpen },
    { label: "Configuration", icon: Settings },
    { label: "Extension Guides", icon: FileText },
    { label: "WordPress Plugin Guide", icon: Puzzle }
  ],
  release: [
    { label: "Overview", icon: Gauge },
    { label: "Deployment", icon: Rocket }
  ],
  logic: [
    { label: "Overview", icon: Gauge },
    { label: "Schedules", icon: CalendarClock },
    { label: "Workflow", icon: Workflow },
    { label: "Functions", icon: FunctionSquare },
    { label: "Proxy", icon: Shuffle }
  ],
  // The Studio planet (display name) still carries the "storage" id —
  // its menu mirrors studio.seliseblocks.com's sidebar.
  storage: [
    { label: "Overview", icon: Gauge },
    {
      label: "Code",
      icon: Code2,
      children: [
        { label: "Apps", icon: AppWindow },
        { label: "Settings", icon: Settings }
      ]
    },
    {
      label: "Insights",
      icon: TrendingUp,
      children: [
        { label: "Data sources", icon: Database },
        { label: "Questions", icon: HelpCircle },
        { label: "Dashboards", icon: LayoutDashboard },
        { label: "Reports", icon: FileBarChart },
        { label: "Skills", icon: Sparkles }
      ]
    }
  ],
  // The AI Agent planet mirrors agents.seliseblocks.com's sidebar.
  "ai-agent": [
    { label: "Overview", icon: Gauge },
    { label: "Agents", icon: Bot },
    { label: "Knowledge Base", icon: Library },
    { label: "Tools", icon: Wrench },
    { label: "Models", icon: Cpu },
    { label: "MCP", icon: Cable },
    { label: "Connector", icon: Link2 },
    { label: "Skills", icon: Zap },
    { label: "Prompts", icon: MessageSquareText },
    { label: "Integrations", icon: Plug },
    { label: "Usage", icon: Activity },
    { label: "Usage Config", icon: SlidersHorizontal }
  ],
  // The Utilities planet mirrors utilities.seliseblocks.com's sidebar.
  utilities: [
    { label: "Overview", icon: Gauge },
    {
      label: "Payments",
      icon: CreditCard,
      children: [
        { label: "Create Payment", icon: CirclePlus },
        { label: "Payment List", icon: ListChecks },
        { label: "Saved Cards", icon: Wallet },
        { label: "Payment Providers", icon: Landmark }
      ]
    },
    {
      label: "Subscriptions",
      icon: Repeat,
      children: [
        { label: "Plans", icon: Layers },
        { label: "Discounts", icon: Percent },
        { label: "Invoices", icon: ReceiptText },
        { label: "Billing profile", icon: User },
        { label: "Merchant profile", icon: Store },
        { label: "Simulation", icon: FlaskConical }
      ]
    },
    {
      label: "SMS",
      icon: MessageSquare,
      children: [
        { label: "Send SMS", icon: Send },
        { label: "Templates", icon: LayoutTemplate },
        { label: "Provider settings", icon: Server }
      ]
    },
    { label: "Magic URL", icon: Wand2 }
  ],
  monitor: [
    { label: "Overview", icon: Gauge },
    { label: "Monitor", icon: Activity },
    { label: "Repos", icon: GitBranch }
  ]
};

/** A menu trail currently fanned open: the host body plus the labels
 *  opened from its root menu downward — `[]` is just the root ring. */
export interface OpenPlanetMenu {
  planet: PlatformId;
  path: string[];
}
