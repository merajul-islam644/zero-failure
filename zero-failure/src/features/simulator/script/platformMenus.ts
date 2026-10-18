// Per-platform menus that ring a planet when it is clicked on the canvas.
// Entries are recursive: an item with `children` opens its submenu as a
// mini-planet ring circling the opened item, one nesting level up in
// paint order (see PlanetMenuLayer). Authored from the real consoles'
// navigations: the OS sun carries the OS console's own sidebar, and every
// planet mirrors its product's sidebar — IAM alone has none (the real
// IAM console adds no navigation of its own, so its pick shows the
// "no menu planets yet" empty state).
//
// Every level also carries `speech` — the words its console speaks when
// it opens (see menuLevelWords), in the planet's own cast voice.

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
import { CAST_BY_ID } from "./cast";

export interface PlatformMenuItem {
  label: string;
  icon: LucideIcon;
  /** The words the level says when its console opens — a grounded
   *  one-liner about the real console section. */
  speech?: string;
  children?: PlatformMenuItem[];
}

export const PLATFORM_MENUS: Partial<Record<PlatformId, PlatformMenuItem[]>> = {
  os: [
    { label: "Overview", icon: Gauge, speech: "The OS console at a glance — services, health and quick numbers." },
    {
      label: "Secrets & Configs",
      icon: KeyRound,
      speech: "Every secret and switch this tenant carries.",
      children: [
        { label: "Secret", icon: KeySquare, speech: "Tenant secrets — encrypted at rest, injected into services." },
        { label: "My Services", icon: Blocks, speech: "The services registered under this tenant." },
        { label: "OIDC", icon: Fingerprint, speech: "OpenID Connect clients this tenant signs in with." },
        { label: "Client Credentials", icon: BadgeCheck, speech: "Machine credentials for server-to-server calls." },
        { label: "Identity Provider", icon: UserCheck, speech: "The hosted identity provider's own settings." },
        { label: "External IdP", icon: Globe, speech: "External identity providers, federated in." },
        { label: "Captcha", icon: Puzzle, speech: "Human-verification keys for public forms." },
        { label: "MFA", icon: Smartphone, speech: "Multi-factor enrollment and policy." },
        { label: "Email", icon: AtSign, speech: "The tenant's outgoing email configuration." },
        { label: "Notification", icon: Bell, speech: "Notification channels and their routing." },
        { label: "Storage", icon: HardDrive, speech: "Object storage wired to this tenant." },
        { label: "Data Gateway", icon: Database, speech: "The schemas this tenant serves through the gateway." },
        { label: "Integrations", icon: Plug, speech: "Third-party integrations and their keys." }
      ]
    },
    { label: "Email Management", icon: Mail, speech: "Templates and delivery for every outbound mail." },
    {
      label: "Identity & Access",
      icon: ShieldCheck,
      speech: "The IAM console — users, organizations and their rights.",
      children: [
        { label: "Settings", icon: Settings, speech: "Tenant-wide IAM policy settings." },
        { label: "Users", icon: Users, speech: "Every user account in the tenant." },
        { label: "Organizations", icon: Building2, speech: "The organization tree and its membership." },
        { label: "Roles", icon: UserCog, speech: "Roles that bundle permissions." },
        { label: "Permissions", icon: Lock, speech: "The granular rights every role is built from." },
        { label: "One-Click Signup", icon: MousePointerClick, speech: "Self-service signup configuration." }
      ]
    },
    {
      label: "Logs & Traces",
      icon: ScrollText,
      speech: "Everything the tenant recorded — searchable.",
      children: [
        { label: "Usage", icon: Activity, speech: "Consumption counters across the platform." },
        { label: "Tracing", icon: Route, speech: "End-to-end request traces." },
        { label: "Logs", icon: FileText, speech: "Raw application logs." }
      ]
    }
  ],
  "data-gateway": [
    { label: "Overview", icon: Gauge, speech: "The data gateway at a glance." },
    { label: "Data Gateway", icon: Database, speech: "Schemas and collections — the tenant's structured data." },
    { label: "Storage", icon: HardDrive, speech: "Files and blobs the gateway fronts." }
  ],
  localization: [
    { label: "Overview", icon: Gauge, speech: "Localization at a glance." },
    { label: "Translations", icon: Languages, speech: "Every key and its translations, language by language." },
    { label: "Modules", icon: LayoutGrid, speech: "Feature modules, grouped for translation." },
    { label: "Glossary", icon: BookOpen, speech: "Shared terms — translated once, reused everywhere." },
    { label: "Configuration", icon: Settings, speech: "Enabled languages and fallback rules." },
    { label: "Extension Guides", icon: FileText, speech: "Guides for extending the localization setup." },
    { label: "WordPress Plugin Guide", icon: Puzzle, speech: "Connecting the WordPress translation plugin." }
  ],
  release: [
    { label: "Overview", icon: Gauge, speech: "The release pipeline at a glance." },
    { label: "Deployment", icon: Rocket, speech: "Environments, releases and rollbacks." }
  ],
  logic: [
    { label: "Overview", icon: Gauge, speech: "The logic console at a glance." },
    { label: "Schedules", icon: CalendarClock, speech: "Timed jobs on a calendar." },
    { label: "Workflow", icon: Workflow, speech: "Event-driven workflows across the tenant." },
    { label: "Functions", icon: FunctionSquare, speech: "Serverless functions, written in code." },
    { label: "Proxy", icon: Shuffle, speech: "Proxy routes in front of external APIs." }
  ],
  // The Studio planet (display name) still carries the "storage" id —
  // its menu mirrors studio.seliseblocks.com's sidebar.
  storage: [
    { label: "Overview", icon: Gauge, speech: "Studio at a glance." },
    {
      label: "Code",
      icon: Code2,
      speech: "The low-code builder — apps and workspace settings.",
      children: [
        { label: "Apps", icon: AppWindow, speech: "Every app built in Studio." },
        { label: "Settings", icon: Settings, speech: "Studio workspace settings." }
      ]
    },
    {
      label: "Insights",
      icon: TrendingUp,
      speech: "Analytics over the tenant's data.",
      children: [
        { label: "Data sources", icon: Database, speech: "Connected data sources." },
        { label: "Questions", icon: HelpCircle, speech: "Ask-the-data queries." },
        { label: "Dashboards", icon: LayoutDashboard, speech: "Live dashboards." },
        { label: "Reports", icon: FileBarChart, speech: "Scheduled and ad-hoc reports." },
        { label: "Skills", icon: Sparkles, speech: "Reusable insight skills." }
      ]
    }
  ],
  // The AI Agent planet mirrors agents.seliseblocks.com's sidebar.
  "ai-agent": [
    { label: "Overview", icon: Gauge, speech: "The agent console at a glance." },
    { label: "Agents", icon: Bot, speech: "Every agent and the instructions it follows." },
    { label: "Knowledge Base", icon: Library, speech: "Documents the agents read from." },
    { label: "Tools", icon: Wrench, speech: "Tools the agents may call." },
    { label: "Models", icon: Cpu, speech: "Language models on offer." },
    { label: "MCP", icon: Cable, speech: "Model Context Protocol endpoints." },
    { label: "Connector", icon: Link2, speech: "Connectors into external systems." },
    { label: "Skills", icon: Zap, speech: "Packaged capabilities agents can learn." },
    { label: "Prompts", icon: MessageSquareText, speech: "Prompt templates and playgrounds." },
    { label: "Integrations", icon: Plug, speech: "Third-party integrations." },
    { label: "Usage", icon: Activity, speech: "Token and request counters." },
    { label: "Usage Config", icon: SlidersHorizontal, speech: "Budgets and limits per agent." }
  ],
  // The Utilities planet mirrors utilities.seliseblocks.com's sidebar.
  utilities: [
    { label: "Overview", icon: Gauge, speech: "Utilities at a glance." },
    {
      label: "Payments",
      icon: CreditCard,
      speech: "One-off payments and the providers behind them.",
      children: [
        { label: "Create Payment", icon: CirclePlus, speech: "Charge a card or wallet once." },
        { label: "Payment List", icon: ListChecks, speech: "Every payment, with its state." },
        { label: "Saved Cards", icon: Wallet, speech: "Tokenized cards kept on file." },
        { label: "Payment Providers", icon: Landmark, speech: "Payment gateways wired to the tenant." }
      ]
    },
    {
      label: "Subscriptions",
      icon: Repeat,
      speech: "Recurring billing, end to end.",
      children: [
        { label: "Plans", icon: Layers, speech: "The plans customers subscribe to." },
        { label: "Discounts", icon: Percent, speech: "Coupons and percentage cuts." },
        { label: "Invoices", icon: ReceiptText, speech: "Generated invoices and their states." },
        { label: "Billing profile", icon: User, speech: "The customer's billing identity." },
        { label: "Merchant profile", icon: Store, speech: "The merchant receiving the money." },
        { label: "Simulation", icon: FlaskConical, speech: "Sandbox runs that never charge." }
      ]
    },
    {
      label: "SMS",
      icon: MessageSquare,
      speech: "Text messaging — sends, templates, providers.",
      children: [
        { label: "Send SMS", icon: Send, speech: "Fire a text through the gateway." },
        { label: "Templates", icon: LayoutTemplate, speech: "Reusable message templates." },
        { label: "Provider settings", icon: Server, speech: "SMS provider credentials." }
      ]
    },
    { label: "Magic URL", icon: Wand2, speech: "Signed one-tap links for passwordless flows." }
  ],
  monitor: [
    { label: "Overview", icon: Gauge, speech: "Monitoring at a glance." },
    { label: "Monitor", icon: Activity, speech: "Live checks against every endpoint." },
    { label: "Repos", icon: GitBranch, speech: "The repositories this tenant watches." }
  ]
};

/** A menu trail currently fanned open: the host body plus the labels
 *  opened from its root menu downward — `[]` is just the root ring. */
export interface OpenPlanetMenu {
  planet: PlatformId;
  path: string[];
}

/** The words a walked level says when its console opens: at the body
 *  itself the planet's own name-and-role line, below it the level's
 *  authored line — or, where an author never wrote one, the level's
 *  own label so no console ever opens silent. Null when the trail
 *  misses the tree. */
export function menuLevelWords(planet: PlatformId, path: string[]): string | null {
  const character = CAST_BY_ID[planet];
  if (!character) return null;
  if (path.length === 0) return `${character.name} — ${character.role}.`;
  let level = PLATFORM_MENUS[planet];
  let subject: PlatformMenuItem | null = null;
  for (const label of path) {
    const item = level?.find((entry) => entry.label === label);
    if (!item) return null;
    subject = item;
    level = item.children;
  }
  if (!subject) return null;
  return subject.speech ?? `${subject.label}.`;
}
