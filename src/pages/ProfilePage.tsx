import React, { useEffect, useState } from 'react';
import { Button, Icon, Panel, TextInput } from '../components';
import type { WorkspaceProfile } from '../lib/workspace';

type Props = { profile: WorkspaceProfile; onSave: (profile: WorkspaceProfile) => Promise<void> };

export const ProfilePage: React.FC<Props> = ({ profile, onSave }) => {
  const [draft, setDraft] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setDraft(profile), [profile]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await onSave(draft);
      setSaved(true);
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const initials = draft.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'MF';

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-5 py-7 lg:px-8 lg:py-9">
      <header>
        <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-dim uppercase">Workspace</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Profile</h1>
        <p className="mt-2 text-base text-dim">Personalize the name and workspace shown in your dashboard.</p>
      </header>

      <Panel title="Your profile" hint="This profile is saved with your self-hosted workspace.">
        <form className="space-y-5" onSubmit={submit}>
          <div className="flex items-center gap-4 border-b border-line pb-5">
            <span className="flex size-16 items-center justify-center rounded-full bg-brand/25 text-lg font-bold text-brand-soft">{initials}</span>
            <div>
              <p className="font-semibold">{draft.name}</p>
              <p className="mt-1 text-sm text-dim">Workspace owner · Local profile</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-semibold text-dim">Display name
              <TextInput maxLength={60} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-dim">Workspace name
              <TextInput maxLength={80} value={draft.workspaceName} onChange={(event) => setDraft({ ...draft, workspaceName: event.target.value })} />
            </label>
          </div>
          {error ? <p role="alert" className="rounded-lg border border-line-bright bg-ink-800 px-3 py-2 text-sm text-text">{error}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <p className="text-xs text-dim">No account, sign-in, or cloud sync is configured in this app.</p>
            <div className="flex items-center gap-3">
              {saved ? <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-soft"><Icon name="check" />Saved</span> : null}
              <Button type="submit" variant="primary" loading={saving}>Save profile</Button>
            </div>
          </div>
        </form>
      </Panel>
    </div>
  );
};
