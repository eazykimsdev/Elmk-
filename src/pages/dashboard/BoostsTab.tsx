import * as React from 'react';
import { ShopTab } from './ShopTab';
import type { DiscordGuild, WorkspaceBot, WorkspaceCustomizations } from '@/types';

export const BOOSTS_CATEGORY_TITLE = 'Shop';

export interface BoostsTabProps {
  currentGuildId: string;
  guild?: DiscordGuild | null;
  workspace?: WorkspaceBot | null;
  config?: WorkspaceCustomizations;
  serverName?: string;
  initialSubTab?: 'shop' | 'active' | 'premium';
  onNavigateTab?: (tab: string) => void;
  addToast?: (variant: 'success' | 'info' | 'warning' | 'error', title: string, body?: string) => void;
}

export function BoostsTab(props: BoostsTabProps) {
  const tab = props.initialSubTab === 'premium' ? 'premium' : props.initialSubTab === 'active' ? 'active' : 'boosts';
  return (
    <ShopTab
      currentGuildId={props.currentGuildId}
      guild={props.guild}
      workspace={props.workspace}
      config={props.config}
      serverName={props.serverName}
      initialTab={tab}
      onNavigateTab={props.onNavigateTab}
      addToast={props.addToast}
    />
  );
}

export default BoostsTab;
