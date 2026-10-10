import { Coins, FileText, KeyRound, LayoutGrid, LayoutPanelTop, Palette, PlugZap, Shield, Sparkles, Tags, User, UsersRound, Zap, type LucideIcon } from 'lucide-react';
import { hasMinRole, type AccountRole } from '@/lib/auth/roles';

export const SETTINGS_SECTIONS = ['overview', 'general', 'profile', 'security', 'appearance', 'whatsapp', 'templates', 'quick-replies', 'fields', 'deals', 'roles', 'members', 'api', 'new-features'] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];
export const DEFAULT_SECTION: SettingsSection = 'overview';

export interface SectionMeta {
  id: SettingsSection;
  label: string;
  icon: LucideIcon;
  group: 'main' | 'account' | 'operation' | 'messaging' | 'crm' | 'system';
  minRole?: AccountRole;
}

export const SECTION_META: Record<SettingsSection, SectionMeta> = {
  overview: { id: 'overview', label: 'Visão geral', icon: LayoutGrid, group: 'main' },
  general: { id: 'general', label: 'Loja', icon: LayoutPanelTop, group: 'main', minRole: 'admin' },
  profile: { id: 'profile', label: 'Perfil', icon: User, group: 'account' },
  security: { id: 'security', label: 'Acesso e segurança', icon: Shield, group: 'account' },
  appearance: { id: 'appearance', label: 'Aparência', icon: Palette, group: 'system' },
  whatsapp: { id: 'whatsapp', label: 'WhatsApp', icon: PlugZap, group: 'messaging', minRole: 'admin' },
  templates: { id: 'templates', label: 'Modelos de mensagem', icon: FileText, group: 'messaging', minRole: 'admin' },
  'quick-replies': { id: 'quick-replies', label: 'Respostas rápidas', icon: Zap, group: 'messaging', minRole: 'agent' },
  fields: { id: 'fields', label: 'Campos e etiquetas', icon: Tags, group: 'crm', minRole: 'admin' },
  deals: { id: 'deals', label: 'Vendas e moeda', icon: Coins, group: 'crm', minRole: 'admin' },
  roles: { id: 'roles', label: 'Funções e acessos', icon: Shield, group: 'operation', minRole: 'admin' },
  members: { id: 'members', label: 'Equipa', icon: UsersRound, group: 'operation', minRole: 'admin' },
  api: { id: 'api', label: 'Chaves API', icon: KeyRound, group: 'system', minRole: 'admin' },
  'new-features': { id: 'new-features', label: 'Novas funcionalidades', icon: Sparkles, group: 'system', minRole: 'owner' },
};

export const RAIL_GROUPS: { group: SectionMeta['group'] }[] = [
  { group: 'main' }, { group: 'account' }, { group: 'operation' }, { group: 'messaging' }, { group: 'crm' }, { group: 'system' },
];

function isSection(value: string | null): value is SettingsSection {
  return !!value && (SETTINGS_SECTIONS as readonly string[]).includes(value);
}
export function resolveSection(raw: string | null): SettingsSection {
  if (raw === 'tags' || raw === 'custom-fields') return 'fields';
  return isSection(raw) ? raw : DEFAULT_SECTION;
}
export function canAccessSettingsSection(role: AccountRole | null | undefined, section: SettingsSection) {
  const minRole = SECTION_META[section].minRole;
  return !minRole || (!!role && hasMinRole(role, minRole));
}
export function getVisibleSettingsSections(role: AccountRole | null | undefined) {
  return SETTINGS_SECTIONS.filter((section) => canAccessSettingsSection(role, section));
}
export function resolveAllowedSection(raw: string | null, role: AccountRole | null | undefined): SettingsSection {
  const requested = resolveSection(raw);
  if (canAccessSettingsSection(role, requested)) return requested;
  return getVisibleSettingsSections(role)[0] ?? DEFAULT_SECTION;
}
